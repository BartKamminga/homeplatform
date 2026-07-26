"""competition_fase_tags: junction table competitie-koppeling <-> fase-tag

Revision ID: qq4rr5ss6tt7
Revises: pp3qq4rr5ss6
Branch_labels: None
Depends_on: None
"""
from alembic import op


revision = "qq4rr5ss6tt7"
down_revision = "pp3qq4rr5ss6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS tournix_competition_fase_tags (
            id                  TEXT PRIMARY KEY,
            competition_link_id TEXT NOT NULL REFERENCES tournix_tournament_competitions(id) ON DELETE CASCADE,
            fase_tag_id         TEXT NOT NULL REFERENCES tournix_fase_tags(id) ON DELETE CASCADE,
            UNIQUE(competition_link_id, fase_tag_id)
        )
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS tournix_competition_fase_tags")
