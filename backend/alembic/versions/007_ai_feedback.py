"""add detailed_feedback column to submission_grades

Revision ID: 007_ai_feedback
Revises: 006_similarity_jplag
Create Date: 2026-09-18 16:35:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "007_ai_feedback"
down_revision: Union[str, None] = "006_similarity_jplag"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "submission_grades",
        sa.Column("detailed_feedback", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("submission_grades", "detailed_feedback")
