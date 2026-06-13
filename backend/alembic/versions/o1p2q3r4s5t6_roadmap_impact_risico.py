"""roadmap impact risico fields

Revision ID: o1p2q3r4s5t6
Revises: n0o1p2q3r4s5
Create Date: 2026-06-13

"""
from alembic import op
import sqlalchemy as sa

revision = "o1p2q3r4s5t6"
down_revision = "n0o1p2q3r4s5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("roadmap_items", sa.Column("impact", sa.String(), nullable=True))
    op.add_column("roadmap_items", sa.Column("risico", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("roadmap_items", "risico")
    op.drop_column("roadmap_items", "impact")
