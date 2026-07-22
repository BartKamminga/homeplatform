"""vanger_cmd_queue table

Revision ID: ee1ff2gg3hh4
Revises: dd0ee1ff2gg3
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa

revision = "ee1ff2gg3hh4"
down_revision = "dd0ee1ff2gg3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "vanger_cmd_queue",
        sa.Column("id",           sa.Integer(),  nullable=False),
        sa.Column("cmd_type",     sa.Text(),     nullable=False),
        sa.Column("params",       sa.Text(),     nullable=False),
        sa.Column("status",       sa.Text(),     nullable=False, server_default="pending"),
        sa.Column("created_at",   sa.DateTime(), nullable=False),
        sa.Column("started_at",   sa.DateTime(), nullable=True),
        sa.Column("finished_at",  sa.DateTime(), nullable=True),
        sa.Column("error",        sa.Text(),     nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vanger_cmd_queue_cmd_type", "vanger_cmd_queue", ["cmd_type"])
    op.create_index("ix_vanger_cmd_queue_status",   "vanger_cmd_queue", ["status"])


def downgrade():
    op.drop_table("vanger_cmd_queue")
