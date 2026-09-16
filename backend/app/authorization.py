from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ClassMembership, Cohort, Course, User, UserRole


def can_manage_course(user: User, course: Course) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    return user.role == UserRole.LECTURER and course.instructor_id == user.id


def can_view_course(user: User, course: Course, db: Session) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if course.instructor_id == user.id:
        return True
    # Student can view if enrolled in any active class of this course
    membership = db.scalar(
        select(ClassMembership)
        .join(Cohort, ClassMembership.class_id == Cohort.id)
        .where(Cohort.course_id == course.id, ClassMembership.user_id == user.id)
    )
    return membership is not None


def can_manage_class(user: User, cohort: Cohort) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    return user.role == UserRole.LECTURER and cohort.course.instructor_id == user.id


def can_view_class(user: User, cohort: Cohort, db: Session) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if cohort.course.instructor_id == user.id:
        return True
    # Student must have membership in this specific class
    membership = db.scalar(
        select(ClassMembership).where(
            ClassMembership.class_id == cohort.id,
            ClassMembership.user_id == user.id,
        )
    )
    return membership is not None
