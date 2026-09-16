from fastapi.testclient import TestClient

from app.models import User
from tests.conftest import auth_headers


def test_unique_course_code_constraint(client: TestClient, lecturer_token: str) -> None:
    client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "UNIQUE101", "name": "Unique Course 1"},
    )
    dup_res = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "UNIQUE101", "name": "Unique Course 2"},
    )
    assert dup_res.status_code == 400
    assert "Course with this code already exists" in dup_res.json()["detail"]


def test_unique_class_code_within_course(client: TestClient, lecturer_token: str) -> None:
    c = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "UNIQUE102", "name": "Unique Course"},
    ).json()

    client.post(
        f"/api/v1/courses/{c['id']}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "SEC01", "name": "Section 1", "semester": "Fall", "year": 2026},
    )
    dup_cl = client.post(
        f"/api/v1/courses/{c['id']}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "SEC01", "name": "Section 1 Duplicate", "semester": "Fall", "year": 2026},
    )
    assert dup_cl.status_code == 400
    assert "Class code already exists in this course" in dup_cl.json()["detail"]


def test_duplicate_student_membership_constraint(
    client: TestClient,
    lecturer_token: str,
    student_user: User,
) -> None:
    c = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "UNIQUE103", "name": "Unique Course"},
    ).json()

    cl = client.post(
        f"/api/v1/courses/{c['id']}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "SEC01", "name": "Section 1", "semester": "Fall", "year": 2026},
    ).json()

    res1 = client.post(
        f"/api/v1/courses/{c['id']}/classes/{cl['id']}/memberships",
        headers=auth_headers(lecturer_token),
        json={"user_id": student_user.id},
    )
    assert res1.status_code == 201

    res2 = client.post(
        f"/api/v1/courses/{c['id']}/classes/{cl['id']}/memberships",
        headers=auth_headers(lecturer_token),
        json={"user_id": student_user.id},
    )
    assert res2.status_code == 400
    assert "Student is already enrolled in this class" in res2.json()["detail"]
