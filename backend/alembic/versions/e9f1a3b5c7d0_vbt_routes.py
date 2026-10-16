"""vbt_routes: eigen routes (GPX) per gebruiker

Revision ID: e9f1a3b5c7d0
Revises: d8e0f2a4b6c8
Create Date: 2026-10-16

Item 1365. Met has-table-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "e9f1a3b5c7d0"
down_revision = "d8e0f2a4b6c8"
branch_labels = None
depends_on = None


def upgrade():
    if "vbt_routes" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "vbt_routes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False, server_default="gpx"),
        sa.Column("segments", sa.JSON(), nullable=True),
        sa.Column("curves", sa.JSON(), nullable=True),
        sa.Column("distance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("elevation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("vbt_routes")
