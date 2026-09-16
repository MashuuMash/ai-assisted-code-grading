from unittest.mock import MagicMock

from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    Cohort,
    Course,
    GradingJob,
    GradingJobStatus,
    Submission,
    TestCase,
    TestOutcome,
    User,
    UserRole,
)
from app.sandbox_runner import SandboxResult, SandboxTestResult
from app.worker import claim_job, process_job, recover_interrupted_jobs


def setup_submission_for_worker(db: Session) -> tuple[Submission, TestCase]:
    user_lec = User(
        email="lec_worker@example.edu",
        username="lec_worker",
        full_name="Worker Lecturer",
        hashed_password="hash",
        role=UserRole.LECTURER,
    )
    user_stu = User(
        email="stu_worker@example.edu",
        username="stu_worker",
        full_name="Worker Student",
        hashed_password="hash",
        role=UserRole.STUDENT,
    )
    db.add_all([user_lec, user_stu])
    db.commit()

    course = Course(code="W101", name="Worker Test Course", instructor_id=user_lec.id)
    db.add(course)
    db.commit()

    cohort = Cohort(course_id=course.id, code="C01", name="Cohort 1", semester="Fall", year=2026)
    db.add(cohort)
    db.commit()

    assignment = Assignment(class_id=cohort.id, title="Assignment Worker", language="python")
    db.add(assignment)
    db.commit()

    tc = TestCase(
        assignment_id=assignment.id,
        name="test_dummy",
        content="assert True",
    )
    db.add(tc)
    db.commit()

    # Create dummy storage file
    from app.submission_storage import SubmissionStorage

    storage = SubmissionStorage()
    storage.root.mkdir(parents=True, exist_ok=True)
    dummy_key = "0123456789abcdef0123456789abcdef.py"
    dummy_path = storage.source_path(dummy_key)
    dummy_path.write_text("print('test')", encoding="utf-8")

    sub = Submission(
        assignment_id=assignment.id,
        student_id=user_stu.id,
        original_filename="dummy.py",
        storage_key=dummy_key,
        size_bytes=12,
        sha256="abc",
    )
    db.add(sub)
    db.commit()

    return sub, tc


def test_claim_job_and_recover_interrupted(db: Session) -> None:
    sub, _ = setup_submission_for_worker(db)

    # Initially no job
    assert claim_job(db) is None

    # Add queued job
    job = GradingJob(submission_id=sub.id, status=GradingJobStatus.QUEUED)
    db.add(job)
    db.commit()

    # Claim job
    claimed_id = claim_job(db)
    assert claimed_id == job.id

    db.refresh(job)
    assert job.status == GradingJobStatus.RUNNING

    # Recover interrupted
    recovered_count = recover_interrupted_jobs(db)
    assert recovered_count == 1
    db.refresh(job)
    assert job.status == GradingJobStatus.FAILED
    assert job.failure_type == "worker_interrupted"


def test_process_job_success(db: Session) -> None:
    sub, tc = setup_submission_for_worker(db)

    job = GradingJob(submission_id=sub.id, status=GradingJobStatus.RUNNING)
    db.add(job)
    db.commit()

    mock_runner = MagicMock()
    mock_runner.run.return_value = SandboxResult(
        timed_out=False,
        infrastructure_error=None,
        runtime_ms=150,
        output="1 passed in 0.15s",
        results=[
            SandboxTestResult(
                test_case_id=tc.id,
                test_name=tc.name,
                outcome=TestOutcome.PASSED,
                duration_ms=45,
                failure_type=None,
                failure_detail=None,
            )
        ],
    )

    process_job(job.id, runner=mock_runner, db=db)

    db.refresh(job)
    assert job.status == GradingJobStatus.COMPLETED
    assert job.total_tests == 1
    assert job.passed_tests == 1
    assert job.failed_tests == 0
    assert len(job.results) == 1
    assert job.results[0].outcome == TestOutcome.PASSED


def test_process_job_timeout(db: Session) -> None:
    sub, _ = setup_submission_for_worker(db)

    job = GradingJob(submission_id=sub.id, status=GradingJobStatus.RUNNING)
    db.add(job)
    db.commit()

    mock_runner = MagicMock()
    mock_runner.run.return_value = SandboxResult(
        timed_out=True,
        infrastructure_error=None,
        runtime_ms=10000,
        output="Execution timed out",
        results=[],
    )

    process_job(job.id, runner=mock_runner, db=db)

    db.refresh(job)
    assert job.status == GradingJobStatus.TIMEOUT
    assert job.failure_type == "timeout"
