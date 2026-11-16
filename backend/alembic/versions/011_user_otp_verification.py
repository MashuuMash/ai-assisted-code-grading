"""Add OTP email verification fields to users table.

Revision ID: 011_user_otp_verification
Revises: 010_feedback_source
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "011_user_otp_verification"
down_revision: Union[str, None] = "010_feedback_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "users",
        sa.Column("otp_code_hash", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("otp_attempts", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "otp_attempts")
    op.drop_column("users", "otp_expires_at")
    op.drop_column("users", "otp_code_hash")
    op.drop_column("users", "is_email_verified")
