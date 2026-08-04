"""competition visible flag

Revision ID: xx1yy2zz3aa4
Revises: ww0xx1yy2zz3
Create Date: 2026-08-04
"""
import sqlalchemy as sa
from alembic import op

revision = "xx1yy2zz3aa4"
down_revision = "ww0xx1yy2zz3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tournix_tournament_competitions",
        sa.Column("visible", sa.Boolean(), nullable=False, server_default="1"),
    )


def downgrade():
    op.drop_column("tournix_tournament_competitions", "visible")
