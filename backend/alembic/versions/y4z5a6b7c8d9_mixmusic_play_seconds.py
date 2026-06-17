"""mixmusic: add play_seconds to track_meta

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

revision = "y4z5a6b7c8d9"
down_revision = "x3y4z5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("mixmusic_track_meta") as batch_op:
        batch_op.add_column(sa.Column("play_seconds", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("mixmusic_track_meta") as batch_op:
        batch_op.drop_column("play_seconds")
