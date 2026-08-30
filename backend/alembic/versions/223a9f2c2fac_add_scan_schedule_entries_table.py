"""add scan schedule entries table

Revision ID: 223a9f2c2fac
Revises: 49140235b270
Create Date: 2026-08-30 13:18:50.800640

"""
from alembic import op
import sqlalchemy as sa


revision = '223a9f2c2fac'
down_revision = '49140235b270'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scan_schedule_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("target_type", sa.String(), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("cmd_type", sa.String(), nullable=False),
        sa.Column("params", sa.String(), nullable=False),
        sa.Column("planned_at", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="planned"),
        sa.Column("vanger_cmd_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_scan_schedule_entries_target_type", "scan_schedule_entries", ["target_type"])
    op.create_index("ix_scan_schedule_entries_target_id", "scan_schedule_entries", ["target_id"])
    op.create_index("ix_scan_schedule_entries_planned_at", "scan_schedule_entries", ["planned_at"])
    op.create_index("ix_scan_schedule_entries_reason", "scan_schedule_entries", ["reason"])
    op.create_index("ix_scan_schedule_entries_status", "scan_schedule_entries", ["status"])


def downgrade() -> None:
    op.drop_table("scan_schedule_entries")
