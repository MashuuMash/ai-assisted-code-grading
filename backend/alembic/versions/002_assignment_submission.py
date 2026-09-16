"""assignment and submission migration

Revision ID: 002_assignment_submission
Revises: 001_initial
Create Date: 2026-09-16 21:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "002_assignment_submission"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    assignmentstatus_enum = postgresql.ENUM("draft", "published", "closed", name="assignmentstatus", create_type=False)
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        assignmentstatus_enum.create(bind, checkfirst=True)

    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("language", sa.String(length=20), server_default="python", nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Enum("draft", "published", "closed", name="assignmentstatus"), server_default="draft", nullable=False),
        sa.Column("base_code", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_assignments_class_id", "assignments", ["class_id"])
    op.create_index("ix_assignments_status", "assignments", ["status"])
    op.create_index("ix_assignments_deadline", "assignments", ["deadline"])

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_submissions_assignment_id", "submissions", ["assignment_id"])
    op.create_index("ix_submissions_student_id", "submissions", ["student_id"])
    op.create_index("ix_submissions_storage_key", "submissions", ["storage_key"], unique=True)
    op.create_index("ix_submissions_submitted_at", "submissions", ["submitted_at"])


def downgrade() -> None:
    op.drop_table("submissions")
    op.drop_table("assignments")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        assignmentstatus_enum = postgresql.ENUM("draft", "published", "closed", name="assignmentstatus")
        assignmentstatus_enum.drop(bind, checkfirst=True)
