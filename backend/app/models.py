from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional

import sqlalchemy as sa
from sqlalchemy import Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


# =====================================================================
# Enums
# =====================================================================

class CriterionType(str, enum.Enum):
    FUNCTIONAL_TEST = "FUNCTIONAL_TEST"
    CODE_QUALITY = "CODE_QUALITY"
    AST_STRUCTURE = "AST_STRUCTURE"
    CUSTOM = "CUSTOM"


class SubmissionStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    EXECUTING = "EXECUTING"
    ANALYZED = "ANALYZED"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"
    APPROVED = "APPROVED"
    FLAGGED = "FLAGGED"


class ExecutionStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
    ERROR = "ERROR"


class ConfidenceTier(str, enum.Enum):
    VERY_LOW = "VERY_LOW"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    VERY_HIGH = "VERY_HIGH"


class ReviewStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    MODIFIED = "MODIFIED"
    INTERVIEW_REQUESTED = "INTERVIEW_REQUESTED"


# =====================================================================
# 1. Lecturer
# =====================================================================

class Lecturer(Base):
    __tablename__ = "lecturers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        sa.String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(sa.String(150), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )

    # Relationships
    courses: Mapped[List[Course]] = relationship(
        "Course",
        back_populates="lecturer",
        passive_deletes="all",
    )
    reviews_conducted: Mapped[List[LecturerReview]] = relationship(
        "LecturerReview",
        back_populates="reviewer",
        passive_deletes=True,
    )


# =====================================================================
# 2. Course
# =====================================================================

