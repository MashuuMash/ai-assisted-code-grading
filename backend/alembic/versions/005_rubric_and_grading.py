"""rubrics and grading tables migration

Revision ID: 005_rubric_and_grading
Revises: 004_batch_and_evidence
Create Date: 2026-09-18 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "005_rubric_and_grading"
down_revision: Union[str, None] = "004_batch_and_evidence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    eval_enum = postgresql.ENUM("automated_test", "code_quality", "structural_complexity", "manual", name="evaluationtype", create_type=False)
    grade_enum = postgresql.ENUM("pending", "draft", "confirmed", name="gradestatus", create_type=False)

    if is_postgres:
        eval_enum.create(bind, checkfirst=True)
        grade_enum.create(bind, checkfirst=True)

    op.create_table(
        "rubrics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("max_score", sa.Float(), server_default="10.0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("assignment_id", name="uq_rubrics_assignment_id"),
    )
    op.create_index("ix_rubrics_assignment_id", "rubrics", ["assignment_id"])

    op.create_table(
        "rubric_criteria",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rubric_id", sa.Integer(), sa.ForeignKey("rubrics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.Enum("correctness", "robustness", "code_quality", "complexity", "similarity", name="evidencecategory"), nullable=False),
        sa.Column("evaluation_type", sa.Enum("automated_test", "code_quality", "structural_complexity", "manual", name="evaluationtype"), nullable=False),
        sa.Column("weight_percentage", sa.Float(), nullable=False),
        sa.Column("max_points", sa.Float(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=True),
        sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_index("ix_rubric_criteria_rubric_id", "rubric_criteria", ["rubric_id"])
    op.create_index("ix_rubric_criteria_category", "rubric_criteria", ["category"])
    op.create_index("ix_rubric_criteria_evaluation_type", "rubric_criteria", ["evaluation_type"])

    op.create_table(
        "submission_grades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rubric_id", sa.Integer(), sa.ForeignKey("rubrics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("suggested_total_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("final_total_score", sa.Float(), nullable=True),
        sa.Column("status", sa.Enum("pending", "draft", "confirmed", name="gradestatus"), server_default="draft", nullable=False),
        sa.Column("feedback_summary", sa.Text(), nullable=True),
        sa.Column("graded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("confirmed_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("submission_id", name="uq_submission_grades_submission_id"),
    )
    op.create_index("ix_submission_grades_submission_id", "submission_grades", ["submission_id"])
    op.create_index("ix_submission_grades_rubric_id", "submission_grades", ["rubric_id"])
    op.create_index("ix_submission_grades_status", "submission_grades", ["status"])

    op.create_table(
        "criterion_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_grade_id", sa.Integer(), sa.ForeignKey("submission_grades.id", ondelete="CASCADE"), nullable=False),
        sa.Column("criterion_id", sa.Integer(), sa.ForeignKey("rubric_criteria.id", ondelete="CASCADE"), nullable=False),
        sa.Column("suggested_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("final_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("is_overridden", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("justification", sa.Text(), nullable=True),
    )
    op.create_index("ix_criterion_scores_submission_grade_id", "criterion_scores", ["submission_grade_id"])
    op.create_index("ix_criterion_scores_criterion_id", "criterion_scores", ["criterion_id"])


def downgrade() -> None:
    op.drop_table("criterion_scores")
    op.drop_table("submission_grades")
    op.drop_table("rubric_criteria")
    op.drop_table("rubrics")

    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        grade_enum = postgresql.ENUM("pending", "draft", "confirmed", name="gradestatus")
        eval_enum = postgresql.ENUM("automated_test", "code_quality", "structural_complexity", "manual", name="evaluationtype")
        grade_enum.drop(bind, checkfirst=True)
        eval_enum.drop(bind, checkfirst=True)
