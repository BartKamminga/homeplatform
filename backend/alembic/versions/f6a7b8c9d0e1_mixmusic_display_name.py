"""mixmusic_display_name

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-10

"""
from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mixmusic_track_meta", sa.Column("display_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("mixmusic_track_meta", "display_name")
