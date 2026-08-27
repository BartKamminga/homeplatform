"""fix_duplicate_hl_comp_id: "Landelijk Jongens O16" hield ten onrechte het
hl_comp_id (24) van "Gold Cup Dames" vast.

Bart vond op prod een get_competition_detail-scan in de cmd-queue met label
"Landelijk Jongens O16" die als resultaat "Gold Cup Dames" opleverde. De
gedeelde raw payload bevestigt dat hockey.nl's eigen national_competition_id
24 overal consistent "Gold Cup Dames" is - het conflict zat puur in onze
data (geen unique constraint op hl_comp_id, dus nooit tegengehouden). Dit
was het enige zo'n conflict in de hele DB. "Landelijk Jongens O16" heeft
zijn eigen poules, die los van hl_comp_id via het normale per-poule-scanpad
gevangen worden - dit kostte alleen onnodige/verwarrende landelijke-comp-
scans, geen dataverlies.

Per hl_comp_id kan de conflicterende naam-groep meerdere rijen hebben (een
per seizoen) - de winnende naam-groep is die met de meest recente
updated_at (het meest recent bevestigd door een echte capture); alle rijen
van de andere naam-groep(en) worden vrijgegeven.

Bijbehorende code-fix in hockey_vanger_ingest.py (_release_stale_hl_comp_id)
voorkomt dat dit opnieuw kan gebeuren.

Revision ID: cc1b31e97be5
Revises: f273bf51149d
Branch_labels: None
Depends_on: None
"""
from datetime import datetime, timezone

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "cc1b31e97be5"
down_revision = "f273bf51149d"
branch_labels = None
depends_on = None

NOW = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


def upgrade():
    bind = op.get_bind()

    dupes = bind.execute(
        text("""
            SELECT hl_comp_id FROM hockey_competitions
            WHERE hl_comp_id IS NOT NULL
            GROUP BY hl_comp_id HAVING COUNT(DISTINCT name) > 1
        """)
    ).fetchall()

    fixed = 0
    for (hl_comp_id,) in dupes:
        name_groups = bind.execute(
            text("""
                SELECT name, MAX(updated_at) FROM hockey_competitions
                WHERE hl_comp_id = :hcid GROUP BY name
            """),
            {"hcid": hl_comp_id},
        ).fetchall()
        winning_name = max(name_groups, key=lambda ng: ng[1])[0]

        losers = bind.execute(
            text("SELECT id FROM hockey_competitions WHERE hl_comp_id = :hcid AND name != :name"),
            {"hcid": hl_comp_id, "name": winning_name},
        ).fetchall()
        for (row_id,) in losers:
            bind.execute(
                text("UPDATE hockey_competitions SET hl_comp_id = NULL, updated_at = :now WHERE id = :id"),
                {"now": NOW, "id": row_id},
            )
            fixed += 1

    print(f"[fix-duplicate-hl-comp-id] {fixed} competitie(s) hl_comp_id vrijgegeven")


def downgrade():
    pass
