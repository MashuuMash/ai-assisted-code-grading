"""similarity reports and comparisons tables migration

Revision ID: 006_similarity_jplag
Revises: 005_rubric_and_grading
Create Date: 2026-09-18 16:15:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "006_similarity_jplag"
down_revision: Union[str, None] = "005_rubric_and_grading"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    sim_status_enum = postgresql.ENUM("queued", "running", "completed", "failed", name="similaritystatus", create_type=False)
    comp_status_enum = postgresql.ENUM("unreviewed", "flagged", "dismissed", name="comparisonreviewstatus", create_type=False)

    if is_postgres:
        sim_status_enum.create(bind, checkfirst=True)
        comp_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "similarity_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Enum("queued", "running", "completed", "failed", name="similaritystatus"), server_default="queued", nullable=False),
        sa.Column("threshold_used", sa.Float(), server_default="50.0", nullable=False),
        sa.Column("submission_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("avg_similarity", sa.Float(), nullable=True),
        sa.Column("max_similarity", sa.Float(), nullable=True),
        sa.Column("report_path", sa.String(length=500), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_similarity_reports_assignment_id", "similarity_reports", ["assignment_id"])
    op.create_index("ix_similarity_reports_status", "similarity_reports", ["status"])

    op.create_table(
        "similarity_comparisons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("similarity_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("submission_a_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("submission_b_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("similarity_percentage", sa.Float(), nullable=False),
        sa.Column("matched_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", sa.Enum("unreviewed", "flagged", "dismissed", name="comparisonreviewstatus"), server_default="unreviewed", nullable=False),
        sa.Column("matched_regions", sa.JSON(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_similarity_comparisons_report_id", "similarity_comparisons", ["report_id"])
    op.create_index("ix_similarity_comparisons_submission_a_id", "similarity_comparisons", ["submission_a_id"])
    op.create_index("ix_similarity_comparisons_submission_b_id", "similarity_comparisons", ["submission_b_id"])
    op.create_index("ix_similarity_comparisons_similarity_percentage", "similarity_comparisons", ["similarity_percentage"])
    op.create_index("ix_similarity_comparisons_status", "similarity_comparisons", ["status"])


def downgrade() -> None:
    op.drop_table("similarity_comparisons")
    op.drop_table("similarity_reports")

    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        comp_status_enum = postgresql.ENUM("unreviewed", "flagged", "dismissed", name="comparisonreviewstatus")
        sim_status_enum = postgresql.ENUM("queued", "running", "completed", "failed", name="similaritystatus")
        comp_status_enum.drop(bind, checkfirst=True)
        sim_status_enum.drop(bind, checkfirst=True)
