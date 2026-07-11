"""DownloadJob: last_progress_at timestamp

Revision ID: 7g8h9i0j1k2l
Revises: 6f7g8h9i0j1k
Create Date: 2026-07-11
"""
import sqlalchemy as sa
from alembic import op

revision = "7g8h9i0j1k2l"
down_revision = "6f7g8h9i0j1k"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    cols = [row[1] for row in conn.execute(sa.text("PRAGMA table_info(download_jobs)")).fetchall()]
    if "last_progress_at" not in cols:
        op.add_column("download_jobs", sa.Column("last_progress_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("download_jobs", "last_progress_at")
