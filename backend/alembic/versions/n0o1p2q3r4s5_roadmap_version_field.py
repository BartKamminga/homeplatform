"""roadmap_items: version kolom toevoegen

Revision ID: n0o1p2q3r4s5
Revises: m9n0o1p2q3r4
Create Date: 2026-06-13
"""
import sqlalchemy as sa
from alembic import op

revision = "n0o1p2q3r4s5"
down_revision = "m9n0o1p2q3r4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("roadmap_items", sa.Column("version", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("roadmap_items", "version")
