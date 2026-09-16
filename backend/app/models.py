import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
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


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    assignment: Mapped[Assignment] = relationship(back_populates="submissions")
    student: Mapped[User] = relationship(back_populates="submissions")
    grading_jobs: Mapped[list["GradingJob"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
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
