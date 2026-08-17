from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.grading_jobs import transition_job
from app.models import (
    Assignment,
    Class,
    Course,
    GradingJob,
    GradingJobStatus,
    Submission,
    User,
)
from app.models import (
    TestCase as GradingTestCase,
)
from app.models import (
    TestOutcome as GradingTestOutcome,
)
from app.models import (
    TestResult as GradingTestResult,
)
from tests.conftest import auth_headers


def base_url(course: Course, class_: Class, assignment: Assignment) -> str:
    return f"/api/v1/courses/{course.id}/classes/{class_.id}/assignments/{assignment.id}"


def test_grading_job_lifecycle_rejects_invalid_transitions(submission: Submission) -> None:
    job = GradingJob(submission_id=submission.id, status=GradingJobStatus.QUEUED)
    transition_job(job, GradingJobStatus.RUNNING)
    assert job.started_at is not None
    transition_job(job, GradingJobStatus.COMPLETED)
    assert job.completed_at is not None
    try:
        transition_job(job, GradingJobStatus.RUNNING)
    except ValueError:
        pass
    else:
        raise AssertionError("terminal grading job transitioned unexpectedly")


def test_hidden_test_content_is_never_returned_to_student(
    client: TestClient,
    student: User,
    membership: object,
    course: Course,
    class_: Class,
    assignment: Assignment,
    public_test: GradingTestCase,
    hidden_test: GradingTestCase,
) -> None:
    response = client.get(f"{base_url(course, class_, assignment)}/test-cases", headers=auth_headers(client, student))
    assert response.status_code == 200
    by_visibility = {item["visibility"]: item for item in response.json()}
    assert by_visibility["public"]["content"] == public_test.content
    assert by_visibility["hidden"]["content"] is None
    assert by_visibility["hidden"]["name"] == "Hidden test"
    assert hidden_test.name not in response.text
    assert hidden_test.content not in response.text


def test_only_course_owner_can_configure_tests(
    client: TestClient,
    lecturer: User,
    other_lecturer: User,
    course: Course,
    class_: Class,
    assignment: Assignment,
) -> None:
    url = f"{base_url(course, class_, assignment)}/test-cases"
    payload = {"name": "public", "visibility": "public", "content": "def test_ok(): assert True"}
    assert client.post(url, headers=auth_headers(client, lecturer), json=payload).status_code == 201
    payload["name"] = "unauthorized"
    assert client.post(url, headers=auth_headers(client, other_lecturer), json=payload).status_code == 403


def test_lecturer_queues_job_and_cross_user_cannot_access_it(
    client: TestClient,
    db: Session,
    lecturer: User,
    student: User,
    other_student: User,
    membership: object,
    course: Course,
    class_: Class,
    assignment: Assignment,
    submission: Submission,
    public_test: GradingTestCase,
) -> None:
    url = f"{base_url(course, class_, assignment)}/submissions/{submission.id}/grading-jobs"
    queued = client.post(url, headers=auth_headers(client, lecturer))
    assert queued.status_code == 202
    assert queued.json()["status"] == "queued"
    assert client.get(url, headers=auth_headers(client, student)).status_code == 200
    assert client.get(url, headers=auth_headers(client, other_student)).status_code == 404


def test_student_result_hides_hidden_evidence(
    client: TestClient,
    db: Session,
    student: User,
    membership: object,
    course: Course,
    class_: Class,
    assignment: Assignment,
    submission: Submission,
    hidden_test: GradingTestCase,
) -> None:
    job = GradingJob(
        submission_id=submission.id,
        status=GradingJobStatus.COMPLETED,
        total_tests=1,
        failed_tests=1,
        failure_information="internal only",
        runner_output="secret output",
    )
    job.results.append(
        GradingTestResult(
            test_case_id=hidden_test.id,
            test_name="test_secret_value_99",
            outcome=GradingTestOutcome.FAILED,
            failure_type="assertion_failure",
            failure_detail="assert 42 == 99",
        )
    )
    db.add(job)
    db.commit()
    url = f"{base_url(course, class_, assignment)}/submissions/{submission.id}/grading-jobs"
    payload = client.get(url, headers=auth_headers(client, student)).json()[0]
    assert payload["failure_information"] is None
    assert payload["runner_output"] is None
    assert payload["results"][0]["test_name"] == "Hidden test 1"
    assert payload["results"][0]["failure_type"] is None
    assert payload["results"][0]["failure_detail"] is None
