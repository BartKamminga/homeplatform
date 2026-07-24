"""Tournix: eigen fase-lijst per toernooi

Revision ID: oo2pp3qq4rr5
Revises: nn1oo2pp3qq4
Create Date: 2026-07-24
"""
from alembic import op

revision = "oo2pp3qq4rr5"
down_revision = "nn1oo2pp3qq4"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS tournix_tournament_fases (
            id            TEXT PRIMARY KEY,
            tournament_id TEXT NOT NULL REFERENCES tournix_tournaments(id),
            name          TEXT NOT NULL,
            "order"       INTEGER NOT NULL DEFAULT 0
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ttf_tournament_id "
        "ON tournix_tournament_fases(tournament_id)"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS tournix_tournament_fases")
