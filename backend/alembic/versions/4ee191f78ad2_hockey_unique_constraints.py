"""RFTR-B4 (refactor-plan hockey-inside Fase 4a-4c, roadmap 987): unique
database-constraints die eerder alleen applicatie-laag-guards waren -
precies het soort gat dat de hl_comp_id-productiebug deze sessie mogelijk
maakte (twee competities met hetzelfde hockey.nl-competitie-id, alleen
afgedekt door _release_stale_hl_comp_id in code, niet door de database).

- hockey_competitions.hl_comp_id: partial unique index (NULL toegestaan,
  dubbele non-NULL niet).
- hockey_poule_standings (poule_id, team_id): composite unique index -
  hoort per definitie uniek te zijn (1 standrij per team per poule).
- hockey_poule_matches (poule_id, match_id): partial unique index
  (match_id is optioneel voor wedstrijden zonder hockey.nl-id).

Elk krijgt eerst een defensieve opschoon-stap (zelfde patroon als
cc1b31e97be5/47ca6d5b0aec eerder deze sessie) voor het geval er toch
duplicaten blijken te bestaan - op de acc-database (getest) waren er geen.

Revision ID: 4ee191f78ad2
Revises: 410616cf23a4
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa

revision = "4ee191f78ad2"
down_revision = "410616cf23a4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # -- hl_comp_id: per duplicaat-groep alleen de meest recent bijgewerkte
    # rij het hl_comp_id laten behouden, de rest op NULL zetten. --
    dupes = bind.execute(sa.text("""
        SELECT hl_comp_id FROM hockey_competitions
        WHERE hl_comp_id IS NOT NULL
        GROUP BY hl_comp_id HAVING COUNT(*) > 1
    """)).fetchall()
    for (hl_cid,) in dupes:
        rows = bind.execute(sa.text("""
            SELECT id FROM hockey_competitions WHERE hl_comp_id = :hcid ORDER BY updated_at DESC
        """), {"hcid": hl_cid}).fetchall()
        for (loser_id,) in rows[1:]:
            bind.execute(sa.text("UPDATE hockey_competitions SET hl_comp_id = NULL WHERE id = :id"), {"id": loser_id})
    if dupes:
        print(f"[hockey-unique-constraints] {len(dupes)} dubbele hl_comp_id-groep(en) opgeschoond")

    op.create_index(
        "ux_hockey_competitions_hl_comp_id", "hockey_competitions", ["hl_comp_id"],
        unique=True, sqlite_where=sa.text("hl_comp_id IS NOT NULL"),
    )

    # -- (poule_id, team_id) standings: per duplicaat-groep alleen de rij met
    # het hoogste id (laatst geschreven) bewaren. --
    dupes = bind.execute(sa.text("""
        SELECT poule_id, team_id FROM hockey_poule_standings
        GROUP BY poule_id, team_id HAVING COUNT(*) > 1
    """)).fetchall()
    for poule_id, team_id in dupes:
        rows = bind.execute(sa.text("""
            SELECT id FROM hockey_poule_standings WHERE poule_id = :pid AND team_id = :tid ORDER BY id DESC
        """), {"pid": poule_id, "tid": team_id}).fetchall()
        for (loser_id,) in rows[1:]:
            bind.execute(sa.text("DELETE FROM hockey_poule_standings WHERE id = :id"), {"id": loser_id})
    if dupes:
        print(f"[hockey-unique-constraints] {len(dupes)} dubbele (poule_id, team_id)-standrij(en) opgeschoond")

    op.create_index(
        "ux_hockey_poule_standings_poule_team", "hockey_poule_standings", ["poule_id", "team_id"], unique=True,
    )

    # -- (poule_id, match_id) matches: zelfde patroon, match_id optioneel. --
    dupes = bind.execute(sa.text("""
        SELECT poule_id, match_id FROM hockey_poule_matches
        WHERE match_id IS NOT NULL
        GROUP BY poule_id, match_id HAVING COUNT(*) > 1
    """)).fetchall()
    for poule_id, match_id in dupes:
        rows = bind.execute(sa.text("""
            SELECT id FROM hockey_poule_matches WHERE poule_id = :pid AND match_id = :mid ORDER BY id DESC
        """), {"pid": poule_id, "mid": match_id}).fetchall()
        for (loser_id,) in rows[1:]:
            bind.execute(sa.text("DELETE FROM hockey_poule_matches WHERE id = :id"), {"id": loser_id})
    if dupes:
        print(f"[hockey-unique-constraints] {len(dupes)} dubbele (poule_id, match_id)-wedstrijd(en) opgeschoond")

    op.create_index(
        "ux_hockey_poule_matches_poule_match", "hockey_poule_matches", ["poule_id", "match_id"],
        unique=True, sqlite_where=sa.text("match_id IS NOT NULL"),
    )


def downgrade():
    op.drop_index("ux_hockey_poule_matches_poule_match", table_name="hockey_poule_matches")
    op.drop_index("ux_hockey_poule_standings_poule_team", table_name="hockey_poule_standings")
    op.drop_index("ux_hockey_competitions_hl_comp_id", table_name="hockey_competitions")
