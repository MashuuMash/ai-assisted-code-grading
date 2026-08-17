from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models import ClassMembership, Cohort, Course, User, UserRole


def require_lecturer(user: User) -> None:
    if user.role not in {UserRole.LECTURER, UserRole.ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Lecturer access required")


def require_course_manager(user: User, course: Course) -> None:
    if user.role != UserRole.ADMIN and user.id != course.instructor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course access denied")


def can_view_course(user: User, course: Course, db: Session) -> bool:
    if user.role == UserRole.ADMIN or user.id == course.instructor_id:
        return True
    if user.role != UserRole.STUDENT:
        return False
    return bool(
        db.scalar(
            select(
                exists().where(
                    ClassMembership.user_id == user.id,
                    ClassMembership.class_id == Cohort.id,
                    Cohort.course_id == course.id,
                )
            )
        )
    )


def require_course_viewer(user: User, course: Course, db: Session) -> None:
    if not can_view_course(user, course, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Course access denied")


def require_class_viewer(user: User, course: Course, class_: Cohort, db: Session) -> None:
    if class_.course_id != course.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if user.role == UserRole.ADMIN or user.id == course.instructor_id:
        return
    membership_id = db.scalar(
        select(ClassMembership.id).where(
            ClassMembership.user_id == user.id,
            ClassMembership.class_id == class_.id,
        )
    )
    if membership_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Class access denied")
