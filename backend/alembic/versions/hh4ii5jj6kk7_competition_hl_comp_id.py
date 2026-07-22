"""competition hl_comp_id

Revision ID: hh4ii5jj6kk7
Revises: gg3hh4ii5jj6
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa

revision = "hh4ii5jj6kk7"
down_revision = "gg3hh4ii5jj6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("hockey_competitions", sa.Column("hl_comp_id", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("hockey_competitions", "hl_comp_id")
