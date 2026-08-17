from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Assignment, Class, Course, Submission, User
from tests.conftest import TEST_STORAGE_PATH, auth_headers


def submissions_url(course: Course, class_: Class, assignment: Assignment) -> str:
    return f"/api/v1/courses/{course.id}/classes/{class_.id}/assignments/{assignment.id}/submissions"


def submit(client: TestClient, url: str, user: User, filename: str = "solution.py", content: bytes = b"print('ok')\n"):
    return client.post(
        url,
        headers=auth_headers(client, user),
        files={"source": (filename, content, "text/x-python")},
    )


def test_student_submits_python_source_with_generated_storage_name(
    client: TestClient,
    db: Session,
    student: User,
    membership: object,
    course: Course,
    class_: Class,
    assignment: Assignment,
) -> None:
    response = submit(client, submissions_url(course, class_, assignment), student, "my solution.py")
    assert response.status_code == 201
    record = db.get(Submission, response.json()["id"])
    assert record is not None
    assert record.original_filename == "my_solution.py"
    assert record.storage_key != record.original_filename
    assert Path(TEST_STORAGE_PATH, record.storage_key).read_bytes() == b"print('ok')\n"


def test_upload_rejects_traversal_wrong_extension_and_oversize(
    client: TestClient,
    student: User,
    membership: object,
    course: Course,
    class_: Class,
    assignment: Assignment,
) -> None:
    url = submissions_url(course, class_, assignment)
    assert submit(client, url, student, "../../escape.py").status_code == 422
    assert submit(client, url, student, "solution.txt").status_code == 415
    assert submit(client, url, student, content=b"x" * 65).status_code == 413
    wrong_type = client.post(
        url,
        headers=auth_headers(client, student),
        files={"source": ("solution.py", b"print('ok')", "image/png")},
    )
    assert wrong_type.status_code == 415
    assert not Path("escape.py").exists()


def test_unenrolled_student_cannot_submit(
    client: TestClient, other_student: User, course: Course, class_: Class, assignment: Assignment
) -> None:
    response = submit(client, submissions_url(course, class_, assignment), other_student)
    assert response.status_code == 403


def test_closed_or_expired_assignment_rejects_submission(
    client: TestClient,
    db: Session,
    student: User,
    membership: object,
    course: Course,
    class_: Class,
    assignment: Assignment,
) -> None:
    assignment.deadline = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()
    response = submit(client, submissions_url(course, class_, assignment), student)
    assert response.status_code == 409


def test_lecturer_sees_all_and_student_sees_only_own_submissions(
    client: TestClient,
    db: Session,
    lecturer: User,
    student: User,
    other_student: User,
    membership: object,
    course: Course,
    class_: Class,
    assignment: Assignment,
) -> None:
    from app.models import ClassMembership

    db.add(ClassMembership(class_id=class_.id, user_id=other_student.id))
    db.commit()
    url = submissions_url(course, class_, assignment)
    first = submit(client, url, student).json()
    submit(client, url, other_student, "other.py", b"print('other')\n")
    lecturer_results = client.get(url, headers=auth_headers(client, lecturer)).json()
    student_results = client.get(url, headers=auth_headers(client, student)).json()
    assert len(lecturer_results) == 2
    assert [item["id"] for item in student_results] == [first["id"]]
    other_submission = next(item for item in lecturer_results if item["student_id"] == other_student.id)
    other_source = f"{url}/{other_submission['id']}/source"
    assert client.get(other_source, headers=auth_headers(client, student)).status_code == 404
    assert client.get(other_source, headers=auth_headers(client, lecturer)).status_code == 200


def test_other_lecturer_cannot_list_submissions(
    client: TestClient,
    other_lecturer: User,
    course: Course,
    class_: Class,
    assignment: Assignment,
) -> None:
    response = client.get(
        submissions_url(course, class_, assignment),
        headers=auth_headers(client, other_lecturer),
    )
    assert response.status_code == 403
