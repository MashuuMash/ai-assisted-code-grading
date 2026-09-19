from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_user
from app.authorization import can_manage_class
from app.database import get_db
from app.jplag_runner import run_similarity_for_assignment
from app.models import (
    Assignment,
    Cohort,
    SimilarityComparison,
    SimilarityReport,
    User,
)
from app.schemas import (
    ComparisonReviewUpdate,
    SimilarityComparisonResponse,
    SimilarityReportDetailResponse,
    SimilarityReportResponse,
    SimilarityRunRequest,
)

router = APIRouter(
    prefix="/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}/similarity",
    tags=["similarity"],
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


@router.post("/run", response_model=SimilarityReportResponse)
def trigger_similarity_analysis(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    payload: SimilarityRunRequest | None = None,
) -> SimilarityReport:
    """Run similarity comparison across submissions for an assignment."""
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors or administrators can trigger similarity analysis",
        )

    threshold = payload.threshold if payload else 50.0
    report = run_similarity_for_assignment(
        assignment_id=assignment_id,
        db=db,
        threshold=threshold,
    )
    return report


@router.get("/reports", response_model=list[SimilarityReportResponse])
def list_similarity_reports(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[SimilarityReport]:
    """List historical similarity reports for this assignment."""
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors or administrators can view similarity reports",
        )

    reports = db.scalars(
        select(SimilarityReport)
        .where(SimilarityReport.assignment_id == assignment_id)
        .order_by(SimilarityReport.created_at.desc())
    ).all()
    return list(reports)


@router.get("/reports/{report_id}", response_model=SimilarityReportDetailResponse)
def get_similarity_report_details(
    course_id: int,
    class_id: int,
    assignment_id: int,
    report_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SimilarityReport:
    """Get detailed report with all pairwise comparison candidates."""
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors or administrators can view similarity reports",
        )

    report = db.scalar(
        select(SimilarityReport)
        .options(selectinload(SimilarityReport.comparisons))
        .where(
            SimilarityReport.id == report_id,
            SimilarityReport.assignment_id == assignment_id,
        )
    )
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Similarity report not found",
        )
    return report


@router.put(
    "/reports/{report_id}/comparisons/{comparison_id}",
    response_model=SimilarityComparisonResponse,
)
def review_similarity_comparison(
    course_id: int,
    class_id: int,
    assignment_id: int,
    report_id: int,
    comparison_id: int,
    payload: ComparisonReviewUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SimilarityComparison:
    """Instructor review of candidate similarity match (flag or dismiss with notes)."""
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors or administrators can review similarity matches",
        )

    comparison = db.scalar(
        select(SimilarityComparison)
        .join(SimilarityReport, SimilarityComparison.report_id == SimilarityReport.id)
        .where(
            SimilarityComparison.id == comparison_id,
            SimilarityComparison.report_id == report_id,
            SimilarityReport.assignment_id == assignment_id,
        )
    )
    if not comparison:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Similarity comparison not found",
        )

    comparison.status = payload.status
    if payload.review_notes is not None:
        comparison.review_notes = payload.review_notes

    db.commit()
    db.refresh(comparison)
    return comparison
