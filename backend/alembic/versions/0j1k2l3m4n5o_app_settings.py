"""app_settings tabel met standaardwaarden voor BeatCrades naamformaat

Revision ID: 0j1k2l3m4n5o
Revises: 9i0j1k2l3m4n
Create Date: 2026-07-15
"""

from alembic import op

revision = "0j1k2l3m4n5o"
down_revision = "9i0j1k2l3m4n"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TABLE IF NOT EXISTS app_settings "
        "(key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT \"\", "
        "updated_at TEXT NOT NULL DEFAULT \"2026-01-01 00:00:00\")"
    )
    op.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) "
        "VALUES (\"beatcrades.filename_template\", \"{title} - {artist}\")"
    )
    op.execute(
        "INSERT OR IGNORE INTO app_settings (key, value) "
        "VALUES (\"beatcrades.dir_template\", \"{section}/{rack}/{crade}\")"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS app_settings")
