"""merge_duplicate_national_competitions: _call_competitions_list matchte
bestaande competities op een zelfgebouwde "naam|seizoen"-sleutel i.p.v. het
overal elders gebruikte "naam|klasse|district|seizoen" (4 delen) - vond de
al bestaande, echte rij (met poules) dus nooit en maakte een kale duplicaat
aan zonder district en zonder poules, wel met het juiste hl_comp_id
(roadmap-melding: "ONBEKEND · Geen poules" naast de echte rij met poules).

Deze migratie voegt zulke duplicaten samen: voor elke competitie zonder
district die een naam/klasse/seizoen deelt met een competitie mét district,
wordt het hl_comp_id overgenomen op de echte rij en de kale duplicaat
verwijderd (alleen als de duplicaat zelf geen poules heeft - anders niet
aanraken, dat is geen geval van deze bug).

Revision ID: a687203f4148
Revises: fea3978caadc
Branch_labels: None
Depends_on: None
"""
from datetime import datetime, timezone

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "a687203f4148"
down_revision = "fea3978caadc"
branch_labels = None
depends_on = None

NOW = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


def upgrade():
    bind = op.get_bind()

    duplicates = bind.execute(
        text("""
            SELECT id, name, class_name, season, hl_comp_id FROM hockey_competitions
            WHERE (district IS NULL OR district = '')
        """)
    ).fetchall()

    merged = 0
    for dup_id, name, class_name, season, hl_comp_id in duplicates:
        poule_count = bind.execute(
            text("SELECT COUNT(*) FROM hockey_poules WHERE competition_id = :cid"), {"cid": dup_id}
        ).fetchone()[0]
        if poule_count > 0:
            continue  # geen kale duplicaat, niet aanraken

        real = bind.execute(
            text("""
                SELECT id FROM hockey_competitions
                WHERE name = :name AND class_name = :class_name AND season = :season
                  AND id != :dup_id AND district IS NOT NULL AND district != ''
                LIMIT 1
            """),
            {"name": name, "class_name": class_name, "season": season, "dup_id": dup_id},
        ).fetchone()
        if not real:
            continue

        if hl_comp_id:
            bind.execute(
                text("UPDATE hockey_competitions SET hl_comp_id = :hcid, updated_at = :now WHERE id = :id"),
                {"hcid": hl_comp_id, "now": NOW, "id": real[0]},
            )
        bind.execute(text("DELETE FROM hockey_competitions WHERE id = :id"), {"id": dup_id})
        merged += 1

    print(f"[merge-duplicate-national-competitions] {merged} kale duplicaat(en) samengevoegd")


def downgrade():
    pass
