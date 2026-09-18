from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.authorization import can_manage_class, can_view_class
from app.batch_ingestion import ingest_batch_zip
from app.database import get_db
from app.models import (
    Assignment,
    AssignmentStatus,
    ClassMembership,
    Cohort,
    Course,
    Submission,
    SubmissionEvidence,
    User,
    UserRole,
)
from app.schemas import (
    AssignmentCreate,
    AssignmentResponse,
    AssignmentUpdate,
    BatchUploadResponse,
    EvidenceResponse,
    SubmissionResponse,
)
from app.submission_storage import SubmissionStorage

router = APIRouter(prefix="/courses/{course_id}/classes/{class_id}/assignments", tags=["assignments"])


def get_course_or_404(course_id: int, db: Session) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


def get_class_or_404(course_id: int, class_id: int, db: Session) -> Cohort:
    cohort = db.scalar(
        select(Cohort).where(Cohort.id == class_id, Cohort.course_id == course_id)
    )
    if not cohort:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found in this course",
        )
    return cohort


def get_assignment_or_404(class_id: int, assignment_id: int, db: Session) -> Assignment:
    assignment = db.scalar(
        select(Assignment).where(Assignment.id == assignment_id, Assignment.class_id == class_id)
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return assignment


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(
    course_id: int,
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Assignment]:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_view_class(current_user, cohort, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if current_user.role in (UserRole.ADMIN, UserRole.LECTURER):
        return list(
            db.scalars(
                select(Assignment)
                .where(Assignment.class_id == class_id)
                .order_by(Assignment.created_at.desc())
            ).all()
        )

    # Students cannot see draft assignments
    return list(
        db.scalars(
            select(Assignment)
            .where(
                Assignment.class_id == class_id,
                Assignment.status != AssignmentStatus.DRAFT,
            )
            .order_by(Assignment.created_at.desc())
        ).all()
    )


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    course_id: int,
    class_id: int,
    assignment_in: AssignmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Assignment:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    assignment = Assignment(
        class_id=class_id,
        title=assignment_in.title,
        description=assignment_in.description,
        instructions=assignment_in.instructions,
        language=assignment_in.language,
        deadline=assignment_in.deadline,
        status=assignment_in.status,
        base_code=assignment_in.base_code,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Assignment:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_view_class(current_user, cohort, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    assignment = get_assignment_or_404(class_id, assignment_id, db)
    if current_user.role == UserRole.STUDENT and assignment.status == AssignmentStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    return assignment


@router.put("/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(
    course_id: int,
    class_id: int,
    assignment_id: int,
    assignment_in: AssignmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Assignment:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    assignment = get_assignment_or_404(class_id, assignment_id, db)
    if assignment_in.title is not None:
        assignment.title = assignment_in.title
    if assignment_in.description is not None:
        assignment.description = assignment_in.description
    if assignment_in.instructions is not None:
        assignment.instructions = assignment_in.instructions
    if assignment_in.language is not None:
        assignment.language = assignment_in.language
    if assignment_in.deadline is not None:
        assignment.deadline = assignment_in.deadline
    if assignment_in.status is not None:
        assignment.status = assignment_in.status
    if assignment_in.base_code is not None:
        assignment.base_code = assignment_in.base_code

    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    assignment = get_assignment_or_404(class_id, assignment_id, db)
    storage = SubmissionStorage()
    for sub in assignment.submissions:
        storage.delete(sub.storage_key)

    db.delete(assignment)
    db.commit()


@router.post("/{assignment_id}/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def submit_assignment(
    course_id: int,
    class_id: int,
    assignment_id: int,
    file: Annotated[UploadFile, File()],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Submission:
    _ = get_class_or_404(course_id, class_id, db)
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can submit assignments",
        )

    # Check student enrollment in this class
    enrolled = db.scalar(
        select(ClassMembership).where(
            ClassMembership.class_id == class_id,
            ClassMembership.user_id == current_user.id,
        )
    )
    if not enrolled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in this class")

    assignment = get_assignment_or_404(class_id, assignment_id, db)
    if assignment.status != AssignmentStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Submissions are not accepted for an assignment in '{assignment.status.value}' status",
        )

    if assignment.deadline is not None:
        now_utc = datetime.now(timezone.utc)
        deadline = assignment.deadline if assignment.deadline.tzinfo else assignment.deadline.replace(tzinfo=timezone.utc)
        if now_utc > deadline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Submission deadline has passed",
            )

    storage = SubmissionStorage()
    stored = await storage.store(file)

    submission = Submission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        original_filename=stored.original_filename,
        storage_key=stored.storage_key,
        size_bytes=stored.size_bytes,
        sha256=stored.sha256,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionResponse])
def list_submissions(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Submission]:
    cohort = get_class_or_404(course_id, class_id, db)
    _ = get_assignment_or_404(class_id, assignment_id, db)

    if current_user.role in (UserRole.ADMIN, UserRole.LECTURER):
        if not can_manage_class(current_user, cohort):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return list(
            db.scalars(
                select(Submission)
                .options(joinedload(Submission.student))
                .where(Submission.assignment_id == assignment_id)
                .order_by(Submission.submitted_at.desc())
            ).all()
        )

    # Student: only their own submissions
    return list(
        db.scalars(
            select(Submission)
            .options(joinedload(Submission.student))
            .where(
                Submission.assignment_id == assignment_id,
                Submission.student_id == current_user.id,
            )
            .order_by(Submission.submitted_at.desc())
        ).all()
    )


@router.get("/{assignment_id}/submissions/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Submission:
    cohort = get_class_or_404(course_id, class_id, db)
    _ = get_assignment_or_404(class_id, assignment_id, db)

    submission = db.scalar(
        select(Submission)
        .options(joinedload(Submission.student))
        .where(Submission.id == submission_id, Submission.assignment_id == assignment_id)
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if current_user.role == UserRole.STUDENT and submission.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if current_user.role == UserRole.LECTURER and not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return submission


@router.get("/{assignment_id}/submissions/{submission_id}/source")
def get_submission_source(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FileResponse:
    cohort = get_class_or_404(course_id, class_id, db)
    _ = get_assignment_or_404(class_id, assignment_id, db)

    submission = db.scalar(
        select(Submission).where(
            Submission.id == submission_id, Submission.assignment_id == assignment_id
        )
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if current_user.role == UserRole.STUDENT and submission.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if current_user.role == UserRole.LECTURER and not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    storage = SubmissionStorage()
    path = storage.source_path(submission.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file unavailable on disk")

    return FileResponse(
        path=path,
        media_type="text/x-python",
        filename=submission.original_filename,
    )


@router.post("/{assignment_id}/submissions/batch-zip", response_model=BatchUploadResponse)
def batch_upload_submissions(
    course_id: int,
    class_id: int,
    assignment_id: int,
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BatchUploadResponse:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    _ = get_assignment_or_404(class_id, assignment_id, db)

    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch submissions must be uploaded as a .zip archive",
        )

    try:
        archive_bytes = file.file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read upload archive: {exc}",
        )

    try:
        return ingest_batch_zip(
            db=db,
            assignment_id=assignment_id,
            archive_bytes=archive_bytes,
            auto_queue=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/{assignment_id}/submissions/{submission_id}/evidence",
    response_model=list[EvidenceResponse],
)
def get_submission_evidence(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[SubmissionEvidence]:
    cohort = get_class_or_404(course_id, class_id, db)
    _ = get_assignment_or_404(class_id, assignment_id, db)

    submission = db.scalar(
        select(Submission).where(
            Submission.id == submission_id, Submission.assignment_id == assignment_id
        )
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if current_user.role == UserRole.STUDENT and submission.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if current_user.role == UserRole.LECTURER and not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    records = list(
        db.scalars(
            select(SubmissionEvidence)
            .where(SubmissionEvidence.submission_id == submission_id)
            .order_by(SubmissionEvidence.created_at)
        ).all()
    )
    return records

