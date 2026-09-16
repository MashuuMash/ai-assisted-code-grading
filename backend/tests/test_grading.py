import io

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    GradingJob,
    GradingJobStatus,
    TestCase,
    TestOutcome,
    TestResult,
    TestVisibility,
    User,
)
from tests.conftest import auth_headers


def setup_assignment_and_submission(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
) -> tuple[int, int, int, int]:
    course = client.post(
        "/api/v1/courses",
        headers=auth_headers(lecturer_token),
        json={"code": "CS401", "name": "Algorithms & Testing"},
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
            "title": "Assignment with Tests",
            "language": "python",
            "status": "published",
        },
    ).json()

    # Student submits solution
    code = b"def add(a, b):\n    return a + b\n"
    files = {"file": ("solution.py", io.BytesIO(code), "text/x-python")}
    sub_res = client.post(
        f"/api/v1/courses/{course['id']}/classes/{cohort['id']}/assignments/{assignment['id']}/submissions",
        headers=auth_headers(student_token),
        files=files,
    ).json()

    return course["id"], cohort["id"], assignment["id"], sub_res["id"]


def test_test_case_crud_and_visibility(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
) -> None:
    c_id, cl_id, a_id, _ = setup_assignment_and_submission(
        client, lecturer_token, student_token, student_user
    )

    # 1. Lecturer creates public test case
    pub_res = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/test-cases",
        headers=auth_headers(lecturer_token),
        json={
            "name": "test_public_add",
            "visibility": TestVisibility.PUBLIC.value,
            "content": "from solution import add\ndef test_public_add(): assert add(1, 2) == 3",
        },
    )
    assert pub_res.status_code == 201
    assert pub_res.json()["visibility"] == "public"

    # 2. Lecturer creates hidden test case
    hid_res = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/test-cases",
        headers=auth_headers(lecturer_token),
        json={
            "name": "test_hidden_negative_numbers",
            "visibility": TestVisibility.HIDDEN.value,
            "content": "from solution import add\ndef test_hidden_negative_numbers(): assert add(-5, -5) == -10",
        },
    )
    assert hid_res.status_code == 201
    assert hid_res.json()["visibility"] == "hidden"

    # 3. Duplicate test name rejected
    dup_res = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/test-cases",
        headers=auth_headers(lecturer_token),
        json={
            "name": "test_public_add",
            "visibility": TestVisibility.PUBLIC.value,
            "content": "assert True",
        },
    )
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # 4. Student listing: hidden test content and name must be masked
    student_cases = client.get(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/test-cases",
        headers=auth_headers(student_token),
    ).json()
    assert len(student_cases) == 2

    public_case = next(c for c in student_cases if c["visibility"] == "public")
    hidden_case = next(c for c in student_cases if c["visibility"] == "hidden")
    assert public_case["content"] is not None
    assert hidden_case["content"] is None
    assert hidden_case["name"] == "Hidden test"

    # 5. Lecturer listing: full content visible for both
    lecturer_cases = client.get(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/test-cases",
        headers=auth_headers(lecturer_token),
    ).json()
    lec_hidden = next(c for c in lecturer_cases if c["visibility"] == "hidden")
    assert lec_hidden["content"] is not None
    assert lec_hidden["name"] == "test_hidden_negative_numbers"


def test_queue_and_inspect_grading_job(
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    student_user: User,
    db: Session,
) -> None:
    c_id, cl_id, a_id, sub_id = setup_assignment_and_submission(
        client, lecturer_token, student_token, student_user
    )

    # Add 1 public test and 1 hidden test to assignment
    tc_pub = TestCase(
        assignment_id=a_id,
        name="test_pub",
        visibility=TestVisibility.PUBLIC,
        content="assert True",
    )
    tc_hid = TestCase(
        assignment_id=a_id,
        name="test_secret_edge_case",
        visibility=TestVisibility.HIDDEN,
        content="assert False, 'Secret failure clue'",
    )
    db.add_all([tc_pub, tc_hid])
    db.commit()
    db.refresh(tc_pub)
    db.refresh(tc_hid)

    # Student queues grading job
    queue_res = client.post(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions/{sub_id}/grade",
        headers=auth_headers(student_token),
    )
    assert queue_res.status_code == 202
    job_id = queue_res.json()["id"]
    assert queue_res.json()["status"] == GradingJobStatus.QUEUED.value

    # Simulate completed worker results
    job = db.get(GradingJob, job_id)
    assert job is not None
    job.status = GradingJobStatus.COMPLETED
    job.total_tests = 2
    job.passed_tests = 1
    job.failed_tests = 1
    job.runner_output = "Pytest execution trace with private details"
    job.results.append(
        TestResult(
            test_case_id=tc_pub.id,
            test_name="test_pub",
            outcome=TestOutcome.PASSED,
            duration_ms=12,
        )
    )
    job.results.append(
        TestResult(
            test_case_id=tc_hid.id,
            test_name="test_secret_edge_case",
            outcome=TestOutcome.FAILED,
            duration_ms=15,
            failure_type="assertion_failure",
            failure_detail="AssertionError: Secret failure clue",
        )
    )
    db.commit()

    # Student inspects job details: hidden test details and runner_output must be redacted
    student_view = client.get(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions/{sub_id}/jobs/{job_id}",
        headers=auth_headers(student_token),
    ).json()

    assert student_view["runner_output"] is None
    student_results = student_view["results"]
    assert len(student_results) == 2

    pub_result = next(r for r in student_results if r["test_case_id"] == tc_pub.id)
    assert pub_result["test_name"] == "test_pub"
    assert pub_result["outcome"] == "passed"

    hid_result = next(r for r in student_results if r["test_case_id"] == tc_hid.id)
    assert hid_result["test_name"] == "Hidden test #1"
    assert hid_result["outcome"] == "failed"
    assert hid_result["failure_detail"] is None
    assert hid_result["failure_type"] is None

    # Lecturer inspects job details: complete unmasked results
    lec_view = client.get(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions/{sub_id}/jobs/{job_id}",
        headers=auth_headers(lecturer_token),
    ).json()

    assert lec_view["runner_output"] == "Pytest execution trace with private details"
    lec_hid_result = next(r for r in lec_view["results"] if r["test_case_id"] == tc_hid.id)
    assert lec_hid_result["test_name"] == "test_secret_edge_case"
    assert "Secret failure clue" in lec_hid_result["failure_detail"]
