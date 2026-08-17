import os
import shutil
from collections.abc import Generator
from uuid import uuid4

TEST_RUN_ID = uuid4().hex
TEST_DATABASE_PATH = f"/tmp/grading-tests-{TEST_RUN_ID}.db"
TEST_STORAGE_PATH = f"/tmp/grading-submissions-{TEST_RUN_ID}"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE_PATH}"
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-with-at-least-32-characters")
os.environ["SUBMISSION_STORAGE_PATH"] = TEST_STORAGE_PATH
os.environ["SUBMISSION_MAX_BYTES"] = "64"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.auth import hash_password
from app.database import Base, get_db
from app.main import app
from app.models import (
    Assignment,
    AssignmentStatus,
    Class,
    ClassMembership,
    Course,
    Submission,
    TestCase,
    TestVisibility,
    User,
    UserRole,
)
from app.submission_storage import SubmissionStorage

engine = create_engine(f"sqlite:///{TEST_DATABASE_PATH}", connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator[Session, None, None]:
    with TestingSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def schema() -> Generator[None, None, None]:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)
    shutil.rmtree(TEST_STORAGE_PATH, ignore_errors=True)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db() -> Generator[Session, None, None]:
    with TestingSession() as session:
        yield session


def create_user(db: Session, username: str, role: UserRole) -> User:
    user = User(
        email=f"{username}@example.com",
        username=username,
        full_name=username.title(),
        hashed_password=hash_password("secure-password-123"),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin(db: Session) -> User:
    return create_user(db, "admin", UserRole.ADMIN)


@pytest.fixture
def lecturer(db: Session) -> User:
    return create_user(db, "lecturer", UserRole.LECTURER)


@pytest.fixture
def other_lecturer(db: Session) -> User:
    return create_user(db, "otherlecturer", UserRole.LECTURER)


@pytest.fixture
def student(db: Session) -> User:
    return create_user(db, "student", UserRole.STUDENT)


@pytest.fixture
def other_student(db: Session) -> User:
    return create_user(db, "otherstudent", UserRole.STUDENT)


@pytest.fixture
def course(db: Session, lecturer: User) -> Course:
    value = Course(code="CS101", name="Programming", instructor_id=lecturer.id)
    db.add(value)
    db.commit()
    db.refresh(value)
    return value


@pytest.fixture
def class_(db: Session, course: Course) -> Class:
    value = Class(code="A1", name="Cohort A", course_id=course.id, semester="Fall", year=2026)
    db.add(value)
    db.commit()
    db.refresh(value)
    return value


@pytest.fixture
def membership(db: Session, class_: Class, student: User) -> ClassMembership:
    value = ClassMembership(class_id=class_.id, user_id=student.id)
    db.add(value)
    db.commit()
    db.refresh(value)
    return value


@pytest.fixture
def assignment(db: Session, class_: Class) -> Assignment:
    value = Assignment(
        class_id=class_.id,
        title="Python Basics",
        description="Write a small Python program",
        instructions="Submit one Python source file",
        status=AssignmentStatus.PUBLISHED,
    )
    db.add(value)
    db.commit()
    db.refresh(value)
    return value


@pytest.fixture
def submission(db: Session, assignment: Assignment, student: User, membership: ClassMembership) -> Submission:
    storage = SubmissionStorage()
    storage.root.mkdir(parents=True, exist_ok=True)
    storage_key = "a" * 32 + ".py"
    storage.source_path(storage_key).write_text("def answer():\n    return 42\n", encoding="utf-8")
    value = Submission(
        assignment_id=assignment.id,
        student_id=student.id,
        original_filename="solution.py",
        storage_key=storage_key,
        size_bytes=28,
        sha256="0" * 64,
    )
    db.add(value)
    db.commit()
    db.refresh(value)
    return value


@pytest.fixture
def public_test(db: Session, assignment: Assignment) -> TestCase:
    value = TestCase(
        assignment_id=assignment.id,
        name="answer is 42",
        visibility=TestVisibility.PUBLIC,
        content="import solution\n\ndef test_answer():\n    assert solution.answer() == 42\n",
    )
    db.add(value)
    db.commit()
    db.refresh(value)
    return value


@pytest.fixture
def hidden_test(db: Session, assignment: Assignment) -> TestCase:
    value = TestCase(
        assignment_id=assignment.id,
        name="secret edge case",
        visibility=TestVisibility.HIDDEN,
        content="import solution\n\ndef test_secret():\n    assert solution.answer() == 99\n",
    )
    db.add(value)
    db.commit()
    db.refresh(value)
    return value


def auth_headers(client: TestClient, user: User) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "secure-password-123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
