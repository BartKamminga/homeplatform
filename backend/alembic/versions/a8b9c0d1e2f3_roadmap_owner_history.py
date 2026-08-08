"""roadmap owner field and history table

Revision ID: a8b9c0d1e2f3
Revises: yy2zz3aa4bb5
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = "a8b9c0d1e2f3"
down_revision = "yy2zz3aa4bb5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("roadmap_items", sa.Column("owner", sa.String(), nullable=True))
    op.create_table(
        "roadmap_history",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("roadmap_items.id"), nullable=False, index=True),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("changes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("roadmap_history")
    op.drop_column("roadmap_items", "owner")
