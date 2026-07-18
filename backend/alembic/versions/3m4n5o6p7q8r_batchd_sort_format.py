"""sort_order op sections/racks, default_format op racks (Batch D)

Revision ID: 3m4n5o6p7q8r
Revises: 2l3m4n5o6p7q
Create Date: 2026-07-18
"""

from alembic import op

revision = "3m4n5o6p7q8r"
down_revision = "2l3m4n5o6p7q"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE download_sections     ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE download_crade_groups ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE download_crade_groups ADD COLUMN default_format TEXT")


def downgrade():
    pass
