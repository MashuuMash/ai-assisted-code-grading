from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.models import AssignmentStatus, User
from tests.conftest import auth_headers


def test_create_and_manage_assignment(
    client: TestClient,
    lecturer_token: str,
    lecturer_token_2: str,
    student_token: str,
    student_user: User,
) -> None:
    # 1. Lecturer creates course and class
    course = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS201", "name": "Python Programming"},
    ).json()

    cohort = client.post(
        f"/api/v1/courses/{course['id']}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "SEC01", "name": "Section 1", "semester": "Fall", "year": 2026},
    ).json()

    # Enroll student in class
    client.post(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/memberships",
        headers=auth_headers(lecturer_token),
        json={"user_id": student_user.id},
    )

    # 2. Lecturer creates draft assignment
    deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    create_res = client.post(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments",
        headers=auth_headers(lecturer_token),
        json={
            "title": "Assignment 1: Basics",
            "description": "Introductory exercises",
            "instructions": "Implement the required functions",
            "language": "python",
            "deadline": deadline,
            "status": AssignmentStatus.DRAFT.value,
            "base_code": "def solution():\n    pass\n",
        },
    )
    assert create_res.status_code == 201
    assignment = create_res.json()
    assignment_id = assignment["id"]
    assert assignment["status"] == AssignmentStatus.DRAFT.value
    assert assignment["base_code"] == "def solution():\n    pass\n"

    # 3. Student cannot see draft assignment in list or detail
    student_list = client.get(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments",
        headers=auth_headers(student_token),
    ).json()
    assert len(student_list) == 0

    student_get = client.get(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments/{assignment_id}",
        headers=auth_headers(student_token),
    )
    assert student_get.status_code == 404

    # 4. Another lecturer cannot update this assignment
    update_fail = client.put(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments/{assignment_id}",
        headers=auth_headers(lecturer_token_2),
        json={"title": "Hacked Assignment"},
    )
    assert update_fail.status_code == 403

    # 5. Lecturer publishes assignment
    publish_res = client.put(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments/{assignment_id}",
        headers=auth_headers(lecturer_token),
        json={"status": AssignmentStatus.PUBLISHED.value},
    )
    assert publish_res.status_code == 200
    assert publish_res.json()["status"] == AssignmentStatus.PUBLISHED.value

    # 6. Student can now see published assignment
    student_list_after = client.get(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments",
        headers=auth_headers(student_token),
    ).json()
    assert len(student_list_after) == 1
    assert student_list_after[0]["id"] == assignment_id

    student_get_after = client.get(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments/{assignment_id}",
        headers=auth_headers(student_token),
    )
    assert student_get_after.status_code == 200
    assert student_get_after.json()["title"] == "Assignment 1: Basics"

    # 7. Lecturer deletes assignment
    del_res = client.delete(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments/{assignment_id}",
        headers=auth_headers(lecturer_token),
    )
    assert del_res.status_code == 204


def test_non_enrolled_student_cannot_access_assignments(
    client: TestClient,
    lecturer_token: str,
    student_token_2: str,
) -> None:
    course = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS202", "name": "Algorithms"},
    ).json()

    cohort = client.post(
        f"/api/v1/courses/{course['id']}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "SEC01", "name": "Section 1", "semester": "Fall", "year": 2026},
    ).json()

    # student_user_2 is NOT enrolled in this class
    res = client.get(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments",
        headers=auth_headers(student_token_2),
    )
    assert res.status_code == 403
