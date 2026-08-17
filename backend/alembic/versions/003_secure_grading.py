"""Add Phase 3 test cases, grading jobs, and structured results."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "003_secure_grading"
down_revision = "002_assignment_submission"
branch_labels = None
depends_on = None


def enum_type(name: str, *values: str) -> postgresql.ENUM:
    creation_type = postgresql.ENUM(*values, name=name)
    creation_type.create(op.get_bind(), checkfirst=True)
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    visibility = enum_type("testvisibility", "public", "hidden")
    job_status = enum_type("gradingjobstatus", "queued", "running", "completed", "failed", "timeout")
    outcome = enum_type("testoutcome", "passed", "failed", "error")
    op.create_table(
        "test_cases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("visibility", visibility, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("assignment_id", "name", name="uq_test_cases_assignment_name"),
    )
    op.create_index("ix_test_cases_assignment_id", "test_cases", ["assignment_id"])
    op.create_index("ix_test_cases_visibility", "test_cases", ["visibility"])
    op.create_table(
        "grading_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("status", job_status, nullable=False, server_default="queued"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("runtime_ms", sa.Integer()),
        sa.Column("total_tests", sa.Integer(), server_default="0", nullable=False),
        sa.Column("passed_tests", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failed_tests", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failure_type", sa.String(50)),
        sa.Column("failure_information", sa.Text()),
        sa.Column("runner_output", sa.Text()),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_grading_jobs_submission_id", "grading_jobs", ["submission_id"])
    op.create_index("ix_grading_jobs_status", "grading_jobs", ["status"])
    op.create_table(
        "test_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("grading_job_id", sa.Integer(), nullable=False),
        sa.Column("test_case_id", sa.Integer(), nullable=False),
        sa.Column("test_name", sa.String(500), nullable=False),
        sa.Column("outcome", outcome, nullable=False),
        sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failure_type", sa.String(50)),
        sa.Column("failure_detail", sa.Text()),
        sa.ForeignKeyConstraint(["grading_job_id"], ["grading_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["test_case_id"], ["test_cases.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_test_results_grading_job_id", "test_results", ["grading_job_id"])
    op.create_index("ix_test_results_test_case_id", "test_results", ["test_case_id"])


def downgrade() -> None:
    op.drop_table("test_results")
    op.drop_table("grading_jobs")
    op.drop_table("test_cases")
    for name in ("testoutcome", "gradingjobstatus", "testvisibility"):
        postgresql.ENUM(name=name).drop(op.get_bind(), checkfirst=True)
