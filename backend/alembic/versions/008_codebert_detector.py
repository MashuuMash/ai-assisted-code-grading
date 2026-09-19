"""add codebert to evidencesource enum

Revision ID: 008_codebert_detector
Revises: 007_ai_feedback
Create Date: 2026-09-18 17:42:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "008_codebert_detector"
down_revision: Union[str, None] = "007_ai_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE evidencesource ADD VALUE IF NOT EXISTS 'codebert'")


def downgrade() -> None:
    pass
