"""vanger cmd result summary

Revision ID: ff2gg3hh4ii5
Revises: ee1ff2gg3hh4
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "ff2gg3hh4ii5"
down_revision = "ee1ff2gg3hh4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(vanger_cmd_queue)")).fetchall()}
    if "result_summary" in cols:
        return
    with op.batch_alter_table("vanger_cmd_queue") as batch_op:
        batch_op.add_column(sa.Column("result_summary", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("vanger_cmd_queue") as batch_op:
        batch_op.drop_column("result_summary")
