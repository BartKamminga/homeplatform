"""invite_tokens: reusable, use_count, next_path - groepslink (item 1332).

Revision ID: c4e6a8b0d2f4
Revises: a5c7e9b1d3f6
Create Date: 2026-10-14
"""
from alembic import op
import sqlalchemy as sa

revision = "c4e6a8b0d2f4"
down_revision = "a5c7e9b1d3f6"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("invite_tokens")}
    if "reusable" not in cols:
        op.add_column("invite_tokens", sa.Column("reusable", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "use_count" not in cols:
        op.add_column("invite_tokens", sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"))
    if "next_path" not in cols:
        op.add_column("invite_tokens", sa.Column("next_path", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("invite_tokens") as batch:
        batch.drop_column("next_path")
        batch.drop_column("use_count")
        batch.drop_column("reusable")
