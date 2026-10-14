"""myhome: wachtrij voor wijzigingen naar HA/Hue (myhome_push_jobs) - item 1320

Revision ID: a5c7e9b1d3f6
Revises: f4b6d8a0c2e5
Create Date: 2026-10-14

Met has-table-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "a5c7e9b1d3f6"
down_revision = "f4b6d8a0c2e5"
branch_labels = None
depends_on = None


def upgrade():
    if "myhome_push_jobs" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table(
            "myhome_push_jobs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("home_id", sa.String(), sa.ForeignKey("myhome_homes.id"), nullable=False, index=True),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("target", sa.String(), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, index=True),
            sa.Column("result", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("applied_at", sa.DateTime(), nullable=True),
        )


def downgrade():
    op.drop_table("myhome_push_jobs")
