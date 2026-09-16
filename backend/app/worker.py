import logging
import time

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import SessionLocal
from app.grading_jobs import transition_job
from app.models import (
    GradingJob,
    GradingJobStatus,
    Submission,
    TestCase,
    TestOutcome,
    TestResult,
)
from app.sandbox_runner import DockerSandboxRunner
from app.submission_storage import SubmissionStorage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _execute_with_db(db: Session | None, func):
    if db is not None:
        return func(db)
    with SessionLocal() as session:
        return func(session)


def claim_job(db: Session | None = None) -> int | None:
    def _claim(session: Session) -> int | None:
        job = session.scalar(
            select(GradingJob)
            .where(GradingJob.status == GradingJobStatus.QUEUED)
            .order_by(GradingJob.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if job is None:
            return None
        transition_job(job, GradingJobStatus.RUNNING)
        session.commit()
        return job.id

    return _execute_with_db(db, _claim)


def recover_interrupted_jobs(db: Session | None = None) -> int:
    def _recover(session: Session) -> int:
        jobs = list(session.scalars(select(GradingJob).where(GradingJob.status == GradingJobStatus.RUNNING)))
        for job in jobs:
            transition_job(job, GradingJobStatus.FAILED)
            job.failure_type = "worker_interrupted"
            job.failure_information = "Worker stopped before the grading job completed"
        session.commit()
        return len(jobs)

    return _execute_with_db(db, _recover)


def process_job(
    job_id: int,
    runner: DockerSandboxRunner | None = None,
    db: Session | None = None,
) -> None:
    runner = runner or DockerSandboxRunner()

    def _process(session: Session) -> None:
        job = session.scalar(
            select(GradingJob)
            .options(selectinload(GradingJob.submission).selectinload(Submission.assignment))
            .where(GradingJob.id == job_id)
        )
        if job is None or job.status != GradingJobStatus.RUNNING:
            return

        tests = list(
            session.scalars(
                select(TestCase).where(TestCase.assignment_id == job.submission.assignment_id).order_by(TestCase.id)
            )
        )
        if not tests:
            transition_job(job, GradingJobStatus.FAILED)
            job.failure_type = "configuration_error"
            job.failure_information = "Assignment has no test cases configured"
            session.commit()
            return

        source_path = SubmissionStorage().source_path(job.submission.storage_key)
        result = runner.run(source_path, tests)
        job.runtime_ms = result.runtime_ms
        job.runner_output = result.output

        if result.timed_out:
            transition_job(job, GradingJobStatus.TIMEOUT)
            job.failure_type = "timeout"
        elif result.infrastructure_error:
            transition_job(job, GradingJobStatus.FAILED)
            job.failure_type = "infrastructure_error"
            job.failure_information = result.infrastructure_error
        else:
            for item in result.results:
                job.results.append(
                    TestResult(
                        test_case_id=item.test_case_id,
                        test_name=item.test_name,
                        outcome=item.outcome,
                        duration_ms=item.duration_ms,
                        failure_type=item.failure_type,
                        failure_detail=item.failure_detail,
                    )
                )
            job.total_tests = len(result.results)
            job.passed_tests = sum(item.outcome == TestOutcome.PASSED for item in result.results)
            job.failed_tests = job.total_tests - job.passed_tests
            transition_job(job, GradingJobStatus.COMPLETED)

        session.commit()

    _execute_with_db(db, _process)


def main() -> None:
    _ = get_settings()
    recovered = recover_interrupted_jobs()
    logger.info("Grading worker started")
    if recovered:
        logger.warning("Marked %s interrupted grading jobs as failed", recovered)

    while True:
        job_id = claim_job()
        if job_id is None:
            time.sleep(2)
            continue
        try:
            process_job(job_id)
        except Exception:
            logger.exception("Unexpected grading worker failure for job %s", job_id)
            with SessionLocal() as db:
                job = db.get(GradingJob, job_id)
                if job and job.status == GradingJobStatus.RUNNING:
                    transition_job(job, GradingJobStatus.FAILED)
                    job.failure_type = "infrastructure_error"
                    job.failure_information = "Unexpected worker failure"
                    db.commit()


if __name__ == "__main__":
    main()
