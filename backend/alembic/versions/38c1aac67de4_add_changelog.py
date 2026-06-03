"""add_changelog

Revision ID: 38c1aac67de4
Revises: 040802d331e2
Create Date: 2026-06-03 13:24:27.277262

"""

from alembic import op
import sqlalchemy as sa

revision = "38c1aac67de4"
down_revision = "040802d331e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    import uuid
    from datetime import datetime

    now = datetime.utcnow().isoformat()

    op.execute(f"""
        INSERT OR IGNORE INTO changelog (id, version, site, title, description, released_at, created_at)
        VALUES (
            '{uuid.uuid4()}',
            '0.1.0',
            'core',
            'Initiële platform opzet',
            'Backend FastAPI, SQLite database, auth, gebruikers, groepen, themas, sites, audit log.',
            '2026-06-02T00:00:00',
            '{now}'
        )
    """)
    op.execute(f"""
        INSERT OR IGNORE INTO changelog (id, version, site, title, description, released_at, created_at)
        VALUES (
            '{uuid.uuid4()}',
            '0.2.0',
            'core',
            'Admin frontend, Docker deploy, NAS setup',
            'Volledige admin UI, Docker Compose stack, Caddy routing, NAS deploy.',
            '2026-06-02T00:00:00',
            '{now}'
        )
    """)
    op.execute(f"""
        INSERT OR IGNORE INTO changelog (id, version, site, title, description, released_at, created_at)
        VALUES (
            '{uuid.uuid4()}',
            '0.3.0',
            'core',
            'Landing pagina, changelog, iconen per site',
            'Aparte landing site, changelog beheer via admin, icoon veld per site.',
            '2026-06-03T00:00:00',
            '{now}'
        )
    """)


def downgrade() -> None:
    op.execute(
        "DELETE FROM changelog WHERE version IN ('0.1.0', '0.2.0', '0.3.0') AND site = 'core'"
    )
