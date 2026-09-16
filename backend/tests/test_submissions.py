import io
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.models import AssignmentStatus, User
from tests.conftest import auth_headers


def setup_test_assignment(
    client: TestClient,
    lecturer_token: str,
    student_user: User,
    assignment_status: AssignmentStatus = AssignmentStatus.PUBLISHED,
    deadline: datetime | None = None,
) -> tuple[int, int, int]:
    course = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": f"CS301_{datetime.now().timestamp()}", "name": "Testing Submissions"},
    ).json()

    cohort = client.post(
        f"/api/v1/courses/{course['id']}/classes",
        headers=auth_headers(lecturer_token),
        json={"code": "SEC01", "name": "Section 1", "semester": "Fall", "year": 2026},
    ).json()

    client.post(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/memberships",
        headers=auth_headers(lecturer_token),
        json={"user_id": student_user.id},
    )

    assignment = client.post(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments",
        headers=auth_headers(lecturer_token),
        json={
            "title": "Lab 1",
            "language": "python",
            "status": assignment_status.value,
            "deadline": deadline.isoformat() if deadline else None,
        },
    ).json()

    return course["id"], cohort["id"], assignment["id"]


def test_submit_valid_python_file(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
) -> None:
    course_id, class_id, assignment_id = setup_test_assignment(client, lecturer_token, student_user)

    code_content = b"def solution(a, b):\n    return a + b\n"
    files = {"file": ("solution.py", io.BytesIO(code_content), "text/x-python")}

    res = client.post(
        f"/api/v1/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}/submissions",
        headers=auth_headers(student_token),
        files=files,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["original_filename"] == "solution.py"
    assert data["student_id"] == student_user.id
    assert data["size_bytes"] == len(code_content)
    submission_id = data["id"]

    # Student can get submission detail and source
    sub_detail = client.get(
        f"/api/v1/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}/submissions/{submission_id}",
        headers=auth_headers(student_token),
    )
    assert sub_detail.status_code == 200

    source_res = client.get(
        f"/api/v1/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}/submissions/{submission_id}/source",
        headers=auth_headers(student_token),
    )
    assert source_res.status_code == 200
    assert source_res.content == code_content


def test_cannot_submit_to_draft_or_closed_assignment(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
) -> None:
    # Draft assignment
    c_id, cl_id, draft_id = setup_test_assignment(
        client, lecturer_token, student_user, assignment_status=AssignmentStatus.DRAFT
    )
    files = {"file": ("sol.py", io.BytesIO(b"print(1)"), "text/x-python")}
    res = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{draft_id}/submissions",
        headers=auth_headers(student_token),
        files=files,
    )
    assert res.status_code == 400
    assert "draft" in res.json()["detail"]


def test_cannot_submit_past_deadline(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
) -> None:
    past_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
    c_id, cl_id, a_id = setup_test_assignment(
        client, lecturer_token, student_user, deadline=past_deadline
    )

    files = {"file": ("sol.py", io.BytesIO(b"print(1)"), "text/x-python")}
    res = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions",
        headers=auth_headers(student_token),
        files=files,
    )
    assert res.status_code == 400
    assert "deadline has passed" in res.json()["detail"]


def test_reject_empty_file_and_null_bytes(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
) -> None:
    c_id, cl_id, a_id = setup_test_assignment(client, lecturer_token, student_user)

    # Empty file
    files_empty = {"file": ("sol.py", io.BytesIO(b""), "text/x-python")}
    res_empty = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions",
        headers=auth_headers(student_token),
        files=files_empty,
    )
    assert res_empty.status_code == 422
    assert "empty" in res_empty.json()["detail"]

    # Null bytes
    files_null = {"file": ("sol.py", io.BytesIO(b"def test():\x00pass"), "text/x-python")}
    res_null = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions",
        headers=auth_headers(student_token),
        files=files_null,
    )
    assert res_null.status_code == 422
    assert "null bytes" in res_null.json()["detail"]


def test_reject_non_python_extension(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
) -> None:
    c_id, cl_id, a_id = setup_test_assignment(client, lecturer_token, student_user)

    files = {"file": ("malicious.sh", io.BytesIO(b"echo hello"), "text/plain")}
    res = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions",
        headers=auth_headers(student_token),
        files=files,
    )
    assert res.status_code == 415


def test_cross_student_submission_isolation(
    client: TestClient,
    lecturer_token: str,
    lecturer_token_2: str,
    student_token: str,
    student_token_2: str,
    student_user: User,
    student_user_2: User,
) -> None:
    c_id, cl_id, a_id = setup_test_assignment(client, lecturer_token, student_user)

    # Enroll second student as well
    client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/memberships",
        headers=auth_headers(lecturer_token),
        json={"user_id": student_user_2.id},
    )

    # Student 1 submits
    files = {"file": ("student1.py", io.BytesIO(b"val = 1\n"), "text/x-python")}
    res1 = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions",
        headers=auth_headers(student_token),
        files=files,
    )
    sub1_id = res1.json()["id"]

    # Student 2 tries to view/download Student 1's submission (must be 403)
    s2_view = client.get(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions/{sub1_id}",
        headers=auth_headers(student_token_2),
    )
    assert s2_view.status_code == 403

    s2_source = client.get(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions/{sub1_id}/source",
        headers=auth_headers(student_token_2),
    )
    assert s2_source.status_code == 403

    # Lecturer 1 (course owner) can view and download
    lec1_source = client.get(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions/{sub1_id}/source",
        headers=auth_headers(lecturer_token),
    )
    assert lec1_source.status_code == 200

    # Lecturer 2 (different lecturer) cannot access
    lec2_source = client.get(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions/{sub1_id}/source",
        headers=auth_headers(lecturer_token_2),
    )
    assert lec2_source.status_code == 403
