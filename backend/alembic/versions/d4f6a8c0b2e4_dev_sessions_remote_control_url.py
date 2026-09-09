"""dev-sessions: remote_control_url kolom

Revision ID: d4f6a8c0b2e4
Revises: e2a4c6f8b0d2
Create Date: 2026-09-09
"""
import sqlalchemy as sa
from alembic import op

revision = "d4f6a8c0b2e4"
down_revision = "e2a4c6f8b0d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(dev_sessions)")).fetchall()}
    if "remote_control_url" in cols:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en heeft de kolom dan al aangemaakt.
        return
    op.add_column("dev_sessions", sa.Column("remote_control_url", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("dev_sessions") as batch_op:
        batch_op.drop_column("remote_control_url")
