import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User, UserRole
from tests.conftest import auth_headers


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_register_student_success(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr("app.routes.auth.send_otp_email", lambda *a, **kw: True)
    payload = {
        "email": "newlecturer@example.edu",
        "username": "newlecturer",
        "full_name": "New Lecturer",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["username"] == payload["username"]
    assert data["role"] == UserRole.LECTURER.value
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


def test_login_inactive_account_includes_contact_email(
    client: TestClient, db, student_user: User
) -> None:
    student_user.is_active = False
    db.commit()

    response = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": student_user.email, "password": "StudentPass123!"},
    )
    assert response.status_code == 403
    detail = response.json()["detail"]
    assert "deactivated" in detail.lower()
    assert "@" in detail


def test_get_me_success(client: TestClient, student_token: str, student_user: User) -> None:
    response = client.get("/api/v1/auth/me", headers=auth_headers(student_token))
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == student_user.id
    assert data["username"] == student_user.username


def test_get_me_unauthorized(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_register_otp_verification_and_login_flow(client: TestClient, monkeypatch) -> None:
    captured_otp: dict[str, str] = {}

    def fake_send_otp_email(recipient_email: str, full_name: str, username: str, otp_code: str) -> bool:
        captured_otp["code"] = otp_code
        return True

    monkeypatch.setattr("app.routes.auth.send_otp_email", fake_send_otp_email)

    payload = {
        "email": "otp_instructor@university.edu",
        "username": "otp_instructor",
        "full_name": "Dr. OTP Lecturer",
        "password": "Password123!",
    }
    reg_res = client.post("/api/v1/auth/register", json=payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["is_email_verified"] is False
    assert reg_data["otp_required"] is True
    assert "dev_otp_code" not in reg_data
    otp_code = captured_otp["code"]
    assert otp_code and len(otp_code) == 6 and otp_code.isdigit()

    # Re-registering an unverified email replaces the pending OTP instead of throwing 400
    retry_res = client.post("/api/v1/auth/register", json=payload)
    assert retry_res.status_code == 201
    otp_code = captured_otp["code"]

    # Login before verifying OTP must return 403
    unverified_login = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": payload["email"], "password": payload["password"]},
    )
    assert unverified_login.status_code == 403
    assert "verification required" in unverified_login.json()["detail"].lower()

    # Invalid OTP code must return 400
    wrong_otp = "000000" if otp_code != "000000" else "999999"
    bad_verify = client.post(
        "/api/v1/auth/verify-otp",
        json={"email_or_username": payload["email"], "otp_code": wrong_otp},
    )
    assert bad_verify.status_code == 400

    # Valid OTP code verifies account and returns JWT access_token
    ok_verify = client.post(
        "/api/v1/auth/verify-otp",
        json={"email_or_username": payload["email"], "otp_code": otp_code},
    )
    assert ok_verify.status_code == 200
    token_data = ok_verify.json()
    assert "access_token" in token_data

    # Subsequent login succeeds
    verified_login = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": payload["email"], "password": payload["password"]},
    )
    assert verified_login.status_code == 200


def test_resend_otp_and_html_logo_template(client: TestClient) -> None:
    from app.email_service import build_otp_email_html

    html_out = build_otp_email_html(
        full_name="Dr. Tran Thi B",
        username="tranthib",
        otp_code="482915",
        expire_minutes=10,
        has_inline_logo=True,
    )
    assert "cid:veripie_logo" in html_out
    assert "4 8 2 9 1 5" in html_out
    assert "Dr. Tran Thi B" in html_out


def test_username_and_password_validation_constraints(client: TestClient) -> None:
    # 1. Username with spaces rejected
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "u1@test.edu", "username": "bad user", "full_name": "User", "password": "Password123!"},
    )
    assert res.status_code == 422

    # 2. Username with '@' symbol rejected
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "u2@test.edu", "username": "bad@user", "full_name": "User", "password": "Password123!"},
    )
    assert res.status_code == 422

    # 3. Password without uppercase rejected
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "u3@test.edu", "username": "valid_user_1", "full_name": "User", "password": "password123!"},
    )
    assert res.status_code == 422

    # 4. Password without digit rejected
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "u4@test.edu", "username": "valid_user_2", "full_name": "User", "password": "Password!!!"},
    )
    assert res.status_code == 422

    # 5. Password without special char rejected
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "u5@test.edu", "username": "valid_user_3", "full_name": "User", "password": "Password1234"},
    )
    assert res.status_code == 422


