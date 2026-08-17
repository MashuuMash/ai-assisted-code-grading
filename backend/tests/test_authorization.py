from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Class, Course, User
from tests.conftest import auth_headers


def test_lecturer_can_manage_owned_course_and_class(
    client: TestClient, lecturer: User, course: Course, class_: Class
) -> None:
    headers = auth_headers(client, lecturer)
    assert client.patch(f"/api/v1/courses/{course.id}", headers=headers, json={"name": "Updated"}).status_code == 200
    assert (
        client.patch(
            f"/api/v1/courses/{course.id}/classes/{class_.id}", headers=headers, json={"name": "Updated cohort"}
        ).status_code
        == 200
    )


def test_other_lecturer_cannot_access_course_or_class(
    client: TestClient, other_lecturer: User, course: Course, class_: Class
) -> None:
    headers = auth_headers(client, other_lecturer)
    assert client.get(f"/api/v1/courses/{course.id}", headers=headers).status_code == 403
    assert client.get(f"/api/v1/courses/{course.id}/classes/{class_.id}", headers=headers).status_code == 403
    assert client.patch(f"/api/v1/courses/{course.id}", headers=headers, json={"name": "Stolen"}).status_code == 403


def test_enrolled_student_sees_only_permitted_course_and_class(
    client: TestClient, db: Session, student: User, course: Course, class_: Class, membership: object
) -> None:
    other_course = Course(code="CS999", name="Private", instructor_id=course.instructor_id)
    db.add(other_course)
    db.commit()
    headers = auth_headers(client, student)
    courses = client.get("/api/v1/courses", headers=headers).json()
    classes = client.get(f"/api/v1/courses/{course.id}/classes", headers=headers).json()
    assert [item["id"] for item in courses] == [course.id]
    assert [item["id"] for item in classes] == [class_.id]
    assert client.get(f"/api/v1/courses/{course.id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/courses/{course.id}/classes/{class_.id}", headers=headers).status_code == 200


def test_unenrolled_student_cannot_access_course_or_class(
    client: TestClient, other_student: User, course: Course, class_: Class
) -> None:
    headers = auth_headers(client, other_student)
    assert client.get(f"/api/v1/courses/{course.id}", headers=headers).status_code == 403
    assert client.get(f"/api/v1/courses/{course.id}/classes/{class_.id}", headers=headers).status_code == 403


def test_nested_class_id_cannot_cross_course_boundary(
    client: TestClient, db: Session, lecturer: User, course: Course, class_: Class
) -> None:
    other_course = Course(code="CS202", name="Other", instructor_id=lecturer.id)
    db.add(other_course)
    db.commit()
    response = client.get(
        f"/api/v1/courses/{other_course.id}/classes/{class_.id}", headers=auth_headers(client, lecturer)
    )
    assert response.status_code == 404


def test_only_students_can_be_added_as_members(
    client: TestClient, lecturer: User, other_lecturer: User, course: Course, class_: Class
) -> None:
    response = client.post(
        f"/api/v1/courses/{course.id}/classes/{class_.id}/memberships/{other_lecturer.id}",
        headers=auth_headers(client, lecturer),
    )
    assert response.status_code == 404
