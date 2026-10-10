"""Record the similarity engine used for each report.

Revision ID: 009_similarity_engine
Revises: 008_codebert_detector
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "009_similarity_engine"
down_revision: Union[str, None] = "008_codebert_detector"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "similarity_reports",
        sa.Column("engine", sa.String(length=32), nullable=False, server_default="winnowing"),
    )


def downgrade() -> None:
    op.drop_column("similarity_reports", "engine")
