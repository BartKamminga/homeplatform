"""tournament info field

Revision ID: yy2zz3aa4bb5
Revises: xx1yy2zz3aa4
Create Date: 2026-08-04
"""
import sqlalchemy as sa
from alembic import op

revision = "yy2zz3aa4bb5"
down_revision = "xx1yy2zz3aa4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tournix_tournaments",
        sa.Column("info", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("tournix_tournaments", "info")
