"""download_crades: artist en item_type kolommen

Revision ID: 9i0j1k2l3m4n
Revises: 8h9i0j1k2l3m
Create Date: 2026-07-14
"""
from alembic import op

revision = "9i0j1k2l3m4n"
down_revision = "8h9i0j1k2l3m"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE download_crades ADD COLUMN artist TEXT DEFAULT NULL")
    op.execute("ALTER TABLE download_crades ADD COLUMN item_type TEXT DEFAULT NULL")


def downgrade():
    pass
