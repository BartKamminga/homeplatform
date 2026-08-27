"""cleanup_unknown_season_competitions: ruimt hockey_competitions/hockey_poules
met season='onbekend' op (roadmap item 975 vervolg, gesignaleerd door Bart in
het Discovery-overzicht: "onbekend 2 comp. / 3 poules / 0/3 gevangen").

Onderzocht per geval (geen generieke heuristiek, want maar 2 competities/3
poules betroffen en elk geval had een andere oorzaak):
- "Tulp Hoofdklasse Dames|Hoofdklasse" (onbekend): poule zonder wedstrijden
  maar met alle 12 D1-teams gekoppeld - bleek een kale duplicaat van de al
  correct gevangen poule onder "Tulp Hoofdklasse Dames|Hoofdklasse|2025-2026"
  (zelfde naam/klasse/district, andere rij). Teams verwijzen naar de echte
  poule, duplicaat + lege competitie verwijderd.
- "Tulp Hoofdklasse Heren|Hoofdklasse" (onbekend): twee poules - een volledig
  lege (geen teams, geen wedstrijden, puur ruis) en een met alle 10 H1-teams
  maar nog nooit gescand. Geen gelijknamige/klasse/district-competitie elders
  in de DB (alleen de "Plaatsing Hoofdklasse Heren"-fase is gevangen). Lege
  poule verwijderd, seizoen van de overgebleven poule/competitie overgenomen
  van de gelijknamige "Plaatsing"-competitie (2025-2026) - zelfde toernooi,
  andere fase, hoort bij hetzelfde seizoen.

Revision ID: 47ca6d5b0aec
Revises: ae789bdad08b
Branch_labels: None
Depends_on: None
"""
from datetime import datetime, timezone

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "47ca6d5b0aec"
down_revision = "ae789bdad08b"
branch_labels = None
depends_on = None

NOW = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


def upgrade():
    bind = op.get_bind()

    unknown_comps = bind.execute(
        text("SELECT id, name, class_name, district FROM hockey_competitions WHERE season = 'onbekend'")
    ).fetchall()

    deleted_poules = 0
    merged_poules  = 0
    fixed_comps    = 0
    deleted_comps  = 0

    for comp_id, comp_name, comp_class, comp_district in unknown_comps:
        poules = bind.execute(
            text("SELECT poule_id FROM hockey_poules WHERE competition_id = :cid"),
            {"cid": comp_id},
        ).fetchall()

        for (poule_id,) in poules:
            match_count = bind.execute(
                text("SELECT COUNT(*) FROM hockey_poule_matches WHERE poule_id = :pid"),
                {"pid": poule_id},
            ).fetchone()[0]
            if match_count > 0:
                continue  # heeft echte data, laten staan

            team_ids = [
                r[0] for r in bind.execute(
                    text("SELECT team_id FROM hockey_teams WHERE recent_poule_id = :pid"),
                    {"pid": poule_id},
                ).fetchall()
            ]

            if not team_ids:
                # Volledig lege poule (geen teams, geen wedstrijden) - pure ruis.
                bind.execute(text("DELETE FROM hockey_poules WHERE poule_id = :pid"), {"pid": poule_id})
                deleted_poules += 1
                continue

            # Bestaat er al een echte (bekend-seizoen) competitie met exact
            # dezelfde naam/klasse/district? Dan is dit een kale duplicaat
            # daarvan - teams verhuizen naar de echte poule.
            real_comp = bind.execute(
                text("""
                    SELECT id FROM hockey_competitions
                    WHERE name = :name AND COALESCE(class_name,'') = :class_name
                      AND COALESCE(district,'') = :district AND season != 'onbekend'
                    LIMIT 1
                """),
                {"name": comp_name, "class_name": comp_class or "", "district": comp_district or ""},
            ).fetchone()
            real_poule = real_comp and bind.execute(
                text("SELECT poule_id FROM hockey_poules WHERE competition_id = :cid LIMIT 1"),
                {"cid": real_comp[0]},
            ).fetchone()

            if real_poule:
                bind.execute(
                    text("UPDATE hockey_teams SET recent_poule_id = :new, updated_at = :now WHERE recent_poule_id = :old"),
                    {"new": real_poule[0], "old": poule_id, "now": NOW},
                )
                bind.execute(text("DELETE FROM hockey_poules WHERE poule_id = :pid"), {"pid": poule_id})
                merged_poules += 1
            else:
                # Enige bron voor deze teams, maar nog nooit gescand - seizoen
                # overnemen van een gelijknamige competitie (andere fase van
                # hetzelfde toernooi) die wel al een bekend seizoen heeft.
                sibling_season = bind.execute(
                    text("""
                        SELECT season FROM hockey_competitions
                        WHERE name = :name AND season != 'onbekend'
                        ORDER BY season DESC LIMIT 1
                    """),
                    {"name": comp_name},
                ).fetchone()
                if sibling_season:
                    bind.execute(
                        text("UPDATE hockey_poules SET season = :s, updated_at = :now WHERE poule_id = :pid"),
                        {"s": sibling_season[0], "now": NOW, "pid": poule_id},
                    )
                    bind.execute(
                        text("""
                            UPDATE hockey_competitions
                            SET season = :s, external_id = name || '|' || COALESCE(class_name,'') || '|' || COALESCE(district,'') || '|' || :s,
                                updated_at = :now
                            WHERE id = :cid
                        """),
                        {"s": sibling_season[0], "now": NOW, "cid": comp_id},
                    )
                    fixed_comps += 1

        remaining = bind.execute(
            text("SELECT COUNT(*) FROM hockey_poules WHERE competition_id = :cid"),
            {"cid": comp_id},
        ).fetchone()[0]
        if remaining == 0:
            bind.execute(text("DELETE FROM hockey_competitions WHERE id = :cid"), {"cid": comp_id})
            deleted_comps += 1

    print(
        f"[cleanup-unknown-season] lege poules verwijderd: {deleted_poules} | "
        f"duplicaat-poules samengevoegd: {merged_poules} | "
        f"competities/poules seizoen toegekend: {fixed_comps} | "
        f"lege competities verwijderd: {deleted_comps}"
    )


def downgrade():
    pass
