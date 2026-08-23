"""agent-control: run-log tabel (kennis + uitgebreide log in 1)

Revision ID: 638afef0f864
Revises: bcf2a555a262
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "638afef0f864"
down_revision = "bcf2a555a262"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    existing_tables = {r[0] for r in existing}
    if "agent_run_logs" in existing_tables:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en heeft de tabel dan al aangemaakt.
        return

    op.create_table(
        "agent_run_logs",
        sa.Column("id",           sa.Integer(),  nullable=False),
        sa.Column("agent_key",    sa.Text(),     nullable=False),
        sa.Column("reasoning",    sa.Text(),     nullable=False),
        sa.Column("notes",        sa.Text(),     nullable=False, server_default=""),
        sa.Column("notification", sa.Text(),     nullable=True),
        sa.Column("cmds_json",    sa.Text(),     nullable=False, server_default="[]"),
        sa.Column("created_at",   sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_run_logs_agent_key", "agent_run_logs", ["agent_key"])


def downgrade() -> None:
    op.drop_index("ix_agent_run_logs_agent_key", table_name="agent_run_logs")
    op.drop_table("agent_run_logs")
