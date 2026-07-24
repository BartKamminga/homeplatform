"""Tournix: join-tabel tournament_competitions."""

from alembic import op

revision = "mm0nn1oo2pp3"
down_revision = "ll8mm9nn0oo1"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS tournix_tournament_competitions (
            id TEXT PRIMARY KEY,
            tournament_id TEXT NOT NULL REFERENCES tournix_tournaments(id),
            competition_id INTEGER NOT NULL REFERENCES hockey_competitions(id),
            "order" INTEGER NOT NULL DEFAULT 0,
            label TEXT
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ttc_tournament_id "
        "ON tournix_tournament_competitions (tournament_id)"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS tournix_tournament_competitions")
