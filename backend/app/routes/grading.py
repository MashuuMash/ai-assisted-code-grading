from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_user
from app.authorization import can_manage_class, can_view_class
from app.database import get_db
from app.models import (
    Assignment,
    Cohort,
    Course,
    GradingJob,
    GradingJobStatus,
    Submission,
    TestCase,
    TestResult,
    TestVisibility,
    User,
)
from app.schemas import (
    GradingJobResponse,
    TestCaseCreate,
    TestCaseResponse,
    TestCaseUpdate,
    TestResultResponse,
)

router = APIRouter(
    prefix="/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}",
    tags=["grading"],
)


def get_assignment_context(
    course_id: int, class_id: int, assignment_id: int, db: Session
) -> tuple[Course, Cohort, Assignment]:
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    cohort = db.scalar(
        select(Cohort).where(Cohort.id == class_id, Cohort.course_id == course_id)
    )
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found in this course")

    assignment = db.scalar(
        select(Assignment).where(Assignment.id == assignment_id, Assignment.class_id == class_id)
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    return course, cohort, assignment


def get_test_case_or_404(assignment_id: int, test_case_id: int, db: Session) -> TestCase:
    tc = db.scalar(
        select(TestCase).where(TestCase.id == test_case_id, TestCase.assignment_id == assignment_id)
    )
    if not tc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")
    return tc


def serialize_test_case(tc: TestCase, is_privileged: bool) -> TestCaseResponse:
    reveal = is_privileged or tc.visibility == TestVisibility.PUBLIC
    return TestCaseResponse(
        id=tc.id,
        assignment_id=tc.assignment_id,
        name=tc.name if reveal else "Hidden test",
        visibility=tc.visibility,
        content=tc.content if reveal else None,
        created_at=tc.created_at,
        updated_at=tc.updated_at,
    )


@router.get("/test-cases", response_model=list[TestCaseResponse])
def list_test_cases(
    course_id: int,
    class_id: int,
    assignment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[TestCaseResponse]:
    _, cohort, _ = get_assignment_context(course_id, class_id, assignment_id, db)
    if not can_view_class(current_user, cohort, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    is_privileged = can_manage_class(current_user, cohort)
    cases = list(
        db.scalars(
            select(TestCase)
            .where(TestCase.assignment_id == assignment_id)
            .order_by(TestCase.id)
        ).all()
    )
    return [serialize_test_case(tc, is_privileged) for tc in cases]


@router.post("/test-cases", response_model=TestCaseResponse, status_code=status.HTTP_201_CREATED)
def create_test_case(
    course_id: int,
    class_id: int,
    assignment_id: int,
    tc_in: TestCaseCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TestCaseResponse:
    _, cohort, _ = get_assignment_context(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    existing = db.scalar(
        select(TestCase).where(TestCase.assignment_id == assignment_id, TestCase.name == tc_in.name)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A test case with this name already exists for this assignment",
        )

    tc = TestCase(
        assignment_id=assignment_id,
        name=tc_in.name,
        visibility=tc_in.visibility,
        content=tc_in.content,
    )
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return serialize_test_case(tc, True)


@router.get("/test-cases/{test_case_id}", response_model=TestCaseResponse)
def get_test_case(
    course_id: int,
    class_id: int,
    assignment_id: int,
    test_case_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TestCaseResponse:
    _, cohort, _ = get_assignment_context(course_id, class_id, assignment_id, db)
    if not can_view_class(current_user, cohort, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    tc = get_test_case_or_404(assignment_id, test_case_id, db)
    is_privileged = can_manage_class(current_user, cohort)
    return serialize_test_case(tc, is_privileged)


@router.put("/test-cases/{test_case_id}", response_model=TestCaseResponse)
def update_test_case(
    course_id: int,
    class_id: int,
    assignment_id: int,
    test_case_id: int,
    tc_in: TestCaseUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TestCaseResponse:
    _, cohort, _ = get_assignment_context(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    tc = get_test_case_or_404(assignment_id, test_case_id, db)
    if tc_in.name is not None:
        tc.name = tc_in.name
    if tc_in.visibility is not None:
        tc.visibility = tc_in.visibility
    if tc_in.content is not None:
        tc.content = tc_in.content

    db.commit()
    db.refresh(tc)
    return serialize_test_case(tc, True)


@router.delete("/test-cases/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(
    course_id: int,
    class_id: int,
    assignment_id: int,
    test_case_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    _, cohort, _ = get_assignment_context(course_id, class_id, assignment_id, db)
    if not can_manage_class(current_user, cohort):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    tc = get_test_case_or_404(assignment_id, test_case_id, db)
    db.delete(tc)
    db.commit()


@router.post("/submissions/{submission_id}/grade", response_model=GradingJobResponse, status_code=status.HTTP_202_ACCEPTED)
def queue_grading_job(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GradingJobResponse:
    _, cohort, _ = get_assignment_context(course_id, class_id, assignment_id, db)
    submission = db.scalar(
        select(Submission).where(Submission.id == submission_id, Submission.assignment_id == assignment_id)
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    is_privileged = can_manage_class(current_user, cohort)
    if not is_privileged and submission.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    job = GradingJob(
        submission_id=submission_id,
        status=GradingJobStatus.QUEUED,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return GradingJobResponse(
        id=job.id,
        submission_id=job.submission_id,
        status=job.status,
        created_at=job.created_at,
        total_tests=0,
        passed_tests=0,
        failed_tests=0,
        results=[],
    )


@router.get("/submissions/{submission_id}/jobs", response_model=list[GradingJobResponse])
def list_grading_jobs(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[GradingJobResponse]:
    _, cohort, _ = get_assignment_context(course_id, class_id, assignment_id, db)
    submission = db.scalar(
        select(Submission).where(Submission.id == submission_id, Submission.assignment_id == assignment_id)
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    is_privileged = can_manage_class(current_user, cohort)
    if not is_privileged and submission.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    jobs = list(
        db.scalars(
            select(GradingJob)
            .where(GradingJob.submission_id == submission_id)
            .order_by(GradingJob.created_at.desc())
        ).all()
    )

    return [
        GradingJobResponse(
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
            failure_information=job.failure_information,
            runner_output=job.runner_output if is_privileged else None,
            results=[],
        )
        for job in jobs
    ]


@router.get("/submissions/{submission_id}/jobs/{job_id}", response_model=GradingJobResponse)
def get_grading_job_detail(
    course_id: int,
    class_id: int,
    assignment_id: int,
    submission_id: int,
    job_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GradingJobResponse:
    _, cohort, _ = get_assignment_context(course_id, class_id, assignment_id, db)
    submission = db.scalar(
        select(Submission).where(Submission.id == submission_id, Submission.assignment_id == assignment_id)
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    is_privileged = can_manage_class(current_user, cohort)
    if not is_privileged and submission.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    job = db.scalar(
        select(GradingJob)
        .options(selectinload(GradingJob.results).selectinload(TestResult.test_case))
        .where(GradingJob.id == job_id, GradingJob.submission_id == submission_id)
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grading job not found")

    # Mask hidden test results if student
    result_responses = []
    hidden_counter = 1
    for res in job.results:
        is_hidden = res.test_case.visibility == TestVisibility.HIDDEN
        if is_privileged:
            result_responses.append(
                TestResultResponse(
                    id=res.id,
                    test_case_id=res.test_case_id,
                    test_name=res.test_name,
                    outcome=res.outcome,
                    duration_ms=res.duration_ms,
                    failure_type=res.failure_type,
                    failure_detail=res.failure_detail,
                )
            )
        else:
            name = f"Hidden test #{hidden_counter}" if is_hidden else res.test_name
            if is_hidden:
                hidden_counter += 1
            result_responses.append(
                TestResultResponse(
                    id=res.id,
                    test_case_id=res.test_case_id,
                    test_name=name,
                    outcome=res.outcome,
                    duration_ms=res.duration_ms,
                    failure_type=None if is_hidden else res.failure_type,
                    failure_detail=None if is_hidden else res.failure_detail,
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
        failure_information=job.failure_information,
        runner_output=job.runner_output if is_privileged else None,
        results=result_responses,
    )
