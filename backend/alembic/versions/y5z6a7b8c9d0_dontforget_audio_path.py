"""add audio_path to tasks

Revision ID: y5z6a7b8c9d0
Revises: x4y5z6a7b8c9
Create Date: 2026-06-11
"""
import sqlalchemy as sa
from alembic import op

revision = "y5z6a7b8c9d0"
down_revision = "x4y5z6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("audio_path", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "audio_path")
