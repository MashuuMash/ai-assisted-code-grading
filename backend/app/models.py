import enum
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    LECTURER = "lecturer"
    STUDENT = "student"


role_type = Enum(
    UserRole,
    name="userrole",
    values_callable=lambda roles: [role.value for role in roles],
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(role_type, default=UserRole.STUDENT, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    courses: Mapped[list["Course"]] = relationship(back_populates="instructor")
    class_memberships: Mapped[list["ClassMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    submissions: Mapped[list["Submission"]] = relationship(back_populates="student")


class AssignmentStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


assignment_status_type = Enum(
    AssignmentStatus,
    name="assignmentstatus",
    values_callable=lambda statuses: [status.value for status in statuses],
)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    instructor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    instructor: Mapped[User] = relationship(back_populates="courses")
    classes: Mapped[list["Cohort"]] = relationship(back_populates="course", cascade="all, delete-orphan")


class Cohort(Base):
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("course_id", "code", name="uq_classes_course_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    semester: Mapped[str] = mapped_column(String(50))
    year: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    course: Mapped[Course] = relationship(back_populates="classes")
    memberships: Mapped[list["ClassMembership"]] = relationship(
        back_populates="class_", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="class_", cascade="all, delete-orphan"
    )


Class = Cohort


class ClassMembership(Base):
    __tablename__ = "class_memberships"
    __table_args__ = (UniqueConstraint("user_id", "class_id", name="uq_class_memberships_user_class"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped[User] = relationship(back_populates="class_memberships")
    class_: Mapped[Cohort] = relationship(back_populates="memberships")


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    instructions: Mapped[str | None] = mapped_column(Text, default=None)
    language: Mapped[str] = mapped_column(String(20), default="python")
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None, index=True)
    status: Mapped[AssignmentStatus] = mapped_column(assignment_status_type, default=AssignmentStatus.DRAFT, index=True)
    base_code: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    class_: Mapped[Cohort] = relationship(back_populates="assignments")
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )
    test_cases: Mapped[list["TestCase"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )
    evidence_records: Mapped[list["SubmissionEvidence"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )
    rubric: Mapped["Rubric | None"] = relationship(
        back_populates="assignment", uselist=False, cascade="all, delete-orphan"
    )
    similarity_reports: Mapped[list["SimilarityReport"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, default=None, index=True
    )
    student_identifier: Mapped[str] = mapped_column(String(128), index=True, default="")
    student_name: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    assignment: Mapped[Assignment] = relationship(back_populates="submissions")
    student: Mapped[User | None] = relationship(back_populates="submissions")
    grading_jobs: Mapped[list["GradingJob"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )
    evidence_records: Mapped[list["SubmissionEvidence"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )
    grade: Mapped["SubmissionGrade | None"] = relationship(
        back_populates="submission", uselist=False, cascade="all, delete-orphan"
    )


class TestVisibility(str, enum.Enum):
    __test__ = False
    PUBLIC = "public"
    HIDDEN = "hidden"


class GradingJobStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class TestOutcome(str, enum.Enum):
    __test__ = False
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"


test_visibility_type = Enum(
    TestVisibility,
    name="testvisibility",
    values_callable=lambda vals: [v.value for v in vals],
)
grading_job_status_type = Enum(
    GradingJobStatus,
    name="gradingjobstatus",
    values_callable=lambda vals: [v.value for v in vals],
)
test_outcome_type = Enum(
    TestOutcome,
    name="testoutcome",
    values_callable=lambda vals: [v.value for v in vals],
)


class TestCase(Base):
    __test__ = False
    __tablename__ = "test_cases"
    __table_args__ = (UniqueConstraint("assignment_id", "name", name="uq_test_cases_assignment_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    visibility: Mapped[TestVisibility] = mapped_column(test_visibility_type, default=TestVisibility.PUBLIC, index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    assignment: Mapped[Assignment] = relationship(back_populates="test_cases")
    results: Mapped[list["TestResult"]] = relationship(back_populates="test_case")


class GradingJob(Base):
    __tablename__ = "grading_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), index=True)
    status: Mapped[GradingJobStatus] = mapped_column(grading_job_status_type, default=GradingJobStatus.QUEUED, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    runtime_ms: Mapped[int | None] = mapped_column(Integer, default=None)
    total_tests: Mapped[int] = mapped_column(Integer, default=0)
    passed_tests: Mapped[int] = mapped_column(Integer, default=0)
    failed_tests: Mapped[int] = mapped_column(Integer, default=0)
    failure_type: Mapped[str | None] = mapped_column(String(50), default=None)
    failure_information: Mapped[str | None] = mapped_column(Text, default=None)
    runner_output: Mapped[str | None] = mapped_column(Text, default=None)

    submission: Mapped[Submission] = relationship(back_populates="grading_jobs")
    results: Mapped[list["TestResult"]] = relationship(back_populates="grading_job", cascade="all, delete-orphan")


class TestResult(Base):
    __test__ = False
    __tablename__ = "test_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    grading_job_id: Mapped[int] = mapped_column(ForeignKey("grading_jobs.id", ondelete="CASCADE"), index=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="RESTRICT"), index=True)
    test_name: Mapped[str] = mapped_column(String(500))
    outcome: Mapped[TestOutcome] = mapped_column(test_outcome_type, index=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    failure_type: Mapped[str | None] = mapped_column(String(50), default=None)
    failure_detail: Mapped[str | None] = mapped_column(Text, default=None)

    grading_job: Mapped[GradingJob] = relationship(back_populates="results")
    test_case: Mapped[TestCase] = relationship(back_populates="results")


class EvidenceSource(str, enum.Enum):
    PYTEST = "pytest"
    RUFF = "ruff"
    AST = "ast"
    JPLAG = "jplag"
    CODEBERT = "codebert"


class EvidenceCategory(str, enum.Enum):
    CORRECTNESS = "correctness"
    ROBUSTNESS = "robustness"
    CODE_QUALITY = "code_quality"
    COMPLEXITY = "complexity"
    SIMILARITY = "similarity"


class EvidenceSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


evidence_source_type = Enum(
    EvidenceSource,
    name="evidencesource",
    values_callable=lambda vals: [v.value for v in vals],
)
evidence_category_type = Enum(
    EvidenceCategory,
    name="evidencecategory",
    values_callable=lambda vals: [v.value for v in vals],
)
evidence_severity_type = Enum(
    EvidenceSeverity,
    name="evidenceseverity",
    values_callable=lambda vals: [v.value for v in vals],
)


class SubmissionEvidence(Base):
    __tablename__ = "submission_evidence"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), index=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    source: Mapped[EvidenceSource] = mapped_column(evidence_source_type, index=True)
    category: Mapped[EvidenceCategory] = mapped_column(evidence_category_type, index=True)
    severity: Mapped[EvidenceSeverity] = mapped_column(evidence_severity_type, index=True)
    rule_code: Mapped[str] = mapped_column(String(64), index=True)
    message: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metric_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    submission: Mapped[Submission] = relationship(back_populates="evidence_records")
    assignment: Mapped[Assignment] = relationship(back_populates="evidence_records")


class EvaluationType(str, enum.Enum):
    AUTOMATED_TEST = "automated_test"
    CODE_QUALITY = "code_quality"
    STRUCTURAL_COMPLEXITY = "structural_complexity"
    MANUAL = "manual"


class GradeStatus(str, enum.Enum):
    PENDING = "pending"
    DRAFT = "draft"
    CONFIRMED = "confirmed"


evaluation_type_enum = Enum(
    EvaluationType,
    name="evaluationtype",
    values_callable=lambda vals: [v.value for v in vals],
)

grade_status_enum = Enum(
    GradeStatus,
    name="gradestatus",
    values_callable=lambda vals: [v.value for v in vals],
)


class Rubric(Base):
    __tablename__ = "rubrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"), unique=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    max_score: Mapped[float] = mapped_column(Float, default=10.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    assignment: Mapped[Assignment] = relationship(back_populates="rubric")
    criteria: Mapped[list["RubricCriterion"]] = relationship(
        back_populates="rubric", cascade="all, delete-orphan", order_by="RubricCriterion.order_index"
    )
    submission_grades: Mapped[list["SubmissionGrade"]] = relationship(back_populates="rubric")


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"

    id: Mapped[int] = mapped_column(primary_key=True)
    rubric_id: Mapped[int] = mapped_column(ForeignKey("rubrics.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    category: Mapped[EvidenceCategory] = mapped_column(evidence_category_type, index=True)
    evaluation_type: Mapped[EvaluationType] = mapped_column(evaluation_type_enum, index=True)
    weight_percentage: Mapped[float] = mapped_column(Float)
    max_points: Mapped[float] = mapped_column(Float)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    rubric: Mapped[Rubric] = relationship(back_populates="criteria")
    criterion_scores: Mapped[list["CriterionScore"]] = relationship(
        back_populates="criterion", cascade="all, delete-orphan"
    )


class SubmissionGrade(Base):
    __tablename__ = "submission_grades"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, index=True
    )
    rubric_id: Mapped[int] = mapped_column(ForeignKey("rubrics.id", ondelete="RESTRICT"), index=True)
    suggested_total_score: Mapped[float] = mapped_column(Float, default=0.0)
    final_total_score: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    status: Mapped[GradeStatus] = mapped_column(grade_status_enum, default=GradeStatus.DRAFT, index=True)
    feedback_summary: Mapped[str | None] = mapped_column(Text, default=None)
    detailed_feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    graded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    confirmed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    submission: Mapped[Submission] = relationship(back_populates="grade")
    rubric: Mapped[Rubric] = relationship(back_populates="submission_grades")
    criterion_scores: Mapped[list["CriterionScore"]] = relationship(
        back_populates="submission_grade", cascade="all, delete-orphan"
    )


class CriterionScore(Base):
    __tablename__ = "criterion_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_grade_id: Mapped[int] = mapped_column(
        ForeignKey("submission_grades.id", ondelete="CASCADE"), index=True
    )
    criterion_id: Mapped[int] = mapped_column(ForeignKey("rubric_criteria.id", ondelete="CASCADE"), index=True)
    suggested_score: Mapped[float] = mapped_column(Float, default=0.0)
    final_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    justification: Mapped[str | None] = mapped_column(Text, default=None)

    submission_grade: Mapped[SubmissionGrade] = relationship(back_populates="criterion_scores")
    criterion: Mapped[RubricCriterion] = relationship(back_populates="criterion_scores")


class SimilarityStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ComparisonReviewStatus(str, enum.Enum):
    UNREVIEWED = "unreviewed"
    FLAGGED = "flagged"
    DISMISSED = "dismissed"


similarity_status_enum = Enum(
    SimilarityStatus,
    name="similaritystatus",
    values_callable=lambda vals: [v.value for v in vals],
)

comparison_review_status_enum = Enum(
    ComparisonReviewStatus,
    name="comparisonreviewstatus",
    values_callable=lambda vals: [v.value for v in vals],
)


class SimilarityReport(Base):
    __tablename__ = "similarity_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[SimilarityStatus] = mapped_column(
        similarity_status_enum, default=SimilarityStatus.QUEUED, index=True
    )
    threshold_used: Mapped[float] = mapped_column(Float, default=50.0)
    submission_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_similarity: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    max_similarity: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    report_path: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    assignment: Mapped[Assignment] = relationship(back_populates="similarity_reports")
    comparisons: Mapped[list["SimilarityComparison"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="SimilarityComparison.similarity_percentage.desc()"
    )


class SimilarityComparison(Base):
    __tablename__ = "similarity_comparisons"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("similarity_reports.id", ondelete="CASCADE"), index=True
    )
    submission_a_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    submission_b_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    similarity_percentage: Mapped[float] = mapped_column(Float, index=True)
    matched_tokens: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[ComparisonReviewStatus] = mapped_column(
        comparison_review_status_enum, default=ComparisonReviewStatus.UNREVIEWED, index=True
    )
    matched_regions: Mapped[list | None] = mapped_column(JSON, nullable=True, default=None)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    report: Mapped[SimilarityReport] = relationship(back_populates="comparisons")
    submission_a: Mapped[Submission] = relationship(foreign_keys=[submission_a_id])
    submission_b: Mapped[Submission] = relationship(foreign_keys=[submission_b_id])


