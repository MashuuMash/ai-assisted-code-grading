from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Assignment, Cohort, Course, SimilarityComparison, Submission
from app.submission_storage import SubmissionStorage


def purge_submission(db: Session, submission: Submission, storage: SubmissionStorage | None = None) -> None:
    """Delete a single submission, its similarity comparisons, and its orphaned stored file."""
    store = storage or SubmissionStorage()
    comparisons = list(
        db.scalars(
            select(SimilarityComparison).where(
                or_(
                    SimilarityComparison.submission_a_id == submission.id,
                    SimilarityComparison.submission_b_id == submission.id,
                )
            )
        )
    )
    for comp in comparisons:
        db.delete(comp)

    storage_key = submission.storage_key
    sub_id = submission.id
    db.delete(submission)
    db.flush()

    still_used = db.scalar(
        select(Submission.id)
        .where(Submission.storage_key == storage_key, Submission.id != sub_id)
        .limit(1)
    )
    if still_used is None:
        try:
            store.delete(storage_key)
        except ValueError:
            pass


def purge_assignment(db: Session, assignment: Assignment, storage: SubmissionStorage | None = None) -> None:
    """Delete an assignment and its child artifacts in dependency-safe order."""
    store = storage or SubmissionStorage()
    for report in list(assignment.similarity_reports):
        db.delete(report)
    for sub in list(assignment.submissions):
        try:
            store.delete(sub.storage_key)
        except ValueError:
            pass
        db.delete(sub)
    db.flush()
    db.delete(assignment)


def purge_class(db: Session, cohort: Cohort, storage: SubmissionStorage | None = None) -> None:
    """Delete a class cohort and all nested assignments safely."""
    store = storage or SubmissionStorage()
    for assignment in list(cohort.assignments):
        purge_assignment(db, assignment, store)
    db.flush()
    db.delete(cohort)


def purge_course(db: Session, course: Course, storage: SubmissionStorage | None = None) -> None:
    """Delete a course and all nested classes and assignments safely."""
    store = storage or SubmissionStorage()
    for cohort in list(course.classes):
        purge_class(db, cohort, store)
    db.flush()
    db.delete(course)
