from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_active_user
from app.authorization import require_class_viewer, require_course_manager, require_course_viewer
from app.database import get_db
from app.models import Assignment, ClassMembership, Cohort, Submission, User, UserRole
from app.routes.courses import find_course
from app.schemas import ClassCreate, ClassResponse, ClassUpdate, MembershipResponse
from app.submission_storage import SubmissionStorage

router = APIRouter(prefix="/courses/{course_id}/classes", tags=["classes"])


def find_class(course_id: int, class_id: int, db: Session) -> Cohort:
    class_ = db.scalar(select(Cohort).where(Cohort.id == class_id, Cohort.course_id == course_id))
    if class_ is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return class_


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    course_id: int, data: ClassCreate, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
) -> Cohort:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    class_ = Cohort(**data.model_dump(), course_id=course_id)
    db.add(class_)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Class code already exists in this course"
        ) from exc
    db.refresh(class_)
    return class_


@router.get("", response_model=list[ClassResponse])
def list_classes(
    course_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
) -> list[Cohort]:
    course = find_course(course_id, db)
    require_course_viewer(user, course, db)
    query = select(Cohort).where(Cohort.course_id == course_id).order_by(Cohort.code)
    if user.role == UserRole.STUDENT:
        query = query.join(ClassMembership).where(ClassMembership.user_id == user.id)
    return list(db.scalars(query))


@router.get("/{class_id}", response_model=ClassResponse)
def get_class(
    course_id: int, class_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
) -> Cohort:
    course = find_course(course_id, db)
    class_ = find_class(course_id, class_id, db)
    require_class_viewer(user, course, class_, db)
    return class_


@router.patch("/{class_id}", response_model=ClassResponse)
def update_class(
    course_id: int,
    class_id: int,
    data: ClassUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Cohort:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    class_ = find_class(course_id, class_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(class_, field, value)
    db.commit()
    db.refresh(class_)
    return class_


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(
    course_id: int, class_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
) -> Response:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    class_ = find_class(course_id, class_id, db)
    storage_keys = list(
        db.scalars(select(Submission.storage_key).join(Assignment).where(Assignment.class_id == class_id))
    )
    db.delete(class_)
    db.commit()
    storage = SubmissionStorage()
    for storage_key in storage_keys:
        storage.delete(storage_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{class_id}/memberships", response_model=list[MembershipResponse])
def list_memberships(
    course_id: int, class_id: int, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
) -> list[ClassMembership]:
    course = find_course(course_id, db)
    require_course_manager(user, course)
    find_class(course_id, class_id, db)
    query = (
        select(ClassMembership).options(selectinload(ClassMembership.user)).where(ClassMembership.class_id == class_id)
    )
    return list(db.scalars(query))


@router.post(
    "/{class_id}/memberships/{user_id}", response_model=MembershipResponse, status_code=status.HTTP_201_CREATED
)
def add_membership(
    course_id: int,
    class_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ClassMembership:
    course = find_course(course_id, db)
    require_course_manager(current_user, course)
    find_class(course_id, class_id, db)
    student = db.get(User, user_id)
    if student is None or student.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    membership = ClassMembership(user_id=user_id, class_id=class_id)
    db.add(membership)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student is already a class member") from exc
    db.refresh(membership)
    return db.scalar(
        select(ClassMembership).options(selectinload(ClassMembership.user)).where(ClassMembership.id == membership.id)
    )


@router.delete("/{class_id}/memberships/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_membership(
    course_id: int,
    class_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    course = find_course(course_id, db)
    require_course_manager(current_user, course)
    find_class(course_id, class_id, db)
    membership = db.scalar(
        select(ClassMembership).where(ClassMembership.user_id == user_id, ClassMembership.class_id == class_id)
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    db.delete(membership)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
