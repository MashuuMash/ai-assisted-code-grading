"""Add Phase 2 assignments and submissions.

Revision ID: 002_assignment_submission
Revises: 001_initial
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "002_assignment_submission"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    status_for_creation = postgresql.ENUM("draft", "published", "closed", name="assignmentstatus")
    status_for_creation.create(op.get_bind(), checkfirst=True)
    assignment_status = postgresql.ENUM("draft", "published", "closed", name="assignmentstatus", create_type=False)
    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("instructions", sa.Text()),
        sa.Column("language", sa.String(20), server_default="python", nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True)),
        sa.Column("status", assignment_status, server_default="draft", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("language = 'python'", name="ck_assignments_python_language"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_assignments_class_id", "assignments", ["class_id"])
    op.create_index("ix_assignments_deadline", "assignments", ["deadline"])
    op.create_index("ix_assignments_status", "assignments", ["status"])
    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(64), nullable=False, unique=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("size_bytes > 0", name="ck_submissions_positive_size"),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_submissions_assignment_id", "submissions", ["assignment_id"])
    op.create_index("ix_submissions_student_id", "submissions", ["student_id"])
    op.create_index("ix_submissions_submitted_at", "submissions", ["submitted_at"])


def downgrade() -> None:
    op.drop_table("submissions")
    op.drop_table("assignments")
    postgresql.ENUM(name="assignmentstatus").drop(op.get_bind(), checkfirst=True)
