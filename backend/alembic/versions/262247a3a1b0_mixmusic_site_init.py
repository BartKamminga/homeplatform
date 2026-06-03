"""mixmusic_site_init

Revision ID: 262247a3a1b0
Revises: e56faedb5a3d
Create Date: 2026-06-02 23:06:33.133720

"""

from alembic import op
import sqlalchemy as sa

revision = "262247a3a1b0"
down_revision = "e56faedb5a3d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT OR IGNORE INTO sites (id, name, slug, module, is_active)
        VALUES ('site-nkhockey', 'NK Hockey', 'nkhockey', 'nkhockey', 1)
    """)
    op.execute("""
        INSERT OR IGNORE INTO sites (id, name, slug, module, is_active)
        VALUES ('site-mixmusic', 'Mix Music', 'mixmusic', 'mixmusic', 1)
    """)


def downgrade() -> None:
    op.execute("DELETE FROM sites WHERE slug = 'nkhockey'")
    op.execute("DELETE FROM sites WHERE slug = 'mixmusic'")
