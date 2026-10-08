"""yearof In de kijker als pagina

Revision ID: f3c5e7a9b2d4
Revises: e2b4d6f8a1c3
Create Date: 2026-10-08

Item 1241/1249: In de kijker is een vaste pagina met eigen berichten
(page:spotlight). Algemene berichten zonder pagina (match_ref leeg) verhuizen
daarheen, samen met de fotos die bij die berichten horen. Wat nu altijd
automatisch in de kijker stond (nieuws) krijgt "Toon op Home" (featured),
zodat Home hetzelfde blijft tonen.
"""
from alembic import op
import sqlalchemy as sa

revision = "f3c5e7a9b2d4"
down_revision = "e2b4d6f8a1c3"
branch_labels = None
depends_on = None

SPOTLIGHT_REF = "page:spotlight"


def upgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "yearof_reports" not in tables:
        return
    # Waarden als parameters - geen apostrofs in de SQL zelf.
    no_page = "(match_ref IS NULL OR match_ref = :empty)"
    ids = [r[0] for r in bind.execute(sa.text(f"SELECT id FROM yearof_reports WHERE {no_page}"),
                                       {"empty": ""}).fetchall()]
    if not ids:
        return
    bind.execute(sa.text(f"UPDATE yearof_reports SET featured = 1 WHERE {no_page} AND report_type = :news"),
                 {"empty": "", "news": "nieuws"})
    bind.execute(sa.text(f"UPDATE yearof_reports SET match_ref = :ref WHERE {no_page}"),
                 {"ref": SPOTLIGHT_REF, "empty": ""})
    if "yearof_photos" in tables:
        for report_id in ids:
            bind.execute(sa.text("UPDATE yearof_photos SET match_ref = :ref WHERE report_id = :rid"),
                         {"ref": SPOTLIGHT_REF, "rid": report_id})


def downgrade():
    # Niet terug te draaien: welke berichten eerst geen pagina hadden, is niet bewaard.
    pass
