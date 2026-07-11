"""progress_log kolom aan download_jobs

Revision ID: 3c4d5e6f7g8h
Revises: 2b3c4d5e6f7g
Create Date: 2026-07-11
"""
import sqlalchemy as sa
from alembic import op

revision = "3c4d5e6f7g8h"
down_revision = "2b3c4d5e6f7g"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("download_jobs")}
    if "progress_log" not in existing_cols:
        op.add_column("download_jobs", sa.Column("progress_log", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("download_jobs", "progress_log")
