"""tournix season en club logo_url

Revision ID: b1c2d3e4f5a0
Revises: a0b1c2d3e4f5
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = "b1c2d3e4f5a0"
down_revision = "a0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournix_tournaments", sa.Column("season", sa.String(), nullable=True))
    op.add_column("tournix_clubs", sa.Column("logo_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("tournix_tournaments", "season")
    op.drop_column("tournix_clubs", "logo_url")
