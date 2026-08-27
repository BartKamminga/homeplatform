"""set_hl_comp_id_landelijk_jongens_o16: Bart heeft het echte hockey.nl
comp_id (21) handmatig opgezocht via
https://www.hockey.nl/match-center#/competitions/21/standings, nadat de
vorige migratie (cc1b31e97be5) het foutieve hl_comp_id=24 (Gold Cup Dames)
had losgekoppeld van "Landelijk Jongens O16".

Alleen op de huidige-seizoen-rij gezet (niet 2025-2026) - _step_landelijke_
competitions filtert niet op seizoen, dus een hl_comp_id op de afgesloten
2025-2026-rij zou 'm onnodig blijven laten meescannen.

Revision ID: fea3978caadc
Revises: 0862a26ec197
Branch_labels: None
Depends_on: None
"""
from datetime import datetime, timezone

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "fea3978caadc"
down_revision = "0862a26ec197"
branch_labels = None
depends_on = None

NOW = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


def upgrade():
    bind = op.get_bind()

    target_season = bind.execute(
        text("SELECT value FROM app_settings WHERE key = 'disc_target_season'")
    ).fetchone()
    season = target_season[0] if target_season and target_season[0] else "2026-2027"

    result = bind.execute(
        text("""
            UPDATE hockey_competitions
            SET hl_comp_id = 21, updated_at = :now
            WHERE name = 'Landelijk Jongens O16' AND season = :season
        """),
        {"now": NOW, "season": season},
    )
    print(f"[set-hl-comp-id-jo16] {result.rowcount} rij(en) bijgewerkt (seizoen {season})")


def downgrade():
    pass
