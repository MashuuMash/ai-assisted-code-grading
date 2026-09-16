from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.authorization import can_manage_course, can_view_course
from app.database import get_db
from app.models import ClassMembership, Cohort, Course, User, UserRole
from app.schemas import CourseCreate, CourseResponse, CourseUpdate

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseResponse])
def list_courses(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Course]:
    if current_user.role == UserRole.ADMIN:
        return list(db.scalars(select(Course).order_by(Course.created_at.desc())).all())
    if current_user.role == UserRole.LECTURER:
        return list(
            db.scalars(
                select(Course)
                .where(Course.instructor_id == current_user.id)
                .order_by(Course.created_at.desc())
            ).all()
        )
    # Student: courses with an active class membership
    enrolled_course_ids = select(Cohort.course_id).join(
        ClassMembership, ClassMembership.class_id == Cohort.id
    ).where(ClassMembership.user_id == current_user.id)

    return list(
        db.scalars(
            select(Course)
            .where(Course.id.in_(enrolled_course_ids))
            .order_by(Course.created_at.desc())
        ).all()
    )


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    course_in: CourseCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.LECTURER, UserRole.ADMIN))],
    db: Annotated[Session, Depends(get_db)],
) -> Course:
    existing = db.scalar(select(Course).where(Course.code == course_in.code))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course with this code already exists",
        )

    course = Course(
        code=course_in.code,
        name=course_in.name,
        description=course_in.description,
        instructor_id=current_user.id,
        is_active=True,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if not can_view_course(current_user, course, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return course


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    course_in: CourseUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if not can_manage_course(current_user, course):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if course_in.name is not None:
        course.name = course_in.name
    if course_in.description is not None:
        course.description = course_in.description
    if course_in.is_active is not None:
        course.is_active = course_in.is_active

    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if not can_manage_course(current_user, course):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db.delete(course)
    db.commit()