class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        sa.UniqueConstraint("code", "semester", name="uq_courses_code_semester"),
        sa.Index("ix_courses_lecturer_created", "lecturer_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    lecturer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("lecturers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    semester: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )

    # Relationships
    lecturer: Mapped[Lecturer] = relationship("Lecturer", back_populates="courses")
    assignments: Mapped[List[Assignment]] = relationship(
        "Assignment",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


# =====================================================================
# 3. Assignment
# =====================================================================

class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        sa.CheckConstraint("max_score > 0", name="ck_assignment_positive_score"),
        sa.CheckConstraint("timeout_sec > 0 AND timeout_sec <= 600", name="ck_assignment_timeout_range"),
        sa.CheckConstraint("memory_limit_mb >= 32 AND memory_limit_mb <= 2048", name="ck_assignment_memory_range"),
        sa.Index("ix_assignments_course_deadline", "course_id", "deadline"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    deadline: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    max_score: Mapped[Decimal] = mapped_column(sa.Numeric(6, 2), default=Decimal("10.00"), nullable=False)
    timeout_sec: Mapped[int] = mapped_column(sa.Integer, default=10, nullable=False)
    memory_limit_mb: Mapped[int] = mapped_column(sa.Integer, default=256, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )

    # Relationships
    course: Mapped[Course] = relationship("Course", back_populates="assignments")
    rubric: Mapped[Optional[Rubric]] = relationship(
        "Rubric",
        back_populates="assignment",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    test_cases: Mapped[List[TestCase]] = relationship(
        "TestCase",
        back_populates="assignment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    submissions: Mapped[List[Submission]] = relationship(
        "Submission",
        back_populates="assignment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    similarity_pairs: Mapped[List[SimilarityPair]] = relationship(
        "SimilarityPair",
        back_populates="assignment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


# =====================================================================
# 4. Rubric & RubricCriterion
# =====================================================================

class Rubric(Base):
    __tablename__ = "rubrics"
    __table_args__ = (
        sa.UniqueConstraint("assignment_id", name="uq_rubrics_assignment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(sa.String(150), default="Standard Grading Rubric", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )

    # Relationships
    assignment: Mapped[Assignment] = relationship("Assignment", back_populates="rubric")
    criteria: Mapped[List[RubricCriterion]] = relationship(
        "RubricCriterion",
        back_populates="rubric",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="RubricCriterion.order_index",
    )


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"
    __table_args__ = (
        sa.CheckConstraint("weight >= 0.0 AND weight <= 1.0", name="ck_rubric_criterion_weight_range"),
        sa.CheckConstraint("max_points >= 0.0", name="ck_rubric_criterion_positive_points"),
        sa.Index("ix_rubric_criteria_rubric_type", "rubric_id", "criterion_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    rubric_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("rubrics.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(sa.String(150), nullable=False)
    criterion_type: Mapped[CriterionType] = mapped_column(
        sa.Enum(CriterionType),
        nullable=False,
    )
    weight: Mapped[Decimal] = mapped_column(sa.Numeric(5, 4), default=Decimal("0.2500"), nullable=False)
    max_points: Mapped[Decimal] = mapped_column(sa.Numeric(6, 2), nullable=False)
    evaluation_config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    order_index: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)

    # Relationships
    rubric: Mapped[Rubric] = relationship("Rubric", back_populates="criteria")


# =====================================================================
# 5. TestCase
# =====================================================================

class TestCase(Base):
    __tablename__ = "test_cases"
    __table_args__ = (
        sa.CheckConstraint("weight >= 0.0", name="ck_test_case_weight_positive"),
        sa.CheckConstraint("timeout_ms >= 50 AND timeout_ms <= 60000", name="ck_test_case_timeout_range"),
        sa.Index("ix_test_cases_assignment_hidden", "assignment_id", "is_hidden"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(sa.String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    input_data: Mapped[str] = mapped_column(sa.Text, nullable=False)
    expected_output: Mapped[str] = mapped_column(sa.Text, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(sa.Boolean, default=False, nullable=False)
    weight: Mapped[Decimal] = mapped_column(sa.Numeric(5, 2), default=Decimal("1.00"), nullable=False)
    timeout_ms: Mapped[int] = mapped_column(sa.Integer, default=3000, nullable=False)

    # Relationships
    assignment: Mapped[Assignment] = relationship("Assignment", back_populates="test_cases")


# =====================================================================
# 6. Submission
# =====================================================================

class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        sa.Index("ix_submissions_assignment_status", "assignment_id", "status"),
        sa.Index("ix_submissions_assignment_student", "assignment_id", "student_identifier"),
        sa.Index("ix_submissions_assignment_submitted", "assignment_id", "submitted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_identifier: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    student_name: Mapped[str] = mapped_column(sa.String(150), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )
    status: Mapped[SubmissionStatus] = mapped_column(
        sa.Enum(SubmissionStatus),
        default=SubmissionStatus.QUEUED,
        nullable=False,
        index=True,
    )
    raw_archive_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)  # SHA-256
    storage_path: Mapped[str] = mapped_column(sa.String(512), nullable=False)

    # Relationships
    assignment: Mapped[Assignment] = relationship("Assignment", back_populates="submissions")
    files: Mapped[List[SubmissionFile]] = relationship(
        "SubmissionFile",
        back_populates="submission",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    execution_result: Mapped[Optional[ExecutionResult]] = relationship(
        "ExecutionResult",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    quality_metric: Mapped[Optional[QualityMetric]] = relationship(
        "QualityMetric",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    ai_detection_signal: Mapped[Optional[AIDetectionSignal]] = relationship(
        "AIDetectionSignal",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    ai_feedback_draft: Mapped[Optional[AIFeedbackDraft]] = relationship(
        "AIFeedbackDraft",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lecturer_review: Mapped[Optional[LecturerReview]] = relationship(
        "LecturerReview",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


# =====================================================================
# 7. SubmissionFile
# =====================================================================

class SubmissionFile(Base):
    __tablename__ = "submission_files"
    __table_args__ = (
        sa.UniqueConstraint("submission_id", "relative_path", name="uq_submission_file_path"),
        sa.Index("ix_submission_files_submission_path", "submission_id", "relative_path"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relative_path: Mapped[str] = mapped_column(sa.String(512), nullable=False)
    file_content: Mapped[str] = mapped_column(sa.Text, nullable=False)

    # Relationships
    submission: Mapped[Submission] = relationship("Submission", back_populates="files")


# =====================================================================
# 8. ExecutionResult
# =====================================================================

class ExecutionResult(Base):
    __tablename__ = "execution_results"
    __table_args__ = (
        sa.UniqueConstraint("submission_id", name="uq_execution_results_submission"),
        sa.CheckConstraint("passed_count >= 0", name="ck_exec_passed_positive"),
        sa.CheckConstraint("failed_count >= 0", name="ck_exec_failed_positive"),
        sa.CheckConstraint("total_count >= 0", name="ck_exec_total_positive"),
        sa.CheckConstraint("execution_time_ms >= 0", name="ck_exec_time_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[ExecutionStatus] = mapped_column(
        sa.Enum(ExecutionStatus),
        nullable=False,
    )
    passed_count: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    total_count: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    execution_time_ms: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    test_details: Mapped[list[Any]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )

    # Relationships
    submission: Mapped[Submission] = relationship("Submission", back_populates="execution_result")


# =====================================================================
# 9. QualityMetric
# =====================================================================

class QualityMetric(Base):
    __tablename__ = "quality_metrics"
    __table_args__ = (
        sa.UniqueConstraint("submission_id", name="uq_quality_metrics_submission"),
        sa.CheckConstraint("cyclomatic_complexity_max >= 0", name="ck_qm_cc_max_positive"),
        sa.CheckConstraint("cyclomatic_complexity_avg >= 0.0", name="ck_qm_cc_avg_positive"),
        sa.CheckConstraint("max_nesting_depth >= 0", name="ck_qm_nesting_positive"),
        sa.CheckConstraint("loc_total >= 0", name="ck_qm_loc_positive"),
        sa.CheckConstraint("function_count >= 0", name="ck_qm_fn_count_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    cyclomatic_complexity_max: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    cyclomatic_complexity_avg: Mapped[Decimal] = mapped_column(sa.Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    max_nesting_depth: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    loc_total: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    function_count: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    banned_imports_found: Mapped[list[Any]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    ruff_violations: Mapped[list[Any]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )

    # Relationships
    submission: Mapped[Submission] = relationship("Submission", back_populates="quality_metric")


# =====================================================================
# 10. SimilarityPair
# =====================================================================

class SimilarityPair(Base):
    __tablename__ = "similarity_pairs"
    __table_args__ = (
        sa.CheckConstraint(
            "similarity_score >= 0.0000 AND similarity_score <= 1.0000",
            name="ck_similarity_score_range",
        ),
        sa.UniqueConstraint(
            "assignment_id",
            "submission_a_id",
            "submission_b_id",
            "algorithm",
            name="uq_similarity_assignment_pair_algo",
        ),
        sa.Index(
            "ix_similarity_assignment_score",
            "assignment_id",
            "similarity_score",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submission_a_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submission_b_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    similarity_score: Mapped[Decimal] = mapped_column(sa.Numeric(5, 4), nullable=False)
    algorithm: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    matched_spans: Mapped[list[Any]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )

    # Relationships
    assignment: Mapped[Assignment] = relationship("Assignment", back_populates="similarity_pairs")
    submission_a: Mapped[Submission] = relationship("Submission", foreign_keys=[submission_a_id])
    submission_b: Mapped[Submission] = relationship("Submission", foreign_keys=[submission_b_id])


# =====================================================================
# 11. AIDetectionSignal
# =====================================================================

class AIDetectionSignal(Base):
    __tablename__ = "ai_detection_signals"
    __table_args__ = (
        sa.UniqueConstraint("submission_id", name="uq_ai_detection_submission"),
        sa.CheckConstraint(
            "probability_score >= 0.0000 AND probability_score <= 1.0000",
            name="ck_ai_detection_score_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    probability_score: Mapped[Decimal] = mapped_column(sa.Numeric(5, 4), nullable=False)
    confidence_tier: Mapped[ConfidenceTier] = mapped_column(
        sa.Enum(ConfidenceTier),
        nullable=False,
    )
    indicators: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    disclaimer: Mapped[str] = mapped_column(
        sa.Text,
        default=(
            "AI detection signals are probabilistic heuristics and should not be used "
            "as sole evidence for academic misconduct without instructor verification."
        ),
        nullable=False,
    )

    # Relationships
    submission: Mapped[Submission] = relationship("Submission", back_populates="ai_detection_signal")


# =====================================================================
# 12. AIFeedbackDraft
# =====================================================================

class AIFeedbackDraft(Base):
    __tablename__ = "ai_feedback_drafts"
    __table_args__ = (
        sa.UniqueConstraint("submission_id", name="uq_ai_feedback_submission"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(sa.Text, nullable=False)
    strengths: Mapped[list[Any]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    weaknesses: Mapped[list[Any]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    remediation_steps: Mapped[list[Any]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    model_identifier: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )

    # Relationships
    submission: Mapped[Submission] = relationship("Submission", back_populates="ai_feedback_draft")


# =====================================================================
# 13. LecturerReview
# =====================================================================

class LecturerReview(Base):
    __tablename__ = "lecturer_reviews"
    __table_args__ = (
        sa.UniqueConstraint("submission_id", name="uq_lecturer_reviews_submission"),
        sa.CheckConstraint("automated_grade >= 0.00", name="ck_review_auto_grade_positive"),
        sa.CheckConstraint("final_grade >= 0.00", name="ck_review_final_grade_positive"),
        sa.Index("ix_lecturer_reviews_reviewer_status", "reviewer_id", "status"),
        sa.Index("ix_lecturer_reviews_reviewed_at", "reviewed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        sa.ForeignKey("lecturers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    automated_grade: Mapped[Decimal] = mapped_column(sa.Numeric(6, 2), nullable=False)
    final_grade: Mapped[Decimal] = mapped_column(sa.Numeric(6, 2), nullable=False)
    grade_adjustments: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    feedback_override: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    status: Mapped[ReviewStatus] = mapped_column(
        sa.Enum(ReviewStatus),
        default=ReviewStatus.APPROVED,
        nullable=False,
        index=True,
    )
    internal_notes: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )
    version_id: Mapped[int] = mapped_column(sa.Integer, default=1, nullable=False)

    __mapper_args__ = {
        "version_id_col": version_id,
    }

    # Relationships
    submission: Mapped[Submission] = relationship("Submission", back_populates="lecturer_review")
    reviewer: Mapped[Optional[Lecturer]] = relationship("Lecturer", back_populates="reviews_conducted")
