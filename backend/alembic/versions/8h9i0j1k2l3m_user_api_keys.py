"""user_api_keys table

Revision ID: 8h9i0j1k2l3m
Revises: 7g8h9i0j1k2l
Create Date: 2026-07-14
"""
import sqlalchemy as sa
from alembic import op

revision = "8h9i0j1k2l3m"
down_revision = "7g8h9i0j1k2l"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_api_keys",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("key_hash", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("key_hint", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("user_api_keys")
