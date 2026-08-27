"""correct_poule_175545_season: herstelt een verkeerde beslissing uit migratie
ae789bdad08b (roadmap item 975).

Bart signaleerde dat de poule-ID-reeks van 2026-2027 (175545-182630) diep
overlapt met die van 2025-2026 (173335-180864). Nader onderzoek: zonder
poule 175545 lopen de reeksen bijna naadloos door (2025-2026 eindigt op
180864, 2026-2027 begint op 180867 - hockey.nl deelt kennelijk een doorlopende
ID-reeks tussen het einde van het ene en het begin van het andere seizoen).

Poule 175545 ("Meisjes O18 Voorcompetitie") was het enige uitzonderingsgeval:
0 wedstrijden, 0 standings, geen enkel bewijs in de data zelf. Migratie
ae789bdad08b paste hier "Rule C" (afwijkende poule volgt competitie-seizoen)
toe en zette het seizoen om naar 2026-2027 - maar dat berustte puur op het
feit dat de competitie (193) kort daarvoor door de rollover-bug naar
2026-2027 was omgezet, niet op enig bewijs over poule 175545 zelf. De
ID-clustering (175545 ligt diep in de 2025-2026-reeks, ver onder de
180867-grens) wijst juist op het tegenovergestelde: dit was en is
vermoedelijk gewoon 2025-2026-data (een nooit gespeelde/leeg gebleven
voorcompetitie-poule).

Deze migratie zet het seizoen terug naar 2025-2026 en ontkoppelt de poule
van competitie 193 (die inmiddels correct en uitsluitend 2026-2027
representeert) naar een eigen nieuwe competitie-rij voor 2025-2026.

Revision ID: f273bf51149d
Revises: 47ca6d5b0aec
Branch_labels: None
Depends_on: None
"""
from datetime import datetime, timezone

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "f273bf51149d"
down_revision = "47ca6d5b0aec"
branch_labels = None
depends_on = None

NOW = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")
TARGET_SEASON = "2025-2026"


def upgrade():
    bind = op.get_bind()

    poule = bind.execute(
        text("SELECT poule_id, season, competition_id FROM hockey_poules WHERE poule_id = 175545")
    ).fetchone()
    if not poule or poule[1] != "2026-2027":
        print("[correct-poule-175545] niets te doen (poule niet gevonden of al gecorrigeerd)")
        return

    old_comp_id = poule[2]
    comp = bind.execute(
        text("SELECT name, class_name, district, hockey_type FROM hockey_competitions WHERE id = :cid"),
        {"cid": old_comp_id},
    ).fetchone()
    if not comp:
        print("[correct-poule-175545] competitie niet gevonden, overgeslagen")
        return
    name, class_name, district, hockey_type = comp

    ext_id = name + "|" + (class_name or "") + "|" + (district or "") + "|" + TARGET_SEASON
    target_comp = bind.execute(
        text("SELECT id FROM hockey_competitions WHERE external_id = :e"), {"e": ext_id}
    ).fetchone()
    if target_comp:
        new_comp_id = target_comp[0]
    else:
        bind.execute(
            text("""
                INSERT INTO hockey_competitions
                    (external_id, name, class_name, district, hockey_type, season, discovered_at, updated_at)
                VALUES (:e, :name, :class_name, :district, :ht, :season, :now, :now)
            """),
            {"e": ext_id, "name": name, "class_name": class_name, "district": district,
             "ht": hockey_type, "season": TARGET_SEASON, "now": NOW},
        )
        new_comp_id = bind.execute(text("SELECT last_insert_rowid()")).fetchone()[0]

    bind.execute(
        text("""
            UPDATE hockey_poules SET season = :s, competition_id = :cid, updated_at = :now
            WHERE poule_id = 175545
        """),
        {"s": TARGET_SEASON, "cid": new_comp_id, "now": NOW},
    )

    print(f"[correct-poule-175545] seizoen teruggezet naar {TARGET_SEASON}, verplaatst naar competitie {new_comp_id}")


def downgrade():
    pass
