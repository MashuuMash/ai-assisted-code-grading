from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from tests.conftest import auth_headers


def test_student_cannot_create_course(client: TestClient, student_token: str) -> None:
    response = client.post(
        "/api/v1/courses",
        headers=auth_headers(student_token),
        json={"code": "CS101", "name": "Intro to CS", "description": "Basics"},
    )
    assert response.status_code == 403


def test_lecturer_can_create_course(client: TestClient, lecturer_token: str) -> None:
    response = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS101", "name": "Intro to CS", "description": "Basics"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "CS101"


def test_lecturer_cannot_update_others_course(
    client: TestClient,
    lecturer_token: str,
    lecturer_token_2: str,
) -> None:
    # Lecturer 1 creates course
    create_res = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS101", "name": "Intro to CS"},
    )
    course_id = create_res.json()["id"]

    # Lecturer 2 attempts to update
    res = client.put(
        f"/api/v1/courses/{course_id}",
        headers=auth_headers(lecturer_token_2),
        json={"name": "Hacked Course Name"},
    )
    assert res.status_code == 403


def test_admin_can_manage_any_course(
    client: TestClient,
    lecturer_token: str,
    admin_token: str,
) -> None:
    create_res = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS102", "name": "Data Structures"},
    )
    course_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/v1/courses/{course_id}",
        headers=auth_headers(admin_token),
        json={"name": "Data Structures (Admin Updated)"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Data Structures (Admin Updated)"


def test_student_course_and_class_access(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
    db: Session,
) -> None:
    # 1. Lecturer creates course and class
    c_res = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS103", "name": "Algorithms"},
    )
    course_id = c_res.json()["id"]

    cl_res = client.post(
        f"/api/v1/courses/{course_id}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "CL01", "name": "Class 1", "semester": "Fall", "year": 2026},
    )
    class_id = cl_res.json()["id"]

    # 2. Before enrollment: Student cannot view course or class
    view_c = client.get(f"/api/v1/courses/{course_id}", headers=auth_headers(student_token))
    assert view_c.status_code == 403

    view_cl = client.get(
        f"/api/v1/courses/{course_id}/classes/{class_id}",
        headers=auth_headers(student_token),
    )
    assert view_cl.status_code == 403

    # 3. Lecturer enrolls student
    add_mem = client.post(
        f"/api/v1/courses/{course_id}/classes/{class_id}/memberships",
        headers=auth_headers(lecturer_token),
        json={"user_id": student_user.id},
    )
    assert add_mem.status_code == 201

    # 4. After enrollment: Student can view course and class
    view_c_after = client.get(f"/api/v1/courses/{course_id}", headers=auth_headers(student_token))
    assert view_c_after.status_code == 200

    view_cl_after = client.get(
        f"/api/v1/courses/{course_id}/classes/{class_id}",
        headers=auth_headers(student_token),
    )
    assert view_cl_after.status_code == 200


def test_enroll_only_student_role(
    client: TestClient,
    lecturer_token: str,
    lecturer_user_2: User,
) -> None:
    c_res = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS104", "name": "Databases"},
    )
    course_id = c_res.json()["id"]

    cl_res = client.post(
        f"/api/v1/courses/{course_id}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "CL01", "name": "Class 1", "semester": "Spring", "year": 2026},
    )
    class_id = cl_res.json()["id"]

    # Try to enroll another lecturer as student
    add_mem = client.post(
        f"/api/v1/courses/{course_id}/classes/{class_id}/memberships",
        headers=auth_headers(lecturer_token),
        json={"user_id": lecturer_user_2.id},
    )
    assert add_mem.status_code == 400
    assert "Only users with the STUDENT role can be enrolled" in add_mem.json()["detail"]


def test_cross_course_idor_protection(
    client: TestClient,
    lecturer_token: str,
) -> None:
    # Course A with Class A
    c1 = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS105", "name": "Course A"},
    ).json()
    cl1 = client.post(
        f"/api/v1/courses/{c1['id']}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "CL01", "name": "Class A", "semester": "Fall", "year": 2026},
    ).json()

    # Course B
    c2 = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS106", "name": "Course B"},
    ).json()

    # Accessing Class A under Course B URL must fail with 404
    res = client.get(
        f"/api/v1/courses/{c2['id']}/classes/{cl1['id']}",
        headers=auth_headers(lecturer_token),
    )
    assert res.status_code == 404
    assert "Class not found in this course" in res.json()["detail"]
