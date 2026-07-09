"""poulebord_boards tabel

Revision ID: a1b2c3d4e5f6
Revises: z6a7b8c9d0e1
Create Date: 2026-07-09
"""
import sqlalchemy as sa
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = ("z6a7b8c9d0e1", "b1c2d3e4f5a0")
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "poulebord_boards",
        sa.Column("id",         sa.String(), primary_key=True),
        sa.Column("name",       sa.String(), nullable=False),
        sa.Column("club",       sa.String(), nullable=False, server_default=""),
        sa.Column("pins",       sa.String(), nullable=False, server_default="[]"),
        sa.Column("pool_pins",  sa.String(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("poulebord_boards")
