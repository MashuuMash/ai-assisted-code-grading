"""secure grading migration

Revision ID: 003_secure_grading
Revises: 002_assignment_submission
Create Date: 2026-09-16 21:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "003_secure_grading"
down_revision: Union[str, None] = "002_assignment_submission"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    testvis_enum = postgresql.ENUM("public", "hidden", name="testvisibility", create_type=False)
    jobstatus_enum = postgresql.ENUM("queued", "running", "completed", "failed", "timeout", name="gradingjobstatus", create_type=False)
    testoutcome_enum = postgresql.ENUM("passed", "failed", "error", name="testoutcome", create_type=False)

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        testvis_enum.create(bind, checkfirst=True)
        jobstatus_enum.create(bind, checkfirst=True)
        testoutcome_enum.create(bind, checkfirst=True)

    op.create_table(
        "test_cases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("visibility", sa.Enum("public", "hidden", name="testvisibility"), server_default="public", nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("assignment_id", "name", name="uq_test_cases_assignment_name"),
    )
    op.create_index("ix_test_cases_assignment_id", "test_cases", ["assignment_id"])
    op.create_index("ix_test_cases_visibility", "test_cases", ["visibility"])

    op.create_table(
        "grading_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Enum("queued", "running", "completed", "failed", "timeout", name="gradingjobstatus"), server_default="queued", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("runtime_ms", sa.Integer(), nullable=True),
        sa.Column("total_tests", sa.Integer(), server_default="0", nullable=False),
        sa.Column("passed_tests", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failed_tests", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failure_type", sa.String(length=50), nullable=True),
        sa.Column("failure_information", sa.Text(), nullable=True),
        sa.Column("runner_output", sa.Text(), nullable=True),
    )
    op.create_index("ix_grading_jobs_submission_id", "grading_jobs", ["submission_id"])
    op.create_index("ix_grading_jobs_status", "grading_jobs", ["status"])

    op.create_table(
        "test_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("grading_job_id", sa.Integer(), sa.ForeignKey("grading_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_case_id", sa.Integer(), sa.ForeignKey("test_cases.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("test_name", sa.String(length=500), nullable=False),
        sa.Column("outcome", sa.Enum("passed", "failed", "error", name="testoutcome"), nullable=False),
        sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failure_type", sa.String(length=50), nullable=True),
        sa.Column("failure_detail", sa.Text(), nullable=True),
    )
    op.create_index("ix_test_results_grading_job_id", "test_results", ["grading_job_id"])
    op.create_index("ix_test_results_test_case_id", "test_results", ["test_case_id"])
    op.create_index("ix_test_results_outcome", "test_results", ["outcome"])


def downgrade() -> None:
    op.drop_table("test_results")
    op.drop_table("grading_jobs")
    op.drop_table("test_cases")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        testvis_enum = postgresql.ENUM("public", "hidden", name="testvisibility")
        jobstatus_enum = postgresql.ENUM("queued", "running", "completed", "failed", "timeout", name="gradingjobstatus")
        testoutcome_enum = postgresql.ENUM("passed", "failed", "error", name="testoutcome")
        testoutcome_enum.drop(bind, checkfirst=True)
        jobstatus_enum.drop(bind, checkfirst=True)
        testvis_enum.drop(bind, checkfirst=True)
