"""Record whether feedback came from an LLM or deterministic rules.

Revision ID: 010_feedback_source
Revises: 009_similarity_engine
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "010_feedback_source"
down_revision: Union[str, None] = "009_similarity_engine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("submission_grades", sa.Column("feedback_source", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("submission_grades", "feedback_source")
