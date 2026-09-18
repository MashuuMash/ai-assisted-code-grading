"""batch submissions and evidence table migration

Revision ID: 004_batch_and_evidence
Revises: 003_secure_grading
Create Date: 2026-09-18 15:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "004_batch_and_evidence"
down_revision: Union[str, None] = "003_secure_grading"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # Add columns to submissions
    op.add_column("submissions", sa.Column("student_identifier", sa.String(length=128), server_default="", nullable=False))
    op.add_column("submissions", sa.Column("student_name", sa.String(length=255), nullable=True))
    op.create_index("ix_submissions_student_identifier", "submissions", ["student_identifier"])

    # Alter student_id in submissions to nullable
    if is_postgres:
        op.alter_column("submissions", "student_id", existing_type=sa.Integer(), nullable=True)
    else:
        with op.batch_alter_table("submissions") as batch_op:
            batch_op.alter_column("student_id", existing_type=sa.Integer(), nullable=True)

    # Create Enums for Postgres
    source_enum = postgresql.ENUM("pytest", "ruff", "ast", "jplag", name="evidencesource", create_type=False)
    category_enum = postgresql.ENUM("correctness", "robustness", "code_quality", "complexity", "similarity", name="evidencecategory", create_type=False)
    severity_enum = postgresql.ENUM("info", "warning", "error", name="evidenceseverity", create_type=False)

    if is_postgres:
        source_enum.create(bind, checkfirst=True)
        category_enum.create(bind, checkfirst=True)
        severity_enum.create(bind, checkfirst=True)

    op.create_table(
        "submission_evidence",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.Enum("pytest", "ruff", "ast", "jplag", name="evidencesource"), nullable=False),
        sa.Column("category", sa.Enum("correctness", "robustness", "code_quality", "complexity", "similarity", name="evidencecategory"), nullable=False),
        sa.Column("severity", sa.Enum("info", "warning", "error", name="evidenceseverity"), nullable=False),
        sa.Column("rule_code", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("metric_value", sa.Float(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_submission_evidence_submission_id", "submission_evidence", ["submission_id"])
    op.create_index("ix_submission_evidence_assignment_id", "submission_evidence", ["assignment_id"])
    op.create_index("ix_submission_evidence_source", "submission_evidence", ["source"])
    op.create_index("ix_submission_evidence_category", "submission_evidence", ["category"])
    op.create_index("ix_submission_evidence_severity", "submission_evidence", ["severity"])
    op.create_index("ix_submission_evidence_rule_code", "submission_evidence", ["rule_code"])


def downgrade() -> None:
    op.drop_table("submission_evidence")

    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        source_enum = postgresql.ENUM("pytest", "ruff", "ast", "jplag", name="evidencesource")
        category_enum = postgresql.ENUM("correctness", "robustness", "code_quality", "complexity", "similarity", name="evidencecategory")
        severity_enum = postgresql.ENUM("info", "warning", "error", name="evidenceseverity")
        severity_enum.drop(bind, checkfirst=True)
        category_enum.drop(bind, checkfirst=True)
        source_enum.drop(bind, checkfirst=True)

    op.drop_index("ix_submissions_student_identifier", table_name="submissions")
    op.drop_column("submissions", "student_name")
    op.drop_column("submissions", "student_identifier")
