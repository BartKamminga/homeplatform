"""agent-control: notifications + task queue tables

Revision ID: bcf2a555a262
Revises: 4aa1882f476d
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "bcf2a555a262"
down_revision = "4aa1882f476d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    existing_tables = {r[0] for r in existing}
    if "agent_notifications" in existing_tables and "agent_tasks" in existing_tables:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en heeft de tabellen dan al aangemaakt.
        return

    op.create_table(
        "agent_notifications",
        sa.Column("id",         sa.Integer(),  nullable=False),
        sa.Column("agent_key",  sa.Text(),     nullable=False),
        sa.Column("message",    sa.Text(),     nullable=False),
        sa.Column("link",       sa.Text(),     nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("read_at",    sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_notifications_agent_key", "agent_notifications", ["agent_key"])

    op.create_table(
        "agent_tasks",
        sa.Column("id",          sa.Integer(),  nullable=False),
        sa.Column("agent_key",   sa.Text(),     nullable=False),
        sa.Column("instruction", sa.Text(),     nullable=False),
        sa.Column("status",      sa.Text(),     nullable=False, server_default="pending"),
        sa.Column("result",      sa.Text(),     nullable=True),
        sa.Column("created_at",  sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_tasks_agent_key", "agent_tasks", ["agent_key"])
    op.create_index("ix_agent_tasks_status", "agent_tasks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_agent_tasks_status", table_name="agent_tasks")
    op.drop_index("ix_agent_tasks_agent_key", table_name="agent_tasks")
    op.drop_table("agent_tasks")
    op.drop_index("ix_agent_notifications_agent_key", table_name="agent_notifications")
    op.drop_table("agent_notifications")
