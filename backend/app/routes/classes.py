from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.authorization import can_manage_class, can_manage_course, can_view_class, can_view_course
from app.database import get_db
from app.models import ClassMembership, Cohort, Course, User, UserRole
from app.schemas import ClassCreate, ClassResponse, ClassUpdate, MembershipAdd, MembershipResponse

router = APIRouter(prefix="/courses/{course_id}/classes", tags=["classes"])


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


@router.get("", response_model=list[ClassResponse])
def list_classes(
    course_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Cohort]:
    course = get_course_or_404(course_id, db)
    if not can_view_course(current_user, course, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if current_user.role in (UserRole.ADMIN, UserRole.LECTURER):
        return list(
            db.scalars(
                select(Cohort)
                .where(Cohort.course_id == course_id)
                .order_by(Cohort.year.desc(), Cohort.created_at.desc())
            ).all()
        )

    # Student: only classes they are member of
    return list(
        db.scalars(
            select(Cohort)
            .join(ClassMembership, ClassMembership.class_id == Cohort.id)
            .where(Cohort.course_id == course_id, ClassMembership.user_id == current_user.id)
            .order_by(Cohort.year.desc(), Cohort.created_at.desc())
        ).all()
    )


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    course_id: int,
    class_in: ClassCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Cohort:
    course = get_course_or_404(course_id, db)
    if not can_manage_course(current_user, course):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    existing = db.scalar(
        select(Cohort).where(Cohort.course_id == course_id, Cohort.code == class_in.code)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Class code already exists in this course",
        )

    cohort = Cohort(
        course_id=course_id,
        code=class_in.code,
        name=class_in.name,
        description=class_in.description,
        semester=class_in.semester,
        year=class_in.year,
        is_active=True,
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)
    return cohort


@router.get("/{class_id}", response_model=ClassResponse)
def get_class(
    course_id: int,
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Cohort:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_view_class(current_user, cohort, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return cohort


@router.put("/{class_id}", response_model=ClassResponse)
def update_class(
    course_id: int,
    class_id: int,
    class_in: ClassUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Cohort:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if class_in.name is not None:
        cohort.name = class_in.name
    if class_in.description is not None:
        cohort.description = class_in.description
    if class_in.semester is not None:
        cohort.semester = class_in.semester
    if class_in.year is not None:
        cohort.year = class_in.year
    if class_in.is_active is not None:
        cohort.is_active = class_in.is_active

    db.commit()
    db.refresh(cohort)
    return cohort


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(
    course_id: int,
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db.delete(cohort)
    db.commit()


@router.get("/{class_id}/memberships", response_model=list[MembershipResponse])
def list_memberships(
    course_id: int,
    class_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ClassMembership]:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_view_class(current_user, cohort, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return list(
        db.scalars(
            select(ClassMembership)
            .options(joinedload(ClassMembership.user))
            .where(ClassMembership.class_id == class_id)
            .order_by(ClassMembership.joined_at.desc())
        ).all()
    )


@router.post("/{class_id}/memberships", response_model=MembershipResponse, status_code=status.HTTP_201_CREATED)
def add_membership(
    course_id: int,
    class_id: int,
    membership_in: MembershipAdd,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ClassMembership:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    target_user = db.scalar(select(User).where(User.id == membership_in.user_id))
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with the STUDENT role can be enrolled in a class",
        )

    existing = db.scalar(
        select(ClassMembership).where(
            ClassMembership.class_id == class_id,
            ClassMembership.user_id == membership_in.user_id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is already enrolled in this class",
        )

    membership = ClassMembership(user_id=membership_in.user_id, class_id=class_id)
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership


@router.delete("/{class_id}/memberships/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_membership(
    course_id: int,
    class_id: int,
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    cohort = get_class_or_404(course_id, class_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    membership = db.scalar(
        select(ClassMembership).where(
            ClassMembership.class_id == class_id,
            ClassMembership.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    db.delete(membership)
    db.commit()
