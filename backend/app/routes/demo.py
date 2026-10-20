import io
import threading
import time
import uuid
import zipfile
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_password_hash
from app.database import get_db
from app.models import (
    Assignment,
    AssignmentStatus,
    ClassMembership,
    Cohort,
    ComparisonReviewStatus,
    Course,
    CriterionScore,
    EvaluationType,
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    GradeStatus,
    GradingJob,
    GradingJobStatus,
    Rubric,
    RubricCriterion,
    SimilarityComparison,
    SimilarityReport,
    SimilarityStatus,
    Submission,
    SubmissionEvidence,
    SubmissionGrade,
    TestCase,
    TestOutcome,
    TestResult,
    TestVisibility,
    User,
    UserRole,
    utc_now,
)
from app.submission_storage import SubmissionStorage

router = APIRouter(prefix="/demo", tags=["demo"])

DEMO_COURSE_CODE = "CS102-DEMO"
DEMO_COHORT_CODE = "C01-DEMO"
DEMO_LECTURER_USERNAME = "demo_lecturer"
DEMO_LECTURER_EMAIL = "demo_lecturer@university.edu"
DEMO_ASSIGNMENT_TITLE = "Assignment 1: Prime and Fibonacci Analysis"

DEMO_BASE_CODE = (
    "# Starter template provided by instructor\n"
    "def is_prime(n: int) -> bool:\n"
    '    """Check if n is prime."""\n'
    "    pass\n\n\n"
    "def fibonacci(n: int) -> int:\n"
    '    """Calculate nth Fibonacci number."""\n'
    "    pass\n"
)

CODE_1001 = (
    "def is_prime(n: int) -> bool:\n"
    "    if n < 2:\n"
    "        return False\n"
    "    for i in range(2, int(n**0.5) + 1):\n"
    "        if n % i == 0:\n"
    "            return False\n"
    "    return True\n\n\n"
    "def fibonacci(n: int) -> int:\n"
    "    if n <= 0:\n"
    "        return 0\n"
    "    if n == 1:\n"
    "        return 1\n"
    "    a, b = 0, 1\n"
    "    for _ in range(2, n + 1):\n"
    "        a, b = b, a + b\n"
    "    return b\n"
)

CODE_1002 = (
    "import math\n"
    "import sys\n\n\n"
    "def is_prime(n: int) -> bool:\n"
    "    for i in range(2, n):\n"
    "        if n % i == 0:\n"
    "            return False\n"
    "    return True\n\n\n"
    "def fibonacci(n: int) -> int:\n"
    "    if n < 0:\n"
    "        return -1\n"
    "    total = 0\n"
    "    if n > 0:\n"
    "        if n > 1:\n"
    "            if n > 2:\n"
    "                if n > 3:\n"
    "                    if n > 4:\n"
    "                        total = 5\n"
    "    return total\n"
)

CODE_1003 = (
    "def is_prime(number: int) -> bool:\n"
    "    if number < 2:\n"
    "        return False\n"
    "    for divisor in range(2, int(number**0.5) + 1):\n"
    "        if number % divisor == 0:\n"
    "            return False\n"
    "    return True\n\n\n"
    "def fibonacci(count: int) -> int:\n"
    "    if count <= 0:\n"
    "        return 0\n"
    "    if count == 1:\n"
    "        return 1\n"
    "    val_x, val_y = 0, 1\n"
    "    for _ in range(2, count + 1):\n"
    "        val_x, val_y = val_y, val_x + val_y\n"
    "    return val_y\n"
)


class DemoUserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str


class DemoSampleSubmission(BaseModel):
    id: int
    student_name: str
    student_code: str
    grade_status: str
    final_score: float


class DemoSeedResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: DemoUserResponse
    course_id: int
    class_id: int
    assignment_id: int
    sample_submissions: list[DemoSampleSubmission]


class DemoResetResponse(BaseModel):
    status: str = "success"
    message: str = "Demo environment reset to baseline."


