from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User, UserRole
from tests.conftest import auth_headers


def test_registration_creates_student_and_hides_password(client: TestClient, db: Session) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "new@example.com",
            "username": "new.user",
            "full_name": "New User",
            "password": "secure-password-123",
            "role": "admin",
        },
    )
    assert response.status_code == 201
    assert response.json()["role"] == "student"
    assert "password" not in response.json()
    assert db.query(User).filter_by(email="new@example.com").one().hashed_password != "secure-password-123"


def test_invalid_credentials_are_rejected(client: TestClient, student: User) -> None:
    response = client.post("/api/v1/auth/login", json={"email": student.email, "password": "wrong"})
    assert response.status_code == 401


def test_protected_endpoint_requires_valid_token(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_authenticated_user_can_read_profile(client: TestClient, student: User) -> None:
    response = client.get("/api/v1/auth/me", headers=auth_headers(client, student))
    assert response.status_code == 200
    assert response.json()["id"] == student.id


def test_student_cannot_create_course(client: TestClient, student: User) -> None:
    response = client.post("/api/v1/courses", headers=auth_headers(client, student), json={"code": "X", "name": "X"})
    assert response.status_code == 403


def test_roles_are_limited_to_phase_one() -> None:
    assert set(UserRole) == {UserRole.ADMIN, UserRole.LECTURER, UserRole.STUDENT}
