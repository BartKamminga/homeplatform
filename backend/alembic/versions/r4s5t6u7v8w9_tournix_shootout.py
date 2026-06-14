"""tournix match shootout_winner column

Revision ID: r4s5t6u7v8w9
Revises: q3r4s5t6u7v8
Create Date: 2026-06-14

"""
from alembic import op
import sqlalchemy as sa

revision = "r4s5t6u7v8w9"
down_revision = "q3r4s5t6u7v8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tournix_matches", sa.Column("shootout_winner", sa.String(), nullable=True))


def downgrade():
    op.drop_column("tournix_matches", "shootout_winner")
