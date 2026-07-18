"""notes-veld op download_crades

Revision ID: 2l3m4n5o6p7q
Revises: 1k2l3m4n5o6p
Create Date: 2026-07-18
"""

from alembic import op

revision = "2l3m4n5o6p7q"
down_revision = "1k2l3m4n5o6p"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE download_crades ADD COLUMN notes TEXT")


def downgrade():
    pass
