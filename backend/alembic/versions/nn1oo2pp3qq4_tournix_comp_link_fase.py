"""Tournix tournament_competitions: voeg fase-veld toe."""

from alembic import op

revision = "nn1oo2pp3qq4"
down_revision = "mm0nn1oo2pp3"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE tournix_tournament_competitions ADD COLUMN fase TEXT"
    )


def downgrade():
    pass  # SQLite: geen DROP COLUMN
