from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_active_user
from app.authorization import require_course_manager, require_course_viewer, require_lecturer
from app.database import get_db
from app.models import Assignment, ClassMembership, Cohort, Course, Submission, User, UserRole
from app.schemas import CourseCreate, CourseResponse, CourseUpdate
from app.submission_storage import SubmissionStorage

router = APIRouter(prefix="/courses", tags=["courses"])


def find_course(course_id: int, db: Session) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    data: CourseCreate, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
) -> Course:
    require_lecturer(user)
    course = Course(**data.model_dump(), instructor_id=user.id)
    db.add(course)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists") from exc
    db.refresh(course)
    return course


@router.get("", response_model=list[CourseResponse])
def list_courses(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)) -> list[Course]:
    query = select(Course).order_by(Course.code)
    if user.role == UserRole.LECTURER:
        query = query.where(Course.instructor_id == user.id)
    elif user.role == UserRole.STUDENT:
        query = query.join(Cohort).join(ClassMembership).where(ClassMembership.user_id == user.id).distinct()
    return list(db.scalars(query))


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)) -> Course:
    course = find_course(course_id, db)
    require_course_viewer(user, course, db)
    return course


@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int, data: CourseUpdate, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
) -> Course:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
) -> Response:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    storage_keys = list(
        db.scalars(select(Submission.storage_key).join(Assignment).join(Cohort).where(Cohort.course_id == course_id))
    )
    db.delete(course)
    db.commit()
    storage = SubmissionStorage()
    for storage_key in storage_keys:
        storage.delete(storage_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
