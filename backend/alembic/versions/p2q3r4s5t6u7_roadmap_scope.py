"""roadmap scope field

Revision ID: p2q3r4s5t6u7
Revises: o1p2q3r4s5t6
Create Date: 2026-06-13

"""
from alembic import op
import sqlalchemy as sa

revision = "p2q3r4s5t6u7"
down_revision = "o1p2q3r4s5t6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("roadmap_items", sa.Column("scope", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("roadmap_items", "scope")
