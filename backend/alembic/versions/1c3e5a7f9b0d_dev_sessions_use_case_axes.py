"""dev-sessions: git_enabled/interactive/use_case/env_name (item 1134)

Revision ID: 1c3e5a7f9b0d
Revises: 9f1a3c5e7b0d
Create Date: 2026-09-09
"""
import sqlalchemy as sa
from alembic import op

revision = "1c3e5a7f9b0d"
down_revision = "9f1a3c5e7b0d"
branch_labels = None
depends_on = None

NEW_COLUMNS = {
    "git_enabled": sa.Column("git_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    "interactive": sa.Column("interactive", sa.Boolean(), nullable=False, server_default=sa.true()),
    "use_case":    sa.Column("use_case", sa.Text(), nullable=True),
    "env_name":    sa.Column("env_name", sa.Text(), nullable=False, server_default="prod"),
}


def upgrade() -> None:
    bind = op.get_bind()
    cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(dev_sessions)")).fetchall()}
    with op.batch_alter_table("dev_sessions") as batch_op:
        for name, column in NEW_COLUMNS.items():
            if name in cols:
                # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
                # al vóór deze alembic-stap en heeft de kolom dan al aangemaakt.
                continue
            batch_op.add_column(column)


def downgrade() -> None:
    with op.batch_alter_table("dev_sessions") as batch_op:
        for name in NEW_COLUMNS:
            batch_op.drop_column(name)
