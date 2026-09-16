from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import create_access_token, get_password_hash
from app.database import Base, get_db
from app.main import app
from app.models import User, UserRole

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def init_database() -> Generator[None, None, None]:
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db: Session) -> User:
    user = User(
        email="admin@example.edu",
        username="admin",
        full_name="System Administrator",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def lecturer_user(db: Session) -> User:
    user = User(
        email="lecturer@example.edu",
        username="lecturer",
        full_name="Primary Lecturer",
        hashed_password=get_password_hash("LecturerPass123!"),
        role=UserRole.LECTURER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def lecturer_user_2(db: Session) -> User:
    user = User(
        email="lecturer2@example.edu",
        username="lecturer2",
        full_name="Secondary Lecturer",
        hashed_password=get_password_hash("LecturerPass123!"),
        role=UserRole.LECTURER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def student_user(db: Session) -> User:
    user = User(
        email="student@example.edu",
        username="student",
        full_name="Test Student",
        hashed_password=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def student_user_2(db: Session) -> User:
    user = User(
        email="student2@example.edu",
        username="student2",
        full_name="Second Student",
        hashed_password=get_password_hash("StudentPass123!"),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user: User) -> str:
    return create_access_token(
        data={"sub": admin_user.username, "user_id": admin_user.id, "role": admin_user.role.value}
    )


@pytest.fixture
def lecturer_token(lecturer_user: User) -> str:
    return create_access_token(
        data={"sub": lecturer_user.username, "user_id": lecturer_user.id, "role": lecturer_user.role.value}
    )


@pytest.fixture
def lecturer_token_2(lecturer_user_2: User) -> str:
    return create_access_token(
        data={"sub": lecturer_user_2.username, "user_id": lecturer_user_2.id, "role": lecturer_user_2.role.value}
    )


@pytest.fixture
def student_token(student_user: User) -> str:
    return create_access_token(
        data={"sub": student_user.username, "user_id": student_user.id, "role": student_user.role.value}
    )


@pytest.fixture
def student_token_2(student_user_2: User) -> str:
    return create_access_token(
        data={"sub": student_user_2.username, "user_id": student_user_2.id, "role": student_user_2.role.value}
    )


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
