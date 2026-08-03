"""tournament order field

Revision ID: vv9ww0xx1yy2
Revises: b1c2d3e4f5a0, uu8vv9ww0xx1
Create Date: 2026-08-03
"""
import sqlalchemy as sa
from alembic import op

revision = "vv9ww0xx1yy2"
down_revision = ("b1c2d3e4f5a0", "uu8vv9ww0xx1")
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tournix_tournaments", sa.Column("order", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("tournix_tournaments", "order")
