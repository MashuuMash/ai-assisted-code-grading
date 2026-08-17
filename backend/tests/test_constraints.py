import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Class, ClassMembership, Course


def test_class_code_is_unique_within_course(db: Session, course: Course, class_: Class) -> None:
    db.add(Class(code=class_.code, name="Duplicate", course_id=course.id, semester="Fall", year=2026))
    with pytest.raises(IntegrityError):
        db.commit()


def test_membership_is_unique(db: Session, membership: ClassMembership) -> None:
    db.add(ClassMembership(user_id=membership.user_id, class_id=membership.class_id))
    with pytest.raises(IntegrityError):
        db.commit()
