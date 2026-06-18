"""mixmusic: add excluded_tracks table

Revision ID: z5a6b7c8d9e0
Revises: y4z5a6b7c8d9
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = "z5a6b7c8d9e0"
down_revision = "y4z5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mixmusic_excluded_tracks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_path", "group_id", name="uq_excluded_file_group"),
    )
    op.create_index("ix_excluded_file_path", "mixmusic_excluded_tracks", ["file_path"])
    op.create_index("ix_excluded_group_id", "mixmusic_excluded_tracks", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_excluded_group_id", table_name="mixmusic_excluded_tracks")
    op.drop_index("ix_excluded_file_path", table_name="mixmusic_excluded_tracks")
    op.drop_table("mixmusic_excluded_tracks")
