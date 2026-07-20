"""hockey_clubs + hockey_teams: discovery via hockey-vanger

Revision ID: 6p7q8r9s0t1u
Revises: 5o6p7q8r9s0t
Create Date: 2026-07-20
"""

from alembic import op

revision = "6p7q8r9s0t1u"
down_revision = "5o6p7q8r9s0t"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE hockey_clubs (
            id              INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
            external_id     TEXT     NOT NULL UNIQUE,
            name            TEXT     NOT NULL,
            friendly_name   TEXT     NOT NULL,
            city            TEXT,
            logo_url        TEXT,
            club_type       TEXT     NOT NULL DEFAULT "regular",
            address         TEXT,
            zipcode         TEXT,
            phone           TEXT,
            email           TEXT,
            website         TEXT,
            tenue           TEXT,
            district        TEXT,
            payment_options TEXT,
            parking         TEXT,
            hockey_types    TEXT,
            detail_loaded   INTEGER  NOT NULL DEFAULT 0,
            discovered_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX ix_hockey_clubs_external_id ON hockey_clubs (external_id)")

    op.execute("""
        CREATE TABLE hockey_teams (
            id                  INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
            team_id             INTEGER  NOT NULL UNIQUE,
            club_external_id    TEXT     NOT NULL,
            name                TEXT     NOT NULL,
            short_name          TEXT     NOT NULL,
            logo_url            TEXT,
            hockey_type         TEXT     NOT NULL,
            category_group_name TEXT     NOT NULL,
            recent_poule_id     INTEGER,
            discovered_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX ix_hockey_teams_team_id ON hockey_teams (team_id)")
    op.execute("CREATE INDEX ix_hockey_teams_club_external_id ON hockey_teams (club_external_id)")
    op.execute("CREATE INDEX ix_hockey_teams_category ON hockey_teams (category_group_name)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS hockey_teams")
    op.execute("DROP TABLE IF EXISTS hockey_clubs")
