from pathlib import Path

from sqlalchemy.orm import Session

from app.models import GradingJob, GradingJobStatus, Submission
from app.models import TestOutcome as GradingTestOutcome
from app.sandbox_runner import SandboxResult, SandboxTestResult
from app.worker import process_job


class FakeRunner:
    def __init__(self, result: SandboxResult) -> None:
        self.result = result

    def run(self, source_path: Path, test_cases: list[object]) -> SandboxResult:
        return self.result


def running_job(db: Session, submission: Submission) -> GradingJob:
    job = GradingJob(submission_id=submission.id, status=GradingJobStatus.RUNNING)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def test_worker_persists_successful_structured_results(
    db: Session, submission: Submission, public_test: object
) -> None:
    job = running_job(db, submission)
    result = SandboxResult(
        False,
        None,
        12,
        "safe output",
        [SandboxTestResult(public_test.id, "test_answer", GradingTestOutcome.PASSED, 3, None, None)],
    )
    process_job(job.id, FakeRunner(result))
    db.expire_all()
    updated = db.get(GradingJob, job.id)
    assert updated.status == GradingJobStatus.COMPLETED
    assert updated.total_tests == updated.passed_tests == 1


def test_worker_distinguishes_timeout_and_infrastructure_failure(
    db: Session, submission: Submission, public_test: object
) -> None:
    timeout_job = running_job(db, submission)
    process_job(timeout_job.id, FakeRunner(SandboxResult(True, None, 2000, "", [])))
    failed_job = running_job(db, submission)
    process_job(failed_job.id, FakeRunner(SandboxResult(False, "Docker unavailable", 0, "", [])))
    db.expire_all()
    assert db.get(GradingJob, timeout_job.id).status == GradingJobStatus.TIMEOUT
    assert db.get(GradingJob, failed_job.id).status == GradingJobStatus.FAILED
    assert db.get(GradingJob, failed_job.id).failure_type == "infrastructure_error"
