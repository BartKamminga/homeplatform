"""fix_season_label_mismatches: herstelt hockey_competitions/hockey_poules waar het
seizoen-label niet meer bij elkaar past (roadmap item 973 vervolg).

Twee samenhangende oorzaken in _call_poule_capture (hockey_vanger_ingest.py /
hockey_capture.py), nu ook gefixt in de code:
1. De "hergebruik gelijknamige competitie uit ander seizoen"-heuristiek
   overschreef het season-veld van een bestaande competitie ook als daar nog
   poules van het oude seizoen aan hingen (bv. "Jongens O14 Lente" bleef als
   2026-2027 rondhangen terwijl het pure 2025-2026-data was).
2. raw["seizoen"] (site-scancontext) kreeg voorrang boven de wedstrijddatum,
   waardoor een enkele poule een afwijkend seizoen kreeg t.o.v. de rest van
   zijn competitie.

Deze migratie corrigeert generiek (op basis van de huidige data, niet op
hardcoded ids):
  A) competities waarvan ALLE gekoppelde poules hetzelfde seizoen delen dat
     afwijkt van het eigen season-veld -> season/external_id van de
     competitie corrigeren.
  B) poules met een leeg season-veld -> overnemen van hun (inmiddels
     correcte) competitie.
  C) een enkele afwijkende poule binnen een competitie (geen andere poule
     deelt dat seizoen) -> corrigeren naar het competitie-seizoen.

Revision ID: ae789bdad08b
Revises: 519a43d52a53
Branch_labels: None
Depends_on: None
"""
import re
from datetime import datetime, timezone

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "ae789bdad08b"
down_revision = "519a43d52a53"
branch_labels = None
depends_on = None

NOW = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")
_SEASON_RE = re.compile(r"^\d{4}-\d{4}$")


def upgrade():
    bind = op.get_bind()

    # Rule A
    comps = bind.execute(
        text("SELECT id, name, class_name, district, season FROM hockey_competitions")
    ).fetchall()
    fixed_comps = 0
    for comp_id, name, class_name, district, comp_season in comps:
        poule_seasons = {
            r[0] for r in bind.execute(
                text("SELECT DISTINCT season FROM hockey_poules WHERE competition_id = :cid"),
                {"cid": comp_id},
            ).fetchall()
            if r[0] and _SEASON_RE.match(r[0])
        }
        if len(poule_seasons) == 1:
            (only_season,) = tuple(poule_seasons)
            if only_season != comp_season:
                new_ext_id = name + "|" + (class_name or "") + "|" + (district or "") + "|" + only_season
                bind.execute(
                    text("""
                        UPDATE hockey_competitions
                        SET season = :s, external_id = :e, updated_at = :now
                        WHERE id = :cid
                    """),
                    {"s": only_season, "e": new_ext_id, "now": NOW, "cid": comp_id},
                )
                fixed_comps += 1

    # Rule B
    fixed_empty = bind.execute(
        text("""
            UPDATE hockey_poules
            SET season = (SELECT season FROM hockey_competitions WHERE id = hockey_poules.competition_id),
                updated_at = :now
            WHERE season = ''
              AND EXISTS (
                  SELECT 1 FROM hockey_competitions hc
                  WHERE hc.id = hockey_poules.competition_id AND hc.season != ''
              )
        """),
        {"now": NOW},
    ).rowcount

    # Rule C
    mismatches = bind.execute(
        text("""
            SELECT hp.poule_id, hp.competition_id, hc.season
            FROM hockey_poules hp
            JOIN hockey_competitions hc ON hc.id = hp.competition_id
            WHERE hp.season != hc.season AND hp.season != ''
        """)
    ).fetchall()
    fixed_outliers = 0
    for poule_id, comp_id, comp_season in mismatches:
        if not _SEASON_RE.match(comp_season or ""):
            continue
        sibling_count = bind.execute(
            text("""
                SELECT COUNT(*) FROM hockey_poules
                WHERE competition_id = :cid AND poule_id != :pid
                  AND season = (SELECT season FROM hockey_poules WHERE poule_id = :pid)
            """),
            {"cid": comp_id, "pid": poule_id},
        ).fetchone()[0]
        if sibling_count == 0:
            bind.execute(
                text("UPDATE hockey_poules SET season = :s, updated_at = :now WHERE poule_id = :pid"),
                {"s": comp_season, "now": NOW, "pid": poule_id},
            )
            fixed_outliers += 1

    print(
        f"[fix-season-labels] competities gecorrigeerd: {fixed_comps} | "
        f"lege poule-seizoenen ingevuld: {fixed_empty} | "
        f"afwijkende poules gesynced: {fixed_outliers}"
    )


def downgrade():
    pass
