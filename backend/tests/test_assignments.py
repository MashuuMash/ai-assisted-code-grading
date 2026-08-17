from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Assignment, AssignmentStatus, Class, Course, User
from tests.conftest import auth_headers


def assignment_url(course: Course, class_: Class) -> str:
    return f"/api/v1/courses/{course.id}/classes/{class_.id}/assignments"


def test_owner_can_create_and_manage_assignment(
    client: TestClient, lecturer: User, course: Course, class_: Class
) -> None:
    response = client.post(
        assignment_url(course, class_),
        headers=auth_headers(client, lecturer),
        json={
            "title": "Loops",
            "description": "Practice loops",
            "instructions": "Submit solution.py",
            "language": "python",
            "status": "draft",
        },
    )
    assert response.status_code == 201
    assignment_id = response.json()["id"]
    updated = client.patch(
        f"{assignment_url(course, class_)}/{assignment_id}",
        headers=auth_headers(client, lecturer),
        json={"status": "published"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "published"


def test_assignment_language_is_restricted_to_python(
    client: TestClient, lecturer: User, course: Course, class_: Class
) -> None:
    response = client.post(
        assignment_url(course, class_),
        headers=auth_headers(client, lecturer),
        json={"title": "Wrong language", "language": "javascript"},
    )
    assert response.status_code == 422


def test_non_owner_cannot_manage_assignment(
    client: TestClient, other_lecturer: User, course: Course, class_: Class
) -> None:
    response = client.post(
        assignment_url(course, class_),
        headers=auth_headers(client, other_lecturer),
        json={"title": "Unauthorized"},
    )
    assert response.status_code == 403


def test_student_sees_published_but_not_draft_assignments(
    client: TestClient,
    db: Session,
    student: User,
    membership: object,
    course: Course,
    class_: Class,
    assignment: Assignment,
) -> None:
    db.add(Assignment(class_id=class_.id, title="Hidden", status=AssignmentStatus.DRAFT))
    db.commit()
    response = client.get(assignment_url(course, class_), headers=auth_headers(client, student))
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [assignment.id]


def test_unenrolled_student_cannot_view_assignments(
    client: TestClient, other_student: User, course: Course, class_: Class
) -> None:
    response = client.get(assignment_url(course, class_), headers=auth_headers(client, other_student))
    assert response.status_code == 403
