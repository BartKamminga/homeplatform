"""dossiers: dossiers and dossier_entries - item 1355

Revision ID: a3c5e7f9b1d4
Revises: b2d4f6a8c0e3
Create Date: 2026-10-15

With has-table checks, because create_all runs before the migration in the deploy pipeline.
"""
from alembic import op
import sqlalchemy as sa

revision = "a3c5e7f9b1d4"
down_revision = "b2d4f6a8c0e3"
branch_labels = None
depends_on = None


def upgrade():
    tables = sa.inspect(op.get_bind()).get_table_names()
    if "dossiers" not in tables:
        op.create_table(
            "dossiers",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("slug", sa.String(), nullable=False, index=True),
            sa.Column("summary", sa.String(), nullable=True),
            sa.Column("mail_criteria", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if "dossier_entries" not in tables:
        op.create_table(
            "dossier_entries",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("dossier_id", sa.String(), sa.ForeignKey("dossiers.id"), nullable=False, index=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("body", sa.String(), nullable=True),
            sa.Column("source_url", sa.String(), nullable=True),
            sa.Column("file_path", sa.String(), nullable=True),
            sa.Column("original_filename", sa.String(), nullable=True),
            sa.Column("content_type", sa.String(), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("content_hash", sa.String(), nullable=True, index=True),
            sa.Column("parent_entry_id", sa.String(), sa.ForeignKey("dossier_entries.id"), nullable=True, index=True),
            sa.Column("occurred_at", sa.DateTime(), nullable=True),
            sa.Column("external_ref", sa.String(), nullable=True, index=True),
            sa.Column("review", sa.String(), nullable=True),
            sa.Column("reason", sa.String(), nullable=True),
            sa.Column("pinned", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )


def downgrade():
    for table in ("dossier_entries", "dossiers"):
        op.drop_table(table)
