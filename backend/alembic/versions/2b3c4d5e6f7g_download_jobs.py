"""download_jobs tabel voor Beatload

Revision ID: 2b3c4d5e6f7g
Revises: 1a2b3c4d5e6f
Create Date: 2026-07-11
"""
import sqlalchemy as sa
from alembic import op

revision = "2b3c4d5e6f7g"
down_revision = "1a2b3c4d5e6f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "download_jobs",
        sa.Column("id",          sa.String(),  primary_key=True),
        sa.Column("url",         sa.String(),  nullable=False),
        sa.Column("source",      sa.String(),  nullable=False, server_default="auto"),
        sa.Column("title",       sa.String(),  nullable=True),
        sa.Column("artist",      sa.String(),  nullable=True),
        sa.Column("status",      sa.String(),  nullable=False, server_default="queued"),
        sa.Column("error",       sa.String(),  nullable=True),
        sa.Column("output_path", sa.String(),  nullable=True),
        sa.Column("format",      sa.String(),  nullable=False, server_default="flac"),
        sa.Column("created_at",  sa.DateTime(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(), nullable=False),
        sa.Column("created_by",  sa.String(),  sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_download_jobs_status", "download_jobs", ["status"])
    op.create_index("ix_download_jobs_created_at", "download_jobs", ["created_at"])


def downgrade():
    op.drop_index("ix_download_jobs_created_at", "download_jobs")
    op.drop_index("ix_download_jobs_status", "download_jobs")
    op.drop_table("download_jobs")
