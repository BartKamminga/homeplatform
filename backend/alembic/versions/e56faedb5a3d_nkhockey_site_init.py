"""nkhockey_site_init

Revision ID: e56faedb5a3d
Revises: 0001
Create Date: 2026-06-02 22:53:29.034247

"""

from alembic import op
import sqlalchemy as sa

revision = "e56faedb5a3d"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT OR IGNORE INTO sites (id, name, slug, module, is_active)
        VALUES ('site-nkhockey', 'NK Hockey', 'nkhockey', 'nkhockey', 1)
    """)


def downgrade() -> None:
    op.execute("DELETE FROM sites WHERE slug = 'nkhockey'")
