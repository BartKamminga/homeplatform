"""add_icon_to_sites

Revision ID: 040802d331e2
Revises: 262247a3a1b0
Create Date: 2026-06-03 13:04:09.031481

"""

from alembic import op
import sqlalchemy as sa

revision = "040802d331e2"
down_revision = "262247a3a1b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sites", sa.Column("icon", sa.String, nullable=True))


def downgrade() -> None:
    op.drop_column("sites", "icon")