def test_update_profile_and_change_password(client: TestClient, student_token: str, student_user: User) -> None:
    headers = auth_headers(student_token)

    # 1. Update full_name
    update_res = client.patch("/api/v1/auth/me", headers=headers, json={"full_name": "Updated Student Name"})
    assert update_res.status_code == 200
    assert update_res.json()["full_name"] == "Updated Student Name"

    # 2. Change password with wrong current password -> 400
    bad_current = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "WrongPassword123!", "new_password": "NewStrongPass999@"},
    )
    assert bad_current.status_code == 400
    assert "Current password is incorrect" in bad_current.json()["detail"]

    # 3. Change password with same password -> 400
    same_pass = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "StudentPass123!", "new_password": "StudentPass123!"},
    )
    assert same_pass.status_code == 400
    assert "same as your current" in same_pass.json()["detail"].lower()

    # 4. Change password with weak password -> 422
    weak_pass = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "StudentPass123!", "new_password": "short"},
    )
    assert weak_pass.status_code == 422

    # 5. Change password successfully -> 200
    good_change = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "StudentPass123!", "new_password": "BrandNewSecret789#"},
    )
    assert good_change.status_code == 200
    assert good_change.json()["message"] == "Password changed successfully"

    # 6. Verify old password no longer works
    old_login = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": student_user.username, "password": "StudentPass123!"},
    )
    assert old_login.status_code == 401

    # 7. Verify new password works
    new_login = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": student_user.username, "password": "BrandNewSecret789#"},
    )
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()


def test_forgot_password_and_reset_password_flow(
    client: TestClient, student_user: User, db: Session, monkeypatch: pytest.MonkeyPatch
):
    captured_otps: list[tuple[str, str, str]] = []

    def mock_send_otp_email(recipient_email: str, full_name: str, username: str, otp_code: str, purpose: str = "register"):
        captured_otps.append((recipient_email, otp_code, purpose))
        return True

    monkeypatch.setattr("app.routes.auth.send_otp_email", mock_send_otp_email)

    # 1. Nonexistent account -> anti-enumeration returns 200 without email_hint
    nonexistent = client.post(
        "/api/v1/auth/forgot-password",
        json={"email_or_username": "ghost_user_404@example.com"},
    )
    assert nonexistent.status_code == 200
    assert "If an account" in nonexistent.json()["message"]
    assert nonexistent.json().get("email_hint") is None
    assert len(captured_otps) == 0

    # 2. Existing account -> 200, sends email with purpose="reset_password" and returns masked email_hint
    forgot_res = client.post(
        "/api/v1/auth/forgot-password",
        json={"email_or_username": student_user.username},
    )
    assert forgot_res.status_code == 200
    assert "password reset verification code" in forgot_res.json()["message"].lower()
    assert forgot_res.json().get("email_hint") is not None
    assert len(captured_otps) == 1
    recipient, reset_otp, purpose = captured_otps[0]
    assert recipient == student_user.email
    assert len(reset_otp) == 6
    assert purpose == "reset_password"

    # 3. Reset password with wrong OTP -> 400
    bad_otp_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email_or_username": student_user.email,
            "otp_code": "000000",
            "new_password": "NewResetPass888!",
        },
    )
    assert bad_otp_res.status_code == 400
    assert "invalid verification code" in bad_otp_res.json()["detail"].lower()

    # 4. Reset password with weak password -> 422
    weak_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email_or_username": student_user.email,
            "otp_code": reset_otp,
            "new_password": "short",
        },
    )
    assert weak_res.status_code == 422

    # 5. Reset password with same password as current -> 400
    same_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email_or_username": student_user.email,
            "otp_code": reset_otp,
            "new_password": "StudentPass123!",
        },
    )
    assert same_res.status_code == 400
    assert "same as your old password" in same_res.json()["detail"].lower()

    # 6. Reset password with correct OTP and strong new password -> 200 with access_token
    reset_success = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email_or_username": student_user.email,
            "otp_code": reset_otp,
            "new_password": "CompletelyNewSecret123#",
        },
    )
    assert reset_success.status_code == 200
    assert "Password reset successfully" in reset_success.json()["message"]
    assert "access_token" in reset_success.json()

    # 7. Old password no longer works
    old_login = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": student_user.username, "password": "StudentPass123!"},
    )
    assert old_login.status_code == 401

    # 8. New password works
    new_login = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": student_user.username, "password": "CompletelyNewSecret123#"},
    )
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()


def test_security_headers_and_login_rate_limit(client: TestClient) -> None:
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.headers.get("x-content-type-options") == "nosniff"
    assert health_res.headers.get("x-frame-options") == "DENY"
    assert "strict-origin-when-cross-origin" in (health_res.headers.get("referrer-policy") or "")

    headers = {"X-Forwarded-For": "203.0.113.55"}
    for _ in range(20):
        res = client.post(
            "/api/v1/auth/login/json",
            json={"username_or_email": "unknown", "password": "BadPassword1!"},
            headers=headers,
        )
        assert res.status_code == 401

    blocked = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": "unknown", "password": "BadPassword1!"},
        headers=headers,
    )
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