def generate_sample_zip() -> bytes:
    """Generate in-memory LMS zip archive containing the 3 student submissions."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Nguyen Van An_1001_assignsubmission_file_main.py", CODE_1001)
        zf.writestr("Tran Thi Binh_1002_assignsubmission_file_main.py", CODE_1002)
        zf.writestr("Le Van Cuong_1003_assignsubmission_file_main.py", CODE_1003)
    return zip_buffer.getvalue()


_demo_lock = threading.Lock()


def clean_demo_course(db: Session, course: Course) -> None:
    """Remove demo course and all associated child entities in strict topological reverse dependency order."""
    storage = SubmissionStorage()
    classes = list(db.scalars(select(Cohort).where(Cohort.course_id == course.id)).all())
    class_ids = [c.id for c in classes]

    if class_ids:
        assignments = list(
            db.scalars(select(Assignment).where(Assignment.class_id.in_(class_ids))).all()
        )
        assignment_ids = [a.id for a in assignments]

        if assignment_ids:
            submissions = list(
                db.scalars(
                    select(Submission).where(Submission.assignment_id.in_(assignment_ids))
                ).all()
            )
            submission_ids = [s.id for s in submissions]

            for sub in submissions:
                try:
                    storage.delete(sub.storage_key)
                except Exception:
                    pass

            rubrics = list(
                db.scalars(select(Rubric).where(Rubric.assignment_id.in_(assignment_ids))).all()
            )
            rubric_ids = [r.id for r in rubrics]

            report_ids = list(
                db.scalars(
                    select(SimilarityReport.id).where(
                        SimilarityReport.assignment_id.in_(assignment_ids)
                    )
                ).all()
            )

            test_case_ids = list(
                db.scalars(
                    select(TestCase.id).where(TestCase.assignment_id.in_(assignment_ids))
                ).all()
            )

            # 1. Similarity comparisons (references similarity_reports, submissions)
            sim_comp_conditions = []
            if report_ids:
                sim_comp_conditions.append(SimilarityComparison.report_id.in_(report_ids))
            if submission_ids:
                sim_comp_conditions.append(SimilarityComparison.submission_a_id.in_(submission_ids))
                sim_comp_conditions.append(SimilarityComparison.submission_b_id.in_(submission_ids))
            if sim_comp_conditions:
                db.execute(delete(SimilarityComparison).where(or_(*sim_comp_conditions)))

            # 2. Test results (references grading_jobs and test_cases with RESTRICT)
            grading_job_ids = (
                list(
                    db.scalars(
                        select(GradingJob.id).where(GradingJob.submission_id.in_(submission_ids))
                    ).all()
                )
                if submission_ids
                else []
            )

            test_result_conditions = []
            if grading_job_ids:
                test_result_conditions.append(TestResult.grading_job_id.in_(grading_job_ids))
            if test_case_ids:
                test_result_conditions.append(TestResult.test_case_id.in_(test_case_ids))
            if test_result_conditions:
                db.execute(delete(TestResult).where(or_(*test_result_conditions)))

            # 3. Grading jobs (references submissions)
            if grading_job_ids:
                db.execute(delete(GradingJob).where(GradingJob.id.in_(grading_job_ids)))

            # 4. Criterion scores (references submission_grades and rubric_criteria)
            grade_conditions = []
            if submission_ids:
                grade_conditions.append(SubmissionGrade.submission_id.in_(submission_ids))
            if rubric_ids:
                grade_conditions.append(SubmissionGrade.rubric_id.in_(rubric_ids))

            grade_ids = (
                list(db.scalars(select(SubmissionGrade.id).where(or_(*grade_conditions))).all())
                if grade_conditions
                else []
            )

            criterion_ids = (
                list(
                    db.scalars(
                        select(RubricCriterion.id).where(RubricCriterion.rubric_id.in_(rubric_ids))
                    ).all()
                )
                if rubric_ids
                else []
            )

            score_conditions = []
            if grade_ids:
                score_conditions.append(CriterionScore.submission_grade_id.in_(grade_ids))
            if criterion_ids:
                score_conditions.append(CriterionScore.criterion_id.in_(criterion_ids))
            if score_conditions:
                db.execute(delete(CriterionScore).where(or_(*score_conditions)))

            # 5. Submission grades (references submissions and rubrics with RESTRICT)
            if grade_ids:
                db.execute(delete(SubmissionGrade).where(SubmissionGrade.id.in_(grade_ids)))

            # 6. Submission evidence (references submissions and assignments)
            ev_conditions = [SubmissionEvidence.assignment_id.in_(assignment_ids)]
            if submission_ids:
                ev_conditions.append(SubmissionEvidence.submission_id.in_(submission_ids))
            db.execute(delete(SubmissionEvidence).where(or_(*ev_conditions)))

            # 7. Submissions (references assignments and users)
            if submission_ids:
                db.execute(delete(Submission).where(Submission.id.in_(submission_ids)))

            # 8. Similarity reports (references assignments)
            if report_ids:
                db.execute(delete(SimilarityReport).where(SimilarityReport.id.in_(report_ids)))

            # 9. Test cases (references assignments)
            if test_case_ids:
                db.execute(delete(TestCase).where(TestCase.id.in_(test_case_ids)))

            # 10. Rubric criteria & Rubrics (references assignments)
            if criterion_ids:
                db.execute(delete(RubricCriterion).where(RubricCriterion.id.in_(criterion_ids)))
            if rubric_ids:
                db.execute(delete(Rubric).where(Rubric.id.in_(rubric_ids)))

            # 11. Assignments (references classes)
            db.execute(delete(Assignment).where(Assignment.id.in_(assignment_ids)))

        # 12. Class memberships (references classes and users)
        db.execute(delete(ClassMembership).where(ClassMembership.class_id.in_(class_ids)))

        # 13. Cohorts / Classes (references courses)
        db.execute(delete(Cohort).where(Cohort.id.in_(class_ids)))

    # 14. Course (references users)
    db.delete(course)
    db.commit()


def _get_existing_demo_response(
    db: Session, lecturer: User | None = None
) -> DemoSeedResponse | None:
    """Retrieve existing demo environment response if completely seeded and graded."""
    if not lecturer:
        lecturer = db.scalar(select(User).where(User.username == DEMO_LECTURER_USERNAME))
    if not lecturer:
        return None

    existing_course = db.scalar(select(Course).where(Course.code == DEMO_COURSE_CODE))
    if not existing_course:
        return None

    cohort = db.scalar(
        select(Cohort).where(
            Cohort.course_id == existing_course.id, Cohort.code == DEMO_COHORT_CODE
        )
    )
    if not cohort:
        return None

    assignment = db.scalar(
        select(Assignment).where(
            Assignment.class_id == cohort.id,
            Assignment.title == DEMO_ASSIGNMENT_TITLE,
        )
    )
    if not assignment:
        return None

    subs = list(
        db.scalars(
            select(Submission)
            .where(Submission.assignment_id == assignment.id)
            .order_by(Submission.student_identifier)
        ).all()
    )
    if len(subs) != 3:
        return None

    sample_subs = []
    for s in subs:
        grade = db.scalar(
            select(SubmissionGrade).where(
                SubmissionGrade.submission_id == s.id
            )
        )
        if not grade:
            return None
        grade_status = grade.status.value
        final_score = (
            grade.final_total_score
            if grade.final_total_score is not None
            else (grade.suggested_total_score if grade.suggested_total_score is not None else 0.0)
        )
        sample_subs.append(
            DemoSampleSubmission(
                id=s.id,
                student_name=s.student_name or "",
                student_code=s.student_identifier,
                grade_status=grade_status,
                final_score=final_score,
            )
        )

    token = create_access_token(
        data={
            "sub": lecturer.username,
            "user_id": lecturer.id,
            "role": lecturer.role.value,
        }
    )
    return DemoSeedResponse(
        access_token=token,
        token_type="bearer",
        user=DemoUserResponse(
            id=lecturer.id,
            username=lecturer.username,
            email=lecturer.email,
            full_name=lecturer.full_name,
            role=lecturer.role.value,
        ),
        course_id=existing_course.id,
        class_id=cohort.id,
        assignment_id=assignment.id,
        sample_submissions=sample_subs,
    )


def _build_demo_environment(db: Session, reset: bool = False) -> DemoSeedResponse:
    """Internal builder to clean and seed the demo database."""
    # 1. Ensure Demo Lecturer
    lecturer = db.scalar(select(User).where(User.username == DEMO_LECTURER_USERNAME))
    if not lecturer:
        lecturer = User(
            username=DEMO_LECTURER_USERNAME,
            email=DEMO_LECTURER_EMAIL,
            full_name="Demo Lecturer",
            role=UserRole.LECTURER,
            hashed_password=get_password_hash("DemoPass123!"),
            is_active=True,
        )
        db.add(lecturer)
        db.commit()
        db.refresh(lecturer)

    # 2. Check existing course
    existing_course = db.scalar(select(Course).where(Course.code == DEMO_COURSE_CODE))
    if existing_course and not reset:
        cached = _get_existing_demo_response(db, lecturer)
        if cached:
            return cached

    if existing_course:
        clean_demo_course(db, existing_course)

    # 3. Create Course
    course = Course(
        code=DEMO_COURSE_CODE,
        name="Data Structures & Algorithms",
        description="Demonstration course for AI-Assisted Code Grading",
        instructor_id=lecturer.id,
        is_active=True,
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    # 4. Create Cohort / Class
    cohort = Cohort(
        course_id=course.id,
        code=DEMO_COHORT_CODE,
        name="Class C01 - Spring 2026",
        semester="Spring",
        year=2026,
        is_active=True,
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)

    # 5. Create or Get Demo Students
    student_specs = [
        ("student_1001", "student_1001@university.edu", "Nguyen Van An", "1001"),
        ("student_1002", "student_1002@university.edu", "Tran Thi Binh", "1002"),
        ("student_1003", "student_1003@university.edu", "Le Van Cuong", "1003"),
    ]
    student_users: dict[str, User] = {}
    for uname, email, fname, _sid in student_specs:
        stu = db.scalar(select(User).where(User.username == uname))
        if not stu:
            stu = User(
                username=uname,
                email=email,
                full_name=fname,
                role=UserRole.STUDENT,
                hashed_password=get_password_hash("StudentPass123!"),
                is_active=True,
            )
            db.add(stu)
            db.commit()
            db.refresh(stu)
        student_users[uname] = stu

        # Enroll in cohort
        membership = db.scalar(
            select(ClassMembership).where(
                ClassMembership.user_id == stu.id, ClassMembership.class_id == cohort.id
            )
        )
        if not membership:
            db.add(ClassMembership(user_id=stu.id, class_id=cohort.id))
    db.commit()

    # 6. Create Assignment
    assignment = Assignment(
        class_id=cohort.id,
        title=DEMO_ASSIGNMENT_TITLE,
        description="Implement algorithms to analyze prime numbers and compute Fibonacci terms.",
        instructions="Implement is_prime and fibonacci according to the specifications.",
        language="python",
        status=AssignmentStatus.PUBLISHED,
        base_code=DEMO_BASE_CODE,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    # 7. Create Test Cases (2 Public, 2 Hidden)
    tc1 = TestCase(
        assignment_id=assignment.id,
        name="test_prime_public",
        visibility=TestVisibility.PUBLIC,
        content="assert is_prime(2) is True\nassert is_prime(7) is True\nassert is_prime(4) is False",
    )
    tc2 = TestCase(
        assignment_id=assignment.id,
        name="test_fib_public",
        visibility=TestVisibility.PUBLIC,
        content="assert fibonacci(0) == 0\nassert fibonacci(1) == 1\nassert fibonacci(5) == 5",
    )
    tc3 = TestCase(
        assignment_id=assignment.id,
        name="test_prime_hidden",
        visibility=TestVisibility.HIDDEN,
        content="assert is_prime(-5) is False\nassert is_prime(1) is False\nassert is_prime(97) is True",
    )
    tc4 = TestCase(
        assignment_id=assignment.id,
        name="test_fib_hidden",
        visibility=TestVisibility.HIDDEN,
        content="assert fibonacci(10) == 55\nassert fibonacci(15) == 610",
    )
    db.add_all([tc1, tc2, tc3, tc4])
    db.commit()
    db.refresh(tc1)
    db.refresh(tc2)
    db.refresh(tc3)
    db.refresh(tc4)

    # 8. Create Rubric with 4 Criteria (Summing to 100%)
    rubric = Rubric(
        assignment_id=assignment.id,
        title="Assignment 1 Comprehensive Rubric",
        description="Four-pillar evaluation covering correctness, robustness, style, and complexity.",
        max_score=10.0,
    )
    db.add(rubric)
    db.commit()
    db.refresh(rubric)

    crit_correctness = RubricCriterion(
        rubric_id=rubric.id,
        title="Automated Tests",
        description="Evaluates public test cases verifying basic prime and Fibonacci logic.",
        category=EvidenceCategory.CORRECTNESS,
        evaluation_type=EvaluationType.AUTOMATED_TEST,
        weight_percentage=40.0,
        max_points=4.0,
        order_index=0,
    )
    crit_robustness = RubricCriterion(
        rubric_id=rubric.id,
        title="Edge Cases & Robustness",
        description="Evaluates hidden test cases covering negative inputs and large bounds.",
        category=EvidenceCategory.ROBUSTNESS,
        evaluation_type=EvaluationType.AUTOMATED_TEST,
        weight_percentage=20.0,
        max_points=2.0,
        order_index=1,
    )
    crit_quality = RubricCriterion(
        rubric_id=rubric.id,
        title="Code Quality",
        description="Static analysis diagnostics from Ruff detecting style and unused imports.",
        category=EvidenceCategory.CODE_QUALITY,
        evaluation_type=EvaluationType.CODE_QUALITY,
        weight_percentage=20.0,
        max_points=2.0,
        config={"penalty_per_error": 0.5, "penalty_per_warning": 0.5},
        order_index=2,
    )
    crit_complexity = RubricCriterion(
        rubric_id=rubric.id,
        title="Structural Complexity",
        description="AST complexity analysis checking block nesting and cognitive load.",
        category=EvidenceCategory.COMPLEXITY,
        evaluation_type=EvaluationType.STRUCTURAL_COMPLEXITY,
        weight_percentage=20.0,
        max_points=2.0,
        config={"penalty_per_violation": 0.5},
        order_index=3,
    )
    db.add_all([crit_correctness, crit_robustness, crit_quality, crit_complexity])
    db.commit()
    db.refresh(crit_correctness)
    db.refresh(crit_robustness)
    db.refresh(crit_quality)
    db.refresh(crit_complexity)

    # 9. Store Submissions in SubmissionStorage & Database
    storage = SubmissionStorage()
    stored_1001 = storage.store_bytes(CODE_1001.encode("utf-8"), "Nguyen_Van_An_1001_main.py")
    stored_1002 = storage.store_bytes(CODE_1002.encode("utf-8"), "Tran_Thi_Binh_1002_main.py")
    stored_1003 = storage.store_bytes(CODE_1003.encode("utf-8"), "Le_Van_Cuong_1003_main.py")

    sub_1001 = Submission(
        assignment_id=assignment.id,
        student_id=student_users["student_1001"].id,
        student_identifier="1001",
        student_name="Nguyen Van An",
        original_filename="main.py",
        storage_key=stored_1001.storage_key,
        size_bytes=stored_1001.size_bytes,
        sha256=stored_1001.sha256,
    )
    sub_1002 = Submission(
        assignment_id=assignment.id,
        student_id=student_users["student_1002"].id,
        student_identifier="1002",
        student_name="Tran Thi Binh",
        original_filename="main.py",
        storage_key=stored_1002.storage_key,
        size_bytes=stored_1002.size_bytes,
        sha256=stored_1002.sha256,
    )
    sub_1003 = Submission(
        assignment_id=assignment.id,
        student_id=student_users["student_1003"].id,
        student_identifier="1003",
        student_name="Le Van Cuong",
        original_filename="main.py",
        storage_key=stored_1003.storage_key,
        size_bytes=stored_1003.size_bytes,
        sha256=stored_1003.sha256,
    )
    db.add_all([sub_1001, sub_1002, sub_1003])
    db.commit()
    db.refresh(sub_1001)
    db.refresh(sub_1002)
    db.refresh(sub_1003)

    # 10. Grading Jobs & Test Results
    # Job 1 (Student 1001 - 4/4 passed)
    job_1001 = GradingJob(
        submission_id=sub_1001.id,
        status=GradingJobStatus.COMPLETED,
        started_at=utc_now(),
        completed_at=utc_now(),
        runtime_ms=120,
        total_tests=4,
        passed_tests=4,
        failed_tests=0,
        runner_output="4 passed in 0.12s",
    )
    # Job 2 (Student 1002 - 2 passed, 2 failed)
    job_1002 = GradingJob(
        submission_id=sub_1002.id,
        status=GradingJobStatus.COMPLETED,
        started_at=utc_now(),
        completed_at=utc_now(),
        runtime_ms=110,
        total_tests=4,
        passed_tests=2,
        failed_tests=2,
        failure_type="AssertionError",
        failure_information="2 test cases failed in hidden test suite",
        runner_output="2 passed, 2 failed in 0.11s",
    )
    # Job 3 (Student 1003 - 4/4 passed)
    job_1003 = GradingJob(
        submission_id=sub_1003.id,
        status=GradingJobStatus.COMPLETED,
        started_at=utc_now(),
        completed_at=utc_now(),
        runtime_ms=115,
        total_tests=4,
        passed_tests=4,
        failed_tests=0,
        runner_output="4 passed in 0.11s",
    )
    db.add_all([job_1001, job_1002, job_1003])
    db.commit()
    db.refresh(job_1001)
    db.refresh(job_1002)
    db.refresh(job_1003)

    # Test Results
    test_results_to_add = [
        # Job 1
        TestResult(
            grading_job_id=job_1001.id,
            test_case_id=tc1.id,
            test_name="test_prime_public",
            outcome=TestOutcome.PASSED,
            duration_ms=25,
        ),
        TestResult(
            grading_job_id=job_1001.id,
            test_case_id=tc2.id,
            test_name="test_fib_public",
            outcome=TestOutcome.PASSED,
            duration_ms=25,
        ),
        TestResult(
            grading_job_id=job_1001.id,
            test_case_id=tc3.id,
            test_name="test_prime_hidden",
            outcome=TestOutcome.PASSED,
            duration_ms=30,
        ),
        TestResult(
            grading_job_id=job_1001.id,
            test_case_id=tc4.id,
            test_name="test_fib_hidden",
            outcome=TestOutcome.PASSED,
            duration_ms=40,
        ),
        # Job 2
        TestResult(
            grading_job_id=job_1002.id,
            test_case_id=tc1.id,
            test_name="test_prime_public",
            outcome=TestOutcome.PASSED,
            duration_ms=20,
        ),
        TestResult(
            grading_job_id=job_1002.id,
            test_case_id=tc2.id,
            test_name="test_fib_public",
            outcome=TestOutcome.PASSED,
            duration_ms=20,
        ),
        TestResult(
            grading_job_id=job_1002.id,
            test_case_id=tc3.id,
            test_name="test_prime_hidden",
            outcome=TestOutcome.FAILED,
            duration_ms=35,
            failure_type="AssertionError",
            failure_detail="assert is_prime(-5) is False\nAssertionError: assert False is True",
        ),
        TestResult(
            grading_job_id=job_1002.id,
            test_case_id=tc4.id,
            test_name="test_fib_hidden",
            outcome=TestOutcome.FAILED,
            duration_ms=35,
            failure_type="AssertionError",
            failure_detail="assert fibonacci(10) == 55\nAssertionError: assert 5 == 55",
        ),
        # Job 3
        TestResult(
            grading_job_id=job_1003.id,
            test_case_id=tc1.id,
            test_name="test_prime_public",
            outcome=TestOutcome.PASSED,
            duration_ms=25,
        ),
        TestResult(
            grading_job_id=job_1003.id,
            test_case_id=tc2.id,
            test_name="test_fib_public",
            outcome=TestOutcome.PASSED,
            duration_ms=25,
        ),
        TestResult(
            grading_job_id=job_1003.id,
            test_case_id=tc3.id,
            test_name="test_prime_hidden",
            outcome=TestOutcome.PASSED,
            duration_ms=30,
        ),
        TestResult(
            grading_job_id=job_1003.id,
            test_case_id=tc4.id,
            test_name="test_fib_hidden",
            outcome=TestOutcome.PASSED,
            duration_ms=35,
        ),
    ]
    db.add_all(test_results_to_add)
    db.commit()

    # 11. Evidence Generation (Pytest, Ruff, AST)
    # Student 1001 Evidence
    ev_1_1 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1001.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.CORRECTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_prime_public' passed in 25ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc1.id, "test_name": "test_prime_public", "duration_ms": 25, "is_hidden": False},
    )
    ev_1_2 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1001.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.CORRECTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_fib_public' passed in 25ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc2.id, "test_name": "test_fib_public", "duration_ms": 25, "is_hidden": False},
    )
    ev_1_3 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1001.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.ROBUSTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_prime_hidden' passed in 30ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc3.id, "test_name": "test_prime_hidden", "duration_ms": 30, "is_hidden": True},
    )
    ev_1_4 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1001.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.ROBUSTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_fib_hidden' passed in 40ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc4.id, "test_name": "test_fib_hidden", "duration_ms": 40, "is_hidden": True},
    )

    # Student 1002 Evidence
    ev_2_1 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.CORRECTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_prime_public' passed in 20ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc1.id, "test_name": "test_prime_public", "duration_ms": 20, "is_hidden": False},
    )
    ev_2_2 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.CORRECTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_fib_public' passed in 20ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc2.id, "test_name": "test_fib_public", "duration_ms": 20, "is_hidden": False},
    )
    ev_2_3 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.ROBUSTNESS,
        severity=EvidenceSeverity.ERROR,
        rule_code="AssertionError",
        message="Test 'test_prime_hidden' failed: assert is_prime(-5) is False",
        metric_value=0.0,
        raw_data={"test_case_id": tc3.id, "test_name": "test_prime_hidden", "failure_type": "AssertionError", "duration_ms": 35, "is_hidden": True},
    )
    ev_2_4 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.ROBUSTNESS,
        severity=EvidenceSeverity.ERROR,
        rule_code="AssertionError",
        message="Test 'test_fib_hidden' failed: assert fibonacci(10) == 55",
        metric_value=0.0,
        raw_data={"test_case_id": tc4.id, "test_name": "test_fib_hidden", "failure_type": "AssertionError", "duration_ms": 35, "is_hidden": True},
    )
    ev_2_5 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.RUFF,
        category=EvidenceCategory.CODE_QUALITY,
        severity=EvidenceSeverity.WARNING,
        rule_code="F401",
        message="'math' imported but unused",
        location="main.py:1:8",
        metric_value=None,
    )
    ev_2_6 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.RUFF,
        category=EvidenceCategory.CODE_QUALITY,
        severity=EvidenceSeverity.WARNING,
        rule_code="F401",
        message="'sys' imported but unused",
        location="main.py:2:8",
        metric_value=None,
    )
    ev_2_7 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.AST,
        category=EvidenceCategory.COMPLEXITY,
        severity=EvidenceSeverity.WARNING,
        rule_code="COMPLEXITY_NESTING",
        message="Nested block depth of 5 exceeds threshold 4 (depth: 5)",
        location="main.py:18",
        metric_value=5.0,
    )
    ev_2_8 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.AST,
        category=EvidenceCategory.COMPLEXITY,
        severity=EvidenceSeverity.WARNING,
        rule_code="COMPLEXITY_CYCLOMATIC",
        message="Function 'fibonacci' cyclomatic complexity of 6 exceeds recommended limit 5",
        location="main.py:12",
        metric_value=6.0,
    )
    ev_2_9 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1002.id,
        assignment_id=assignment.id,
        source=EvidenceSource.AST,
        category=EvidenceCategory.COMPLEXITY,
        severity=EvidenceSeverity.WARNING,
        rule_code="COMPLEXITY_COGNITIVE",
        message="Cognitive complexity score of 9 exceeds maintainability threshold",
        location="main.py:12",
        metric_value=9.0,
    )

    # Student 1003 Evidence
    ev_3_1 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1003.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.CORRECTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_prime_public' passed in 25ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc1.id, "test_name": "test_prime_public", "duration_ms": 25, "is_hidden": False},
    )
    ev_3_2 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1003.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.CORRECTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_fib_public' passed in 25ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc2.id, "test_name": "test_fib_public", "duration_ms": 25, "is_hidden": False},
    )
    ev_3_3 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1003.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.ROBUSTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_prime_hidden' passed in 30ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc3.id, "test_name": "test_prime_hidden", "duration_ms": 30, "is_hidden": True},
    )
    ev_3_4 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1003.id,
        assignment_id=assignment.id,
        source=EvidenceSource.PYTEST,
        category=EvidenceCategory.ROBUSTNESS,
        severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED",
        message="Test 'test_fib_hidden' passed in 35ms",
        metric_value=1.0,
        raw_data={"test_case_id": tc4.id, "test_name": "test_fib_hidden", "duration_ms": 35, "is_hidden": True},
    )

    db.add_all([
        ev_1_1, ev_1_2, ev_1_3, ev_1_4,
        ev_2_1, ev_2_2, ev_2_3, ev_2_4, ev_2_5, ev_2_6, ev_2_7, ev_2_8, ev_2_9,
        ev_3_1, ev_3_2, ev_3_3, ev_3_4,
    ])
    db.commit()

    # 12. Similarity Report & Comparisons (Flagged at 85% between 1001 & 1003)
    sim_report = SimilarityReport(
        assignment_id=assignment.id,
        status=SimilarityStatus.COMPLETED,
        threshold_used=50.0,
        engine="winnowing",
        submission_count=3,
        avg_similarity=40.2,
        max_similarity=85.0,
        completed_at=utc_now(),
    )
    db.add(sim_report)
    db.commit()
    db.refresh(sim_report)

    comp_1_3 = SimilarityComparison(
        report_id=sim_report.id,
        submission_a_id=sub_1001.id,
        submission_b_id=sub_1003.id,
        similarity_percentage=85.0,
        matched_tokens=42,
        status=ComparisonReviewStatus.FLAGGED,
        review_notes="Flagged: suspected uncredited collaboration between Student 1001 and Student 1003 (85.0% similarity).",
        matched_regions=[{"lines_a": [1, 16], "lines_b": [1, 16]}],
    )
    comp_1_2 = SimilarityComparison(
        report_id=sim_report.id,
        submission_a_id=sub_1001.id,
        submission_b_id=sub_1002.id,
        similarity_percentage=18.0,
        matched_tokens=10,
        status=ComparisonReviewStatus.UNREVIEWED,
        review_notes=None,
        matched_regions=[],
    )
    comp_2_3 = SimilarityComparison(
        report_id=sim_report.id,
        submission_a_id=sub_1002.id,
        submission_b_id=sub_1003.id,
        similarity_percentage=17.5,
        matched_tokens=9,
        status=ComparisonReviewStatus.UNREVIEWED,
        review_notes=None,
        matched_regions=[],
    )
    db.add_all([comp_1_3, comp_1_2, comp_2_3])
    db.commit()

    # JPLAG Evidence for Submissions 1001 & 1003
    ev_sim_1 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1001.id,
        assignment_id=assignment.id,
        source=EvidenceSource.JPLAG,
        category=EvidenceCategory.SIMILARITY,
        severity=EvidenceSeverity.ERROR,
        rule_code="HIGH_SIMILARITY_DETECTED",
        message=f"High similarity of 85.0% detected with submission #{sub_1003.id}",
        metric_value=85.0,
        raw_data={
            "report_id": sim_report.id,
            "matched_submission_id": sub_1003.id,
            "similarity_percentage": 85.0,
            "matched_tokens": 42,
            "engine": "winnowing",
        },
    )
    ev_sim_3 = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=sub_1003.id,
        assignment_id=assignment.id,
        source=EvidenceSource.JPLAG,
        category=EvidenceCategory.SIMILARITY,
        severity=EvidenceSeverity.ERROR,
        rule_code="HIGH_SIMILARITY_DETECTED",
        message=f"High similarity of 85.0% detected with submission #{sub_1001.id}",
        metric_value=85.0,
        raw_data={
            "report_id": sim_report.id,
            "matched_submission_id": sub_1001.id,
            "similarity_percentage": 85.0,
            "matched_tokens": 42,
            "engine": "winnowing",
        },
    )
    db.add_all([ev_sim_1, ev_sim_3])
    db.commit()

    # 13. Grades, Criterion Scores, and AI Feedback
    # Grade for Student 1001 (Perfect 10.0, Confirmed)
    grade_1001 = SubmissionGrade(
        submission_id=sub_1001.id,
        rubric_id=rubric.id,
        suggested_total_score=10.0,
        final_total_score=10.0,
        status=GradeStatus.CONFIRMED,
        confirmed_by_id=lecturer.id,
        feedback_summary=(
            "### AI Feedback Summary\n\n"
            "Outstanding work! All automated public and hidden test cases pass cleanly with optimal "
            "algorithmic complexity and standard style."
        ),
        detailed_feedback={
            "summary": "Outstanding work! All automated tests passed with clean code quality and optimal structural complexity.",
            "strengths": [
                "All 4 test cases passed successfully",
                "Optimal iterative algorithm implementations with O(n) / O(sqrt(n)) time",
                "Clean adherence to Python style guidelines",
            ],
            "areas_for_improvement": [],
            "citations": [ev_1_1.id, ev_1_2.id, ev_1_3.id, ev_1_4.id],
        },
        feedback_source="rules",
    )
    db.add(grade_1001)
    db.commit()
    db.refresh(grade_1001)

    scores_1001 = [
        CriterionScore(
            submission_grade_id=grade_1001.id,
            criterion_id=crit_correctness.id,
            suggested_score=4.0,
            final_score=4.0,
            is_overridden=False,
            justification="Passed 2/2 tests (100.0%) -> 4.0/4.0 points",
        ),
        CriterionScore(
            submission_grade_id=grade_1001.id,
            criterion_id=crit_robustness.id,
            suggested_score=2.0,
            final_score=2.0,
            is_overridden=False,
            justification="Passed 2/2 tests (100.0%) -> 2.0/2.0 points",
        ),
        CriterionScore(
            submission_grade_id=grade_1001.id,
            criterion_id=crit_quality.id,
            suggested_score=2.0,
            final_score=2.0,
            is_overridden=False,
            justification="Found 0 errors, 0 warnings. Deducted 0.00 points -> 2.0/2.0 points",
        ),
        CriterionScore(
            submission_grade_id=grade_1001.id,
            criterion_id=crit_complexity.id,
            suggested_score=2.0,
            final_score=2.0,
            is_overridden=False,
            justification="0 complexity threshold violations detected. Deducted 0.00 points -> 2.0/2.0 points",
        ),
    ]
    db.add_all(scores_1001)

    # Grade for Student 1002 (Flawed 5.5, Draft)
    grade_1002 = SubmissionGrade(
        submission_id=sub_1002.id,
        rubric_id=rubric.id,
        suggested_total_score=5.5,
        final_total_score=5.5,
        status=GradeStatus.DRAFT,
        feedback_summary=(
            "### AI Feedback Summary\n\n"
            "The submission implements core components of Assignment 1: Prime and Fibonacci Analysis "
            "but failed 2 test case(s). Review edge cases and code quality diagnostics."
        ),
        detailed_feedback={
            "summary": "The submission implements core components of Assignment 1: Prime and Fibonacci Analysis but failed 2 test case(s). Review edge cases and code quality diagnostics.",
            "strengths": [
                "Passed public correctness tests for basic positive numbers",
                "Function signatures match assignment interface",
            ],
            "areas_for_improvement": [
                {
                    "evidence_id": ev_2_3.id,
                    "criterion_title": "Edge Cases & Robustness",
                    "issue": "Negative number prime test failed (assert is_prime(-5) is False)",
                    "suggestion": "Ensure is_prime validates numbers less than 2 immediately.",
                    "severity": "error",
                },
                {
                    "evidence_id": ev_2_4.id,
                    "criterion_title": "Edge Cases & Robustness",
                    "issue": "Fibonacci calculation failed for n=10 (assert fibonacci(10) == 55)",
                    "suggestion": "Review loop termination conditions and recurrence relation.",
                    "severity": "error",
                },
                {
                    "evidence_id": ev_2_5.id,
                    "criterion_title": "Code Quality",
                    "issue": "Unused import: math",
                    "suggestion": "Remove unused imports to avoid namespace pollution.",
                    "severity": "warning",
                },
                {
                    "evidence_id": ev_2_6.id,
                    "criterion_title": "Code Quality",
                    "issue": "Unused import: sys",
                    "suggestion": "Remove unused imports to avoid namespace pollution.",
                    "severity": "warning",
                },
                {
                    "evidence_id": ev_2_7.id,
                    "criterion_title": "Structural Complexity",
                    "issue": "Nested block depth of 5 exceeds threshold 4",
                    "suggestion": "Flatten nested conditional branches with early returns or loop constructs.",
                    "severity": "warning",
                },
            ],
            "citations": [ev_2_3.id, ev_2_4.id, ev_2_5.id, ev_2_6.id, ev_2_7.id],
        },
        feedback_source="rules",
    )
    db.add(grade_1002)
    db.commit()
    db.refresh(grade_1002)

    scores_1002 = [
        CriterionScore(
            submission_grade_id=grade_1002.id,
            criterion_id=crit_correctness.id,
            suggested_score=4.0,
            final_score=4.0,
            is_overridden=False,
            justification="Passed 2/2 tests (100.0%) -> 4.0/4.0 points",
        ),
        CriterionScore(
            submission_grade_id=grade_1002.id,
            criterion_id=crit_robustness.id,
            suggested_score=0.0,
            final_score=0.0,
            is_overridden=False,
            justification="Passed 0/2 tests (0.0%) -> 0.0/2.0 points",
        ),
        CriterionScore(
            submission_grade_id=grade_1002.id,
            criterion_id=crit_quality.id,
            suggested_score=1.0,
            final_score=1.0,
            is_overridden=False,
            justification="Found 0 errors, 2 warnings. Deducted 1.00 points -> 1.0/2.0 points",
        ),
        CriterionScore(
            submission_grade_id=grade_1002.id,
            criterion_id=crit_complexity.id,
            suggested_score=0.5,
            final_score=0.5,
            is_overridden=False,
            justification="3 complexity threshold violations detected. Deducted 1.50 points -> 0.5/2.0 points",
        ),
    ]
    db.add_all(scores_1002)

    # Grade for Student 1003 (Plagiarized 6.0, Draft)
    grade_1003 = SubmissionGrade(
        submission_id=sub_1003.id,
        rubric_id=rubric.id,
        suggested_total_score=10.0,
        final_total_score=6.0,
        status=GradeStatus.DRAFT,
        feedback_summary=(
            "### AI Feedback Summary\n\n"
            "All automated test cases passed. However, notable source code similarity (85%) was detected "
            "with peer submission #1001. Awaiting instructor review."
        ),
        detailed_feedback={
            "summary": "All automated test cases passed. However, notable source code similarity (85%) was detected with peer submission #1001. Awaiting instructor review.",
            "strengths": ["All 4 test cases passed successfully"],
            "areas_for_improvement": [
                {
                    "evidence_id": ev_sim_3.id,
                    "criterion_title": "Academic Integrity Review",
                    "issue": "High similarity of 85.0% detected with submission #1001",
                    "suggestion": "Code structure exhibits high similarity with peer solutions; flagged for instructor review.",
                    "severity": "warning",
                }
            ],
            "citations": [ev_sim_3.id],
        },
        feedback_source="rules",
    )
    db.add(grade_1003)
    db.commit()
    db.refresh(grade_1003)

    scores_1003 = [
        CriterionScore(
            submission_grade_id=grade_1003.id,
            criterion_id=crit_correctness.id,
            suggested_score=4.0,
            final_score=4.0,
            is_overridden=False,
            justification="Passed 2/2 tests (100.0%) -> 4.0/4.0 points",
        ),
        CriterionScore(
            submission_grade_id=grade_1003.id,
            criterion_id=crit_robustness.id,
            suggested_score=2.0,
            final_score=2.0,
            is_overridden=False,
            justification="Passed 2/2 tests (100.0%) -> 2.0/2.0 points",
        ),
        CriterionScore(
            submission_grade_id=grade_1003.id,
            criterion_id=crit_quality.id,
            suggested_score=2.0,
            final_score=0.0,
            is_overridden=True,
            justification="Flagged for academic integrity review: 85% similarity with Student 1001.",
        ),
        CriterionScore(
            submission_grade_id=grade_1003.id,
            criterion_id=crit_complexity.id,
            suggested_score=2.0,
            final_score=0.0,
            is_overridden=True,
            justification="Flagged for academic integrity review: 85% similarity with Student 1001.",
        ),
    ]
    db.add_all(scores_1003)
    db.commit()

    # 14. Issue Access Token for Demo Lecturer
    token = create_access_token(
        data={
            "sub": lecturer.username,
            "user_id": lecturer.id,
            "role": lecturer.role.value,
        }
    )

    sample_submissions = [
        DemoSampleSubmission(
            id=sub_1001.id,
            student_name=sub_1001.student_name or "",
            student_code=sub_1001.student_identifier,
            grade_status=GradeStatus.CONFIRMED.value,
            final_score=10.0,
        ),
        DemoSampleSubmission(
            id=sub_1002.id,
            student_name=sub_1002.student_name or "",
            student_code=sub_1002.student_identifier,
            grade_status=GradeStatus.DRAFT.value,
            final_score=5.5,
        ),
        DemoSampleSubmission(
            id=sub_1003.id,
            student_name=sub_1003.student_name or "",
            student_code=sub_1003.student_identifier,
            grade_status=GradeStatus.DRAFT.value,
            final_score=6.0,
        ),
    ]

    return DemoSeedResponse(
        access_token=token,
        token_type="bearer",
        user=DemoUserResponse(
            id=lecturer.id,
            username=lecturer.username,
            email=lecturer.email,
            full_name=lecturer.full_name,
            role=lecturer.role.value,
        ),
        course_id=course.id,
        class_id=cohort.id,
        assignment_id=assignment.id,
        sample_submissions=sample_submissions,
    )


def seed_demo_environment(db: Session, reset: bool = False) -> DemoSeedResponse:
    """Idempotently seed the complete interactive demo environment with concurrency protection."""
    with _demo_lock:
        if db is not None:
            db.rollback()
        if not reset and db is not None:
            existing = _get_existing_demo_response(db)
            if existing:
                return existing

        try:
            return _build_demo_environment(db, reset=reset)
        except IntegrityError:
            if db is not None:
                db.rollback()
            if not reset and db is not None:
                for _ in range(10):
                    time.sleep(0.2)
                    if db is not None:
                        db.rollback()
                    existing = _get_existing_demo_response(db)
                    if existing:
                        return existing
            raise


@router.post("/seed", response_model=DemoSeedResponse)
def seed_demo(
    reset: bool = Query(default=False),
    db: Annotated[Session, Depends(get_db)] = None,
) -> DemoSeedResponse:
    """Publicly accessible idempotent endpoint to seed demo environment."""
    return seed_demo_environment(db, reset=reset)


@router.post("/reset", response_model=DemoResetResponse)
def reset_demo(
    db: Annotated[Session, Depends(get_db)] = None,
) -> DemoResetResponse:
    """Reset demo course and submissions back to initial baseline."""
    seed_demo_environment(db, reset=True)
    return DemoResetResponse(
        status="success",
        message="Demo environment reset to baseline.",
    )


@router.get("/sample-zip")
def get_demo_sample_zip() -> Response:
    """Stream an in-memory zip containing student solutions formatted for LMS batch upload."""
    archive_bytes = generate_sample_zip()
    return Response(
        content=archive_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="demo_submissions.zip"',
        },
    )
