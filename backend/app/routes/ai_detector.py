from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.authorization import can_manage_class
from app.codebert_detector import CodeBertDetector, generate_codebert_evidence
from app.database import get_db
from app.evidence_engine import persist_submission_evidence
from app.models import Assignment, Cohort, Submission, User
from app.schemas import AiDetectionResponse, BatchAiDetectionResponse
from app.submission_storage import SubmissionStorage

router = APIRouter(
    prefix="/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}/submissions",
    tags=["ai_detector"],
)


def _get_assignment_context(
    course_id: int,
    class_id: int,
    assignment_id: int,
    db: Session,
) -> tuple[Cohort, Assignment]:
    cohort = db.scalar(
        select(Cohort).where(Cohort.id == class_id, Cohort.course_id == course_id)
    )
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    assignment = db.scalar(
        select(Assignment).where(Assignment.id == assignment_id, Assignment.class_id == class_id)
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    return cohort, assignment


@router.post("/{submission_id}/detect-ai", response_model=AiDetectionResponse)
def detect_ai_code_submission(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AiDetectionResponse:
    cohort, assignment = _get_assignment_context(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    submission = db.scalar(
        select(Submission).where(
            Submission.id == submission_id,
            Submission.assignment_id == assignment.id,
        )
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    storage = SubmissionStorage()
    source_path = storage.source_path(submission.storage_key)
    if not source_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission source file not found in storage",
        )

    source_code = source_path.read_text(encoding="utf-8", errors="replace")

    detector = CodeBertDetector()
    prediction = detector.predict(source_code)

    evidence_items = generate_codebert_evidence(
        submission_id=submission.id,
        assignment_id=assignment.id,
        prediction=prediction,
    )
    persist_submission_evidence(db=db, submission_id=submission.id, evidence_items=evidence_items)
    db.commit()

    ev_id = evidence_items[0].id if evidence_items else None

    return AiDetectionResponse(
        submission_id=submission.id,
        ai_probability=prediction.ai_probability,
        classification=prediction.classification,
        confidence_score=prediction.confidence_score,
        model_mode=prediction.model_mode,
        signals=prediction.signals,
        evidence_id=ev_id,
    )


@router.post("/batch-detect-ai", response_model=BatchAiDetectionResponse)
def batch_detect_ai_code(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BatchAiDetectionResponse:
    cohort, assignment = _get_assignment_context(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    submissions = list(
        db.scalars(
            select(Submission)
            .where(Submission.assignment_id == assignment.id)
            .order_by(Submission.id)
        )
    )

    storage = SubmissionStorage()
    detector = CodeBertDetector()
    results: list[AiDetectionResponse] = []
    high_prob_count = 0

    for sub in submissions:
        source_path = storage.source_path(sub.storage_key)
        if not source_path.exists():
            continue

        source_code = source_path.read_text(encoding="utf-8", errors="replace")
        prediction = detector.predict(source_code)

        evidence_items = generate_codebert_evidence(
            submission_id=sub.id,
            assignment_id=assignment.id,
            prediction=prediction,
        )
        persist_submission_evidence(db=db, submission_id=sub.id, evidence_items=evidence_items)

        if prediction.ai_probability >= 0.65:
            high_prob_count += 1

        ev_id = evidence_items[0].id if evidence_items else None
        results.append(
            AiDetectionResponse(
                submission_id=sub.id,
                ai_probability=prediction.ai_probability,
                classification=prediction.classification,
                confidence_score=prediction.confidence_score,
                model_mode=prediction.model_mode,
                signals=prediction.signals,
                evidence_id=ev_id,
            )
        )

    db.commit()

    return BatchAiDetectionResponse(
        total_analyzed=len(results),
        high_probability_count=high_prob_count,
        results=results,
    )
