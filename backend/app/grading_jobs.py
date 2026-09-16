from datetime import datetime, timezone

from app.models import GradingJob, GradingJobStatus

ALLOWED_TRANSITIONS = {
    GradingJobStatus.QUEUED: {GradingJobStatus.RUNNING, GradingJobStatus.FAILED},
    GradingJobStatus.RUNNING: {
        GradingJobStatus.COMPLETED,
        GradingJobStatus.FAILED,
        GradingJobStatus.TIMEOUT,
    },
}


def transition_job(job: GradingJob, target: GradingJobStatus) -> None:
    allowed = ALLOWED_TRANSITIONS.get(job.status, set())
    if target not in allowed:
        raise ValueError(f"Invalid grading job transition: {job.status.value} -> {target.value}")

    now = datetime.now(timezone.utc)
    if target == GradingJobStatus.RUNNING:
        job.started_at = now
    elif target in {GradingJobStatus.COMPLETED, GradingJobStatus.FAILED, GradingJobStatus.TIMEOUT}:
        job.completed_at = now

    job.status = target
