from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.authorization import require_class_viewer, require_course_manager
from app.database import get_db
from app.models import Assignment, AssignmentStatus, ClassMembership, Submission, User, UserRole
from app.routes.classes import find_class
from app.routes.courses import find_course
from app.schemas import AssignmentCreate, AssignmentResponse, AssignmentUpdate, SubmissionResponse
from app.submission_storage import SubmissionStorage

router = APIRouter(prefix="/courses/{course_id}/classes/{class_id}/assignments", tags=["assignments"])


def find_assignment(class_id: int, assignment_id: int, db: Session) -> Assignment:
    assignment = db.scalar(select(Assignment).where(Assignment.id == assignment_id, Assignment.class_id == class_id))
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return assignment


def require_student_membership(user: User, class_id: int, db: Session) -> None:
    membership_id = db.scalar(
        select(ClassMembership.id).where(
            ClassMembership.user_id == user.id,
            ClassMembership.class_id == class_id,
        )
    )
    if user.role != UserRole.STUDENT or membership_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Assignment access denied")


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    course_id: int,
    class_id: int,
    data: AssignmentCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Assignment:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    find_class(course_id, class_id, db)
    assignment = Assignment(**data.model_dump(), class_id=class_id)
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(
    course_id: int,
    class_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[Assignment]:
    course = find_course(course_id, db)
    class_ = find_class(course_id, class_id, db)
    require_class_viewer(user, course, class_, db)
    query = select(Assignment).where(Assignment.class_id == class_id).order_by(Assignment.created_at.desc())
    if user.role == UserRole.STUDENT:
        query = query.where(Assignment.status != AssignmentStatus.DRAFT)
    return list(db.scalars(query))


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    course_id: int,
    class_id: int,
    assignment_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Assignment:
    course = find_course(course_id, db)
    class_ = find_class(course_id, class_id, db)
    require_class_viewer(user, course, class_, db)
    assignment = find_assignment(class_id, assignment_id, db)
    if user.role == UserRole.STUDENT and assignment.status == AssignmentStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return assignment


@router.patch("/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(
    course_id: int,
    class_id: int,
    assignment_id: int,
    data: AssignmentUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Assignment:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    find_class(course_id, class_id, db)
    assignment = find_assignment(class_id, assignment_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    course_id: int,
    class_id: int,
    assignment_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    find_class(course_id, class_id, db)
    assignment = find_assignment(class_id, assignment_id, db)
    storage_keys = list(db.scalars(select(Submission.storage_key).where(Submission.assignment_id == assignment.id)))
    db.delete(assignment)
    db.commit()
    storage = SubmissionStorage()
    for storage_key in storage_keys:
        storage.delete(storage_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{assignment_id}/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    course_id: int,
    class_id: int,
    assignment_id: int,
    source: UploadFile = File(...),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Submission:
    find_class(course_id, class_id, db)
    require_student_membership(user, class_id, db)
    assignment = find_assignment(class_id, assignment_id, db)
    if assignment.status != AssignmentStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Assignment is not accepting submissions")
    if assignment.deadline is not None:
        deadline = assignment.deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=UTC)
        if datetime.now(UTC) > deadline:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Assignment deadline has passed")

    storage = SubmissionStorage()
    stored = await storage.store(source)
    submission = Submission(assignment_id=assignment.id, student_id=user.id, **stored.__dict__)
    db.add(submission)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        storage.delete(stored.storage_key)
        raise
    db.refresh(submission)
    return submission


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionResponse])
def list_submissions(
    course_id: int,
    class_id: int,
    assignment_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[Submission]:
    course = find_course(course_id, db)
    find_class(course_id, class_id, db)
    assignment = find_assignment(class_id, assignment_id, db)
    query = select(Submission).where(Submission.assignment_id == assignment.id).order_by(Submission.submitted_at.desc())
    if user.role == UserRole.STUDENT:
        require_student_membership(user, class_id, db)
        query = query.where(Submission.student_id == user.id)
    else:
        require_course_manager(user, course)
    return list(db.scalars(query))


def find_visible_submission(
    assignment: Assignment, submission_id: int, user: User, course_id: int, db: Session
) -> Submission:
    submission = db.scalar(
        select(Submission).where(Submission.id == submission_id, Submission.assignment_id == assignment.id)
    )
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    if user.role == UserRole.STUDENT:
        if submission.student_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    else:
        require_course_manager(user, find_course(course_id, db))
    return submission


@router.get("/{assignment_id}/submissions/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Submission:
    find_class(course_id, class_id, db)
    assignment = find_assignment(class_id, assignment_id, db)
    return find_visible_submission(assignment, submission_id, user, course_id, db)


@router.get("/{assignment_id}/submissions/{submission_id}/source")
def download_submission_source(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    find_class(course_id, class_id, db)
    assignment = find_assignment(class_id, assignment_id, db)
    submission = find_visible_submission(assignment, submission_id, user, course_id, db)
    path = SubmissionStorage().source_path(submission.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission source is unavailable")
    return FileResponse(path, media_type="text/x-python", filename=submission.original_filename)
