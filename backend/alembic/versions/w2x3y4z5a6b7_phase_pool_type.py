"""phase pool_type

Revision ID: w2x3y4z5a6b7
Revises: v1w2x3y4z5a6
Create Date: 2026-06-14

"""
from alembic import op
import sqlalchemy as sa

revision = "w2x3y4z5a6b7"
down_revision = "v1w2x3y4z5a6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tournix_phases", sa.Column("pool_type", sa.String(), nullable=True))


def downgrade():
    op.drop_column("tournix_phases", "pool_type")
