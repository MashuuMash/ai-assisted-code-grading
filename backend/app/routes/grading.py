from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_active_user
from app.authorization import require_course_manager
from app.config import get_settings
from app.database import get_db
from app.models import (
    Assignment,
    Course,
    GradingJob,
    GradingJobStatus,
    TestCase,
    TestResult,
    TestVisibility,
    User,
    UserRole,
)
from app.routes.assignments import find_assignment, find_visible_submission, require_student_membership
from app.routes.classes import find_class
from app.routes.courses import find_course
from app.schemas import (
    GradingJobResponse,
    TestCaseCreate,
    TestCaseResponse,
    TestCaseUpdate,
    TestResultResponse,
)
from app.submission_storage import SubmissionStorage

router = APIRouter(prefix="/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}", tags=["grading"])


def context(course_id: int, class_id: int, assignment_id: int, db: Session) -> tuple[Course, Assignment]:
    course = find_course(course_id, db)
    find_class(course_id, class_id, db)
    return course, find_assignment(class_id, assignment_id, db)


def find_test_case(assignment_id: int, test_case_id: int, db: Session) -> TestCase:
    value = db.scalar(select(TestCase).where(TestCase.id == test_case_id, TestCase.assignment_id == assignment_id))
    if value is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")
    return value


def test_case_response(value: TestCase, reveal_hidden: bool) -> TestCaseResponse:
    content = value.content if reveal_hidden or value.visibility == TestVisibility.PUBLIC else None
    return TestCaseResponse(
        id=value.id,
        assignment_id=value.assignment_id,
        name=value.name if reveal_hidden or value.visibility == TestVisibility.PUBLIC else "Hidden test",
        visibility=value.visibility,
        content=content,
        created_at=value.created_at,
        updated_at=value.updated_at,
    )


@router.post("/test-cases", response_model=TestCaseResponse, status_code=status.HTTP_201_CREATED)
def create_test_case(
    course_id: int,
    class_id: int,
    assignment_id: int,
    data: TestCaseCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> TestCaseResponse:
    course, assignment = context(course_id, class_id, assignment_id, db)
    require_course_manager(user, course)
    test_count = db.scalar(select(func.count(TestCase.id)).where(TestCase.assignment_id == assignment.id)) or 0
    if test_count >= get_settings().grading_max_test_cases:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Assignment test-case limit reached")
    value = TestCase(assignment_id=assignment.id, **data.model_dump())
    db.add(value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Test case name already exists") from exc
    db.refresh(value)
    return test_case_response(value, True)


@router.get("/test-cases", response_model=list[TestCaseResponse])
def list_test_cases(
    course_id: int,
    class_id: int,
    assignment_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[TestCaseResponse]:
    course, assignment = context(course_id, class_id, assignment_id, db)
    reveal_hidden = user.role != UserRole.STUDENT
    if reveal_hidden:
        require_course_manager(user, course)
    else:
        require_student_membership(user, class_id, db)
    values = db.scalars(select(TestCase).where(TestCase.assignment_id == assignment.id).order_by(TestCase.id))
    return [test_case_response(value, reveal_hidden) for value in values]


@router.patch("/test-cases/{test_case_id}", response_model=TestCaseResponse)
def update_test_case(
    course_id: int,
    class_id: int,
    assignment_id: int,
    test_case_id: int,
    data: TestCaseUpdate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> TestCaseResponse:
    course, assignment = context(course_id, class_id, assignment_id, db)
    require_course_manager(user, course)
    value = find_test_case(assignment.id, test_case_id, db)
    for field, item in data.model_dump(exclude_unset=True).items():
        setattr(value, field, item)
    db.commit()
    db.refresh(value)
    return test_case_response(value, True)


@router.delete("/test-cases/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(
    course_id: int,
    class_id: int,
    assignment_id: int,
    test_case_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Response:
    course, assignment = context(course_id, class_id, assignment_id, db)
    require_course_manager(user, course)
    value = find_test_case(assignment.id, test_case_id, db)
    if db.scalar(select(TestResult.id).where(TestResult.test_case_id == value.id).limit(1)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Test case has grading history")
    db.delete(value)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/submissions/{submission_id}/grading-jobs",
    response_model=GradingJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_grading_job(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> GradingJobResponse:
    course, assignment = context(course_id, class_id, assignment_id, db)
    require_course_manager(user, course)
    submission = find_visible_submission(assignment, submission_id, user, course_id, db)
    if not SubmissionStorage().source_path(submission.storage_key).is_file():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission source is unavailable")
    if db.scalar(select(TestCase.id).where(TestCase.assignment_id == assignment.id).limit(1)) is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Assignment has no test cases")
    active = db.scalar(
        select(GradingJob.id).where(
            GradingJob.submission_id == submission.id,
            GradingJob.status.in_([GradingJobStatus.QUEUED, GradingJobStatus.RUNNING]),
        )
    )
    if active is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission already has an active job")
    job = GradingJob(submission_id=submission.id, status=GradingJobStatus.QUEUED)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job_response(job, True)


def job_response(job: GradingJob, privileged: bool) -> GradingJobResponse:
    results = []
    hidden_number = 0
    for result in job.results:
        hidden = result.test_case.visibility == TestVisibility.HIDDEN
        if hidden:
            hidden_number += 1
        results.append(
            TestResultResponse(
                id=result.id,
                test_case_id=result.test_case_id if privileged else None,
                test_name=result.test_name if privileged or not hidden else f"Hidden test {hidden_number}",
                visibility=result.test_case.visibility,
                outcome=result.outcome,
                duration_ms=result.duration_ms,
                failure_type=result.failure_type if privileged or not hidden else None,
                failure_detail=result.failure_detail if privileged or not hidden else None,
            )
        )
    return GradingJobResponse(
        id=job.id,
        submission_id=job.submission_id,
        status=job.status,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        runtime_ms=job.runtime_ms,
        total_tests=job.total_tests,
        passed_tests=job.passed_tests,
        failed_tests=job.failed_tests,
        failure_type=job.failure_type,
        failure_information=job.failure_information if privileged else None,
        runner_output=job.runner_output if privileged else None,
        results=results,
    )


@router.get("/submissions/{submission_id}/grading-jobs", response_model=list[GradingJobResponse])
def list_grading_jobs(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[GradingJobResponse]:
    course, assignment = context(course_id, class_id, assignment_id, db)
    submission = find_visible_submission(assignment, submission_id, user, course_id, db)
    privileged = user.role != UserRole.STUDENT
    if not privileged:
        require_student_membership(user, class_id, db)
    else:
        require_course_manager(user, course)
    query = (
        select(GradingJob)
        .options(selectinload(GradingJob.results).selectinload(TestResult.test_case))
        .where(GradingJob.submission_id == submission.id)
        .order_by(GradingJob.created_at.desc())
    )
    return [job_response(job, privileged) for job in db.scalars(query)]
