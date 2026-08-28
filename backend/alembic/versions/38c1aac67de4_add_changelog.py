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

    # item 995: deze migratie heette "add_changelog" maar maakte de tabel zelf
    # nooit aan - op acc/prod bestond hij al via create_db_and_tables()
    # (app-startup, core/database.py) tegen de tijd dat dit draaide. Een verse
    # database die alembic upgrade head draait zonder ooit gebootet te hebben
    # heeft die tabel nog niet - vandaar hier alsnog aanmaken, idempotent.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "changelog" not in inspector.get_table_names():
        op.create_table(
            "changelog",
            sa.Column("id", sa.String, primary_key=True),
            sa.Column("version", sa.String, nullable=False),
            sa.Column("site", sa.String, nullable=False, server_default="core"),
            sa.Column("title", sa.String, nullable=False),
            sa.Column("description", sa.String, nullable=True),
            sa.Column("released_at", sa.DateTime, nullable=False),
            sa.Column("created_at", sa.DateTime, nullable=False),
        )
        op.create_index("ix_changelog_version", "changelog", ["version"])
        op.create_index("ix_changelog_site", "changelog", ["site"])

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
