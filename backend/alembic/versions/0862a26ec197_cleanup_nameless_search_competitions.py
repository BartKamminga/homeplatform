"""cleanup_nameless_search_competitions: verwijdert de "Comp <id>"-rommel
die _call_competitions_list aanmaakte voor team-/club-zoekresultaten.

Bart deelde de raw payload van een get_competitions-scan (hockey.nl's
/search/competition): die zoekresultaten mixen teams/competities/clubs in
dezelfde lijst. _call_competitions_list behandelde elk item als een platte
competitie, dus team-/club-hits (met hun eigen zoekresultaat-id, geen
competitie-id) werden aangemaakt als naamloze "Comp <id>"-competities.
Code-fix in hockey_vanger_ingest.py pakt nu alleen items met een geneste
"competition"-object.

Revision ID: 0862a26ec197
Revises: cc1b31e97be5
Branch_labels: None
Depends_on: None
"""
from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "0862a26ec197"
down_revision = "cc1b31e97be5"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    rows = bind.execute(
        text("SELECT id FROM hockey_competitions WHERE name LIKE 'Comp %'")
    ).fetchall()

    deleted = 0
    for (comp_id,) in rows:
        poule_count = bind.execute(
            text("SELECT COUNT(*) FROM hockey_poules WHERE competition_id = :cid"),
            {"cid": comp_id},
        ).fetchone()[0]
        if poule_count == 0:
            bind.execute(text("DELETE FROM hockey_competitions WHERE id = :cid"), {"cid": comp_id})
            deleted += 1

    print(f"[cleanup-nameless-search-competitions] {deleted} rommel-competities verwijderd")


def downgrade():
    pass
