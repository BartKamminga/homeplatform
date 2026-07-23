"""scrapster short urls

Revision ID: jj6kk7ll8mm9
Revises: ii5jj6kk7ll8
Create Date: 2026-07-23
"""
from alembic import op
import sqlalchemy as sa

revision = "jj6kk7ll8mm9"
down_revision = "ii5jj6kk7ll8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "scrapster_short_urls",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("token", sa.String(16), nullable=False, unique=True, index=True),
        sa.Column("filters", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )


def downgrade():
    op.drop_table("scrapster_short_urls")
