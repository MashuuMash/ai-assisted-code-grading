from fastapi.testclient import TestClient

from app.models import User, UserRole
from tests.conftest import auth_headers


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_register_student_success(client: TestClient) -> None:
    payload = {
        "email": "newstudent@example.edu",
        "username": "newstudent",
        "full_name": "New Student",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["username"] == payload["username"]
    assert data["role"] == UserRole.STUDENT.value
    assert "password" not in data


def test_register_duplicate_email(client: TestClient, student_user: User) -> None:
    payload = {
        "email": student_user.email,
        "username": "uniquename",
        "full_name": "Duplicate Email",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "Email is already registered" in response.json()["detail"]


def test_register_duplicate_username(client: TestClient, student_user: User) -> None:
    payload = {
        "email": "unique@example.edu",
        "username": student_user.username,
        "full_name": "Duplicate Username",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "Username is already taken" in response.json()["detail"]


def test_login_oauth2_form_success(client: TestClient, student_user: User) -> None:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": student_user.username, "password": "StudentPass123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_json_success(client: TestClient, student_user: User) -> None:
    response = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": student_user.email, "password": "StudentPass123!"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_invalid_password(client: TestClient, student_user: User) -> None:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": student_user.username, "password": "WrongPassword"},
    )
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


def test_login_nonexistent_user(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "nosuchuser", "password": "Password123!"},
    )
    assert response.status_code == 401


def test_get_me_success(client: TestClient, student_token: str, student_user: User) -> None:
    response = client.get("/api/v1/auth/me", headers=auth_headers(student_token))
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == student_user.id
    assert data["username"] == student_user.username


def test_get_me_unauthorized(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
