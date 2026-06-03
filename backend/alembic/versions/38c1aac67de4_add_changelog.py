"""add_changelog

Revision ID: 38c1aac67de4
Revises: 040802d331e2
Create Date: 2026-06-03 13:24:27.277262

"""

from alembic import op
import sqlalchemy as sa

revision = "38c1aac67de4"
down_revision = "040802d331e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "changelog",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("version", sa.String, nullable=False),
        sa.Column("site", sa.String, nullable=False, server_default="core"),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("released_at", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("changelog")
