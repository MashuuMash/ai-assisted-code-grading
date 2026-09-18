import csv
import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_user
from app.authorization import can_manage_class, can_view_class
from app.database import get_db
from app.models import (
    Assignment,
    Cohort,
    CriterionScore,
    Rubric,
    RubricCriterion,
    Submission,
    SubmissionGrade,
    User,
    UserRole,
)
from app.rubric_engine import evaluate_submission_grade, validate_criteria_weights
from app.schemas import (
    RubricCreate,
    RubricResponse,
    RubricUpdate,
    SubmissionGradeOverride,
    SubmissionGradeResponse,
)

router = APIRouter(prefix="/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}", tags=["rubrics"])


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    assignment = db.scalar(
        select(Assignment).where(Assignment.id == assignment_id, Assignment.class_id == class_id)
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    return cohort, assignment


@router.get("/rubric", response_model=RubricResponse)
def get_assignment_rubric(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Rubric:
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_view_class(current_user, cohort, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rubric = db.scalar(
        select(Rubric)
        .options(selectinload(Rubric.criteria))
        .where(Rubric.assignment_id == assignment_id)
    )
    if not rubric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rubric not configured for this assignment")

    return rubric


@router.post("/rubric", response_model=RubricResponse)
def create_assignment_rubric(
    course_id: int,
    class_id: int,
    assignment_id: int,
    rubric_in: RubricCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Rubric:
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    existing = db.scalar(select(Rubric).where(Rubric.assignment_id == assignment_id))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rubric already exists for this assignment. Use PUT to update.",
        )

    try:
        validate_criteria_weights(rubric_in.criteria)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    rubric = Rubric(
        assignment_id=assignment_id,
        title=rubric_in.title,
        description=rubric_in.description,
        max_score=rubric_in.max_score,
    )
    db.add(rubric)
    db.flush()

    for idx, c in enumerate(rubric_in.criteria):
        max_pts = round((c.weight_percentage / 100.0) * rubric_in.max_score, 2)
        crit = RubricCriterion(
            rubric_id=rubric.id,
            title=c.title,
            description=c.description,
            category=c.category,
            evaluation_type=c.evaluation_type,
            weight_percentage=c.weight_percentage,
            max_points=max_pts,
            config=c.config,
            order_index=idx,
        )
        db.add(crit)

    db.commit()
    db.refresh(rubric)
    return rubric


@router.put("/rubric", response_model=RubricResponse)
def update_assignment_rubric(
    course_id: int,
    class_id: int,
    assignment_id: int,
    rubric_in: RubricUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Rubric:
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rubric = db.scalar(
        select(Rubric)
        .options(selectinload(Rubric.criteria))
        .where(Rubric.assignment_id == assignment_id)
    )
    if not rubric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rubric not found")

    if rubric_in.title is not None:
        rubric.title = rubric_in.title
    if rubric_in.description is not None:
        rubric.description = rubric_in.description
    if rubric_in.max_score is not None:
        rubric.max_score = rubric_in.max_score

    if rubric_in.criteria is not None:
        try:
            validate_criteria_weights(rubric_in.criteria)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        rubric.criteria.clear()
        db.flush()

        for idx, c in enumerate(rubric_in.criteria):
            max_pts = round((c.weight_percentage / 100.0) * rubric.max_score, 2)
            crit = RubricCriterion(
                rubric_id=rubric.id,
                title=c.title,
                description=c.description,
                category=c.category,
                evaluation_type=c.evaluation_type,
                weight_percentage=c.weight_percentage,
                max_points=max_pts,
                config=c.config,
                order_index=idx,
            )
            rubric.criteria.append(crit)

    db.commit()
    db.refresh(rubric)
    return rubric


@router.post("/submissions/{submission_id}/evaluate-grade", response_model=SubmissionGradeResponse)
def evaluate_grade(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionGrade:
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    grade = evaluate_submission_grade(db, submission_id)
    if not grade:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to evaluate grade. Ensure assignment has a configured rubric and submission exists.",
        )

    return grade


@router.get("/submissions/{submission_id}/grade", response_model=SubmissionGradeResponse)
def get_submission_grade(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionGrade:
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)

    sub = db.scalar(
        select(Submission).where(Submission.id == submission_id, Submission.assignment_id == assignment_id)
    )
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if current_user.role == UserRole.STUDENT and sub.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if current_user.role == UserRole.LECTURER and not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    grade = db.scalar(
        select(SubmissionGrade)
        .options(
            selectinload(SubmissionGrade.criterion_scores).selectinload(CriterionScore.criterion)
        )
        .where(SubmissionGrade.submission_id == submission_id)
    )
    if not grade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found for this submission")

    return grade


@router.put("/submissions/{submission_id}/grade", response_model=SubmissionGradeResponse)
def override_submission_grade(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    override_in: SubmissionGradeOverride,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubmissionGrade:
    cohort, _ = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    grade = db.scalar(
        select(SubmissionGrade)
        .options(selectinload(SubmissionGrade.criterion_scores))
        .where(SubmissionGrade.submission_id == submission_id)
    )
    if not grade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade record not found")

    scores_map = {cs.criterion_id: cs for cs in grade.criterion_scores}

    calc_total = 0.0
    for item in override_in.criterion_overrides:
        if item.criterion_id in scores_map:
            cs = scores_map[item.criterion_id]
            cs.final_score = round(item.final_score, 2)
            cs.is_overridden = True
            if item.justification:
                cs.justification = item.justification

    # Recompute total if individual criteria overridden
    calc_total = sum(cs.final_score for cs in grade.criterion_scores)
    if override_in.final_total_score is not None:
        grade.final_total_score = round(override_in.final_total_score, 2)
    else:
        grade.final_total_score = round(calc_total, 2)

    grade.status = override_in.status
    if override_in.feedback_summary:
        grade.feedback_summary = override_in.feedback_summary
    grade.confirmed_by_id = current_user.id

    db.commit()
    db.refresh(grade)
    return grade


@router.get("/gradebook-csv")
def export_gradebook_csv(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    cohort, assignment = _get_cohort_and_assignment(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rubric = db.scalar(
        select(Rubric)
        .options(selectinload(Rubric.criteria))
        .where(Rubric.assignment_id == assignment_id)
    )

    criteria = rubric.criteria if rubric else []

    submissions = list(
        db.scalars(
            select(Submission)
            .options(
                selectinload(Submission.grade).selectinload(SubmissionGrade.criterion_scores)
            )
            .where(Submission.assignment_id == assignment_id)
            .order_by(Submission.student_identifier)
        ).all()
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    header = ["Submission ID", "Student Identifier", "Student Name", "Original Filename"]
    for c in criteria:
        header.append(f"{c.title} (Max {c.max_points})")
    header.extend(["Suggested Total", "Final Score", "Status"])
    writer.writerow(header)

    for sub in submissions:
        grade = sub.grade
        row = [
            str(sub.id),
            sub.student_identifier or "",
            sub.student_name or "",
            sub.original_filename,
        ]

        scores_by_crit = {}
        if grade:
            scores_by_crit = {cs.criterion_id: cs.final_score for cs in grade.criterion_scores}

        for c in criteria:
            row.append(str(scores_by_crit.get(c.id, 0.0)))

        if grade:
            row.append(str(grade.suggested_total_score))
            row.append(str(grade.final_total_score if grade.final_total_score is not None else ""))
            row.append(grade.status.value)
        else:
            row.extend(["0.0", "", "ungraded"])

        writer.writerow(row)

    csv_data = output.getvalue()
    filename = f"gradebook_assignment_{assignment_id}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
