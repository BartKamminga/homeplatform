"""BeatCrades — download_crade_groups, download_crades tabellen + crade_id op download_jobs

Revision ID: 4d5e6f7g8h9i
Revises: 3c4d5e6f7g8h
Create Date: 2026-07-11
"""
import sqlalchemy as sa
from alembic import op

revision = "4d5e6f7g8h9i"
down_revision = "3c4d5e6f7g8h"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "download_crade_groups" not in tables:
        op.create_table(
            "download_crade_groups",
            sa.Column("id",         sa.String(),   primary_key=True),
            sa.Column("name",       sa.String(),   nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("created_by", sa.String(),   sa.ForeignKey("users.id"), nullable=True),
        )

    if "download_crades" not in tables:
        op.create_table(
            "download_crades",
            sa.Column("id",         sa.String(),   primary_key=True),
            sa.Column("name",       sa.String(),   nullable=False),
            sa.Column("subdir",     sa.String(),   nullable=False, server_default=""),
            sa.Column("group_id",   sa.String(),   sa.ForeignKey("download_crade_groups.id"), nullable=True),
            sa.Column("source_url", sa.String(),   nullable=True),
            sa.Column("format",     sa.String(),   nullable=False, server_default="flac"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("created_by", sa.String(),   sa.ForeignKey("users.id"), nullable=True),
        )

    existing_cols = {c["name"] for c in inspector.get_columns("download_jobs")}
    if "crade_id" not in existing_cols:
        op.add_column(
            "download_jobs",
            sa.Column("crade_id", sa.String(), nullable=True),
        )


def downgrade():
    op.drop_column("download_jobs", "crade_id")
    op.drop_table("download_crades")
    op.drop_table("download_crade_groups")
