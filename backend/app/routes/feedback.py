from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai_feedback_engine import generate_feedback_for_submission
from app.auth import get_current_user
from app.authorization import can_manage_class
from app.database import get_db
from app.models import (
    Assignment,
    Cohort,
    GradeStatus,
    Submission,
    SubmissionGrade,
    User,
)
from app.schemas import (
    BatchFeedbackResponse,
    FeedbackGenerateRequest,
    FeedbackUpdate,
    SubmissionFeedbackResponse,
)

router = APIRouter(
    prefix="/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}",
    tags=["feedback"],
)


def _get_cohort_and_assignment(
    course_id: int,
    class_id: int,
    assignment_id: int,
    db: Session,
) -> tuple[Cohort, Assignment]:
    cohort = db.scalar(
        select(Cohort).where(Cohort.id == class_id, Cohort.course_id == course_id)
    )
    if not cohort:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Class not found"
        )

    assignment = db.scalar(
        select(Assignment).where(
            Assignment.id == assignment_id, Assignment.class_id == class_id
        )
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )

    return cohort, assignment


@router.post(
    "/submissions/{submission_id}/feedback/generate",
    response_model=SubmissionFeedbackResponse,
)
def generate_feedback_draft(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    payload: FeedbackGenerateRequest | None = None,
) -> SubmissionFeedbackResponse:
    """Generate evidence-grounded AI feedback draft for a single submission."""
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors or administrators can generate feedback drafts",
        )

    submission = db.scalar(
        select(Submission).where(
            Submission.id == submission_id,
            Submission.assignment_id == assignment_id,
        )
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found for this assignment",
        )

    model_override = payload.model_override if payload else None
    grade = generate_feedback_for_submission(
        submission_id=submission_id,
        db=db,
        model_override=model_override,
    )

    detailed = grade.detailed_feedback or {}
    citations = detailed.get("citations", [])

    return SubmissionFeedbackResponse(
        submission_id=submission.id,
        submission_grade_id=grade.id,
        status=grade.status,
        suggested_total_score=grade.suggested_total_score,
        final_total_score=grade.final_total_score,
        feedback_summary=grade.feedback_summary,
        detailed_feedback=grade.detailed_feedback,
        citations=citations,
    )


@router.get(
    "/submissions/{submission_id}/feedback",
    response_model=SubmissionFeedbackResponse,
)
def get_submission_feedback(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionFeedbackResponse:
    """Get the current feedback draft and evidence citations for a submission."""
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors or administrators can view feedback details",
        )

    grade = db.scalar(
        select(SubmissionGrade)
        .join(Submission, SubmissionGrade.submission_id == Submission.id)
        .where(
            SubmissionGrade.submission_id == submission_id,
            Submission.assignment_id == assignment_id,
        )
    )
    if not grade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No grade or feedback record found for this submission",
        )

    detailed = grade.detailed_feedback or {}
    citations = detailed.get("citations", [])

    return SubmissionFeedbackResponse(
        submission_id=submission_id,
        submission_grade_id=grade.id,
        status=grade.status,
        suggested_total_score=grade.suggested_total_score,
        final_total_score=grade.final_total_score,
        feedback_summary=grade.feedback_summary,
        detailed_feedback=grade.detailed_feedback,
        citations=citations,
    )


@router.put(
    "/submissions/{submission_id}/feedback",
    response_model=SubmissionFeedbackResponse,
)
def update_submission_feedback(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    payload: FeedbackUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionFeedbackResponse:
    """Instructor edits or confirms the AI feedback draft."""
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors or administrators can edit feedback",
        )

    grade = db.scalar(
        select(SubmissionGrade)
        .join(Submission, SubmissionGrade.submission_id == Submission.id)
        .where(
            SubmissionGrade.submission_id == submission_id,
            Submission.assignment_id == assignment_id,
        )
    )
    if not grade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No grade or feedback record found for this submission",
        )

    if payload.feedback_summary is not None:
        grade.feedback_summary = payload.feedback_summary
    if payload.detailed_feedback is not None:
        grade.detailed_feedback = payload.detailed_feedback
    if payload.status is not None:
        grade.status = payload.status
        if payload.status == GradeStatus.CONFIRMED:
            grade.confirmed_by_id = current_user.id

    db.commit()
    db.refresh(grade)

    detailed = grade.detailed_feedback or {}
    citations = detailed.get("citations", [])

    return SubmissionFeedbackResponse(
        submission_id=submission_id,
        submission_grade_id=grade.id,
        status=grade.status,
        suggested_total_score=grade.suggested_total_score,
        final_total_score=grade.final_total_score,
        feedback_summary=grade.feedback_summary,
        detailed_feedback=grade.detailed_feedback,
        citations=citations,
    )


@router.post(
    "/submissions/batch-generate-feedback",
    response_model=BatchFeedbackResponse,
)
def batch_generate_feedback(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    payload: FeedbackGenerateRequest | None = None,
) -> BatchFeedbackResponse:
    """Batch generate feedback drafts for all submissions of an assignment."""
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors or administrators can batch-generate feedback",
        )

    submissions = db.scalars(
        select(Submission).where(Submission.assignment_id == assignment_id)
    ).all()

    model_override = payload.model_override if payload else None
    generated_count = 0
    failed_count = 0
    results: list[dict] = []

    for sub in submissions:
        try:
            grade = generate_feedback_for_submission(
                submission_id=sub.id,
                db=db,
                model_override=model_override,
            )
            generated_count += 1
            results.append(
                {
                    "submission_id": sub.id,
                    "status": "success",
                    "grade_id": grade.id,
                }
            )
        except Exception as exc:
            failed_count += 1
            results.append(
                {
                    "submission_id": sub.id,
                    "status": "failed",
                    "error": str(exc),
                }
            )

    return BatchFeedbackResponse(
        total_submissions=len(submissions),
        generated_count=generated_count,
        failed_count=failed_count,
        results=results,
    )
