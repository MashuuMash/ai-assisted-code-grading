import uuid
from decimal import Decimal
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_lecturer
from app.models import Assignment, Lecturer, SimilarityPair, Submission
from app.schemas import SimilarityMatrixResponse, SimilarityPairResponse
from app.similarity.engine import compute_similarity

router = APIRouter(tags=["Similarity & Academic Integrity"])

@router.post("/assignments/{assignment_id}/similarity/run", response_model=SimilarityMatrixResponse)
def run_similarity_analysis(
    assignment_id: uuid.UUID,
    threshold: float = Query(0.40, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    submissions = db.query(Submission).filter(Submission.assignment_id == assignment_id).all()
    if len(submissions) < 2:
        return SimilarityMatrixResponse(
            assignment_id=assignment_id,
            threshold=Decimal(str(threshold)),
            total_pairs=0,
            flagged_pairs=[],
        )

    # Clean previous pairs for assignment
    db.query(SimilarityPair).filter(SimilarityPair.assignment_id == assignment_id).delete()

    # Pre-aggregate submission code
    sub_code_map = {}
    for s in submissions:
        sub_code_map[s.id] = "\n\n".join(f.file_content for f in s.files)

    total_pairs = 0
    flagged_pairs = []

    sub_list = list(submissions)
    for i in range(len(sub_list)):
        for j in range(i + 1, len(sub_list)):
            total_pairs += 1
            sub_a = sub_list[i]
            sub_b = sub_list[j]

            # Enforce canonical ordering
            if str(sub_a.id) > str(sub_b.id):
                sub_a, sub_b = sub_b, sub_a

            code_a = sub_code_map[sub_a.id]
            code_b = sub_code_map[sub_b.id]

            sim_score, matched_spans = compute_similarity(code_a, code_b)

            if sim_score >= Decimal(str(threshold)):
                pair = SimilarityPair(
                    assignment_id=assignment_id,
                    submission_a_id=sub_a.id,
                    submission_b_id=sub_b.id,
                    similarity_score=sim_score,
                    algorithm="WINNOWING_TOKEN",
                    matched_spans=matched_spans,
                )
                db.add(pair)
                db.flush()

                pair_resp = SimilarityPairResponse.model_validate(pair)
                pair_resp.student_a_identifier = sub_a.student_identifier
                pair_resp.student_a_name = sub_a.student_name
                pair_resp.student_b_identifier = sub_b.student_identifier
                pair_resp.student_b_name = sub_b.student_name
                flagged_pairs.append(pair_resp)

    db.commit()

    # Sort descending by similarity score
    flagged_pairs.sort(key=lambda x: x.similarity_score, reverse=True)

    return SimilarityMatrixResponse(
        assignment_id=assignment_id,
        threshold=Decimal(str(threshold)),
        total_pairs=total_pairs,
        flagged_pairs=flagged_pairs,
    )


@router.get("/assignments/{assignment_id}/similarity/matrix", response_model=SimilarityMatrixResponse)
def get_similarity_matrix(
    assignment_id: uuid.UUID,
    threshold: float = Query(0.40, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    pairs = db.query(SimilarityPair).filter(
        SimilarityPair.assignment_id == assignment_id,
        SimilarityPair.similarity_score >= Decimal(str(threshold)),
    ).order_by(SimilarityPair.similarity_score.desc()).all()

    flagged_pairs = []
    for p in pairs:
        resp = SimilarityPairResponse.model_validate(p)
        resp.student_a_identifier = p.submission_a.student_identifier
        resp.student_a_name = p.submission_a.student_name
        resp.student_b_identifier = p.submission_b.student_identifier
        resp.student_b_name = p.submission_b.student_name
        flagged_pairs.append(resp)

    return SimilarityMatrixResponse(
        assignment_id=assignment_id,
        threshold=Decimal(str(threshold)),
        total_pairs=len(pairs),
        flagged_pairs=flagged_pairs,
    )


@router.get("/similarity/pairs/{pair_id}")
def get_similarity_pair_detail(
    pair_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    pair = db.query(SimilarityPair).filter(SimilarityPair.id == pair_id).first()
    if not pair or pair.assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Similarity pair not found")

    sub_a = pair.submission_a
    sub_b = pair.submission_b

    code_a = "\n\n".join(f.file_content for f in sub_a.files)
    code_b = "\n\n".join(f.file_content for f in sub_b.files)

    return {
        "id": pair.id,
        "assignment_id": pair.assignment_id,
        "similarity_score": float(pair.similarity_score),
        "algorithm": pair.algorithm,
        "matched_spans": pair.matched_spans,
        "submission_a": {
            "id": sub_a.id,
            "student_identifier": sub_a.student_identifier,
            "student_name": sub_a.student_name,
            "code": code_a,
            "raw_archive_hash": sub_a.raw_archive_hash,
            "submitted_at": sub_a.submitted_at.isoformat(),
        },
        "submission_b": {
            "id": sub_b.id,
            "student_identifier": sub_b.student_identifier,
            "student_name": sub_b.student_name,
            "code": code_b,
            "raw_archive_hash": sub_b.raw_archive_hash,
            "submitted_at": sub_b.submitted_at.isoformat(),
        },
    }
