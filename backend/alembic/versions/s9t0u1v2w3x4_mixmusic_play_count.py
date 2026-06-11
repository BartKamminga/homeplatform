"""mixmusic: add play_count to track_meta

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-06-11
"""
import sqlalchemy as sa
from alembic import op

revision = "s9t0u1v2w3x4"
down_revision = "r8s9t0u1v2w3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("mixmusic_track_meta") as batch_op:
        batch_op.add_column(sa.Column("play_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("mixmusic_track_meta") as batch_op:
        batch_op.drop_column("play_count")
