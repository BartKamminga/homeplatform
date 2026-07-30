"""repair_competition_poule_links: herstel competition_id per poule via data_captures

Revision ID: ss6tt7uu8vv9
Revises: rr5ss6tt7uu8
Branch_labels: None
Depends_on: None
"""
import json
from datetime import datetime

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "ss6tt7uu8vv9"
down_revision = "rr5ss6tt7uu8"
branch_labels = None
depends_on = None

NOW = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def _parse_capture(payload_json):
    """Retourneer (poule_id, comp_name, class_name, district, season) of None."""
    try:
        pay = json.loads(payload_json)
        poule_id = pay.get("poule_id")
        if not poule_id:
            return None
        poule_data = (pay.get("data") or {}).get("data") or {}
        poule_data = poule_data.get("poule") or {}
        comp = poule_data.get("competition") or {}
        subcomp = comp.get("subcompetition") or {}
        comp_name = (comp.get("name") or "").strip()
        class_name = ((subcomp.get("class") or comp.get("class_name") or "")).strip()
        district = (comp.get("district_name") or comp.get("district") or "").strip()
        season = (pay.get("seizoen") or "").strip()
        if not comp_name or not season:
            return None
        return (int(poule_id), comp_name, class_name, district, season)
    except Exception:
        return None


def upgrade():
    bind = op.get_bind()

    captures = bind.execute(
        text("SELECT payload FROM data_captures WHERE capture_type = 'poule_capture'")
    ).fetchall()

    # Stap 1: bouw correcte comp-mapping op
    poule_to_comp = {}  # poule_id -> (ext_id, comp_name, class_name, district, season)
    for row in captures:
        parsed = _parse_capture(row[0])
        if not parsed:
            continue
        pid, comp_name, class_name, district, season = parsed
        ext_id = comp_name + "|" + class_name + "|" + district + "|" + season
        poule_to_comp[pid] = (ext_id, comp_name, class_name, district, season)

    if not poule_to_comp:
        return

    # Stap 2: haal bestaande competitions op (ext_id -> id)
    existing = {
        r[0]: r[1]
        for r in bind.execute(
            text("SELECT external_id, id FROM hockey_competitions")
        ).fetchall()
    }

    # Stap 3: voor elke unieke (ext_id, ...) - maak aan indien ontbreekt
    unique_comps = {}
    for ext_id, comp_name, class_name, district, season in poule_to_comp.values():
        if ext_id not in unique_comps:
            unique_comps[ext_id] = (comp_name, class_name, district, season)

    for ext_id, (comp_name, class_name, district, season) in unique_comps.items():
        if ext_id in existing:
            continue
        # Haal hockey_type van een bestaande comp met dezelfde naam op
        ref = bind.execute(
            text("SELECT hockey_type FROM hockey_competitions WHERE name = :n AND season = :s LIMIT 1"),
            {"n": comp_name, "s": season},
        ).fetchone()
        hockey_type = ref[0] if ref else "VE"
        bind.execute(
            text("""
                INSERT INTO hockey_competitions
                    (external_id, name, class_name, district, hockey_type, season,
                     discovered_at, updated_at)
                VALUES
                    (:ext_id, :name, :class_name, :district, :hockey_type, :season,
                     :now, :now)
            """),
            {
                "ext_id": ext_id,
                "name": comp_name,
                "class_name": class_name,
                "district": district or None,
                "hockey_type": hockey_type,
                "season": season,
                "now": NOW,
            },
        )
        new_id = bind.execute(text("SELECT last_insert_rowid()")).fetchone()[0]
        existing[ext_id] = new_id

    # Stap 4: update hockey_poules.competition_id
    updated = 0
    for poule_id, (ext_id, *_) in poule_to_comp.items():
        comp_db_id = existing.get(ext_id)
        if not comp_db_id:
            continue
        result = bind.execute(
            text("""
                UPDATE hockey_poules
                SET competition_id = :comp_id
                WHERE poule_id = :poule_id
                  AND competition_id != :comp_id
            """),
            {"comp_id": comp_db_id, "poule_id": poule_id},
        )
        updated += result.rowcount

    print(f"[repair] {updated} poules hernomen naar correcte competitie")


def downgrade():
    pass
