"""dev-sessions: headless Claude Code container-lifecycle tabel

Revision ID: e2a4c6f8b0d2
Revises: a8c0d2e4f6a8
Create Date: 2026-09-09
"""
import sqlalchemy as sa
from alembic import op

revision = "e2a4c6f8b0d2"
down_revision = "a8c0d2e4f6a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    existing_tables = {r[0] for r in existing}
    if "dev_sessions" in existing_tables:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en heeft de tabel dan al aangemaakt.
        return

    op.create_table(
        "dev_sessions",
        sa.Column("id",                sa.Integer(),  nullable=False),
        sa.Column("name",              sa.Text(),     nullable=True),
        sa.Column("branch",            sa.Text(),     nullable=False, server_default="develop"),
        sa.Column("initial_prompt",    sa.Text(),     nullable=True),
        sa.Column("container_name",    sa.Text(),     nullable=True),
        sa.Column("container_id",      sa.Text(),     nullable=True),
        sa.Column("workspace_volume",  sa.Text(),     nullable=True),
        sa.Column("home_volume",       sa.Text(),     nullable=True),
        sa.Column("status",            sa.Text(),     nullable=False, server_default="creating"),
        sa.Column("error",             sa.Text(),     nullable=True),
        sa.Column("memory_limit_mb",   sa.Integer(),  nullable=False, server_default="2048"),
        sa.Column("created_by",        sa.Text(),     nullable=True),
        sa.Column("created_at",        sa.DateTime(), nullable=False),
        sa.Column("started_at",        sa.DateTime(), nullable=True),
        sa.Column("stopped_at",        sa.DateTime(), nullable=True),
        sa.Column("removed_at",        sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("dev_sessions")
