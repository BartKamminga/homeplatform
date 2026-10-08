"""yearof volgorde van berichten per pagina rechtzetten

Revision ID: b5e7a9c2d4f6
Revises: a4d6f8b1c3e5
Create Date: 2026-10-08

Item 1241: algemene berichten (zonder wedstrijd) hadden allemaal sort_order 0.
Na de verhuizing naar de pagina In de kijker konden ze daardoor niet meer
verplaatst worden (omwisselen van gelijke waarden doet niets). Per pagina met
dubbele waarden: opnieuw nummeren in de huidige weergavevolgorde (sort_order,
dan nieuwste eerst), in stappen van 1000. Idempotent.
"""
from alembic import op
import sqlalchemy as sa

revision = "b5e7a9c2d4f6"
down_revision = "a4d6f8b1c3e5"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "yearof_reports" not in set(sa.inspect(bind).get_table_names()):
        return
    refs = [r[0] for r in bind.execute(sa.text(
        "SELECT match_ref FROM yearof_reports WHERE match_ref IS NOT NULL "
        "GROUP BY match_ref, sort_order HAVING COUNT(*) > 1"
    )).fetchall()]
    for ref in set(refs):
        rows = bind.execute(sa.text(
            "SELECT id FROM yearof_reports WHERE match_ref = :ref ORDER BY sort_order, created_at DESC"
        ), {"ref": ref}).fetchall()
        for n, (report_id,) in enumerate(rows, start=1):
            bind.execute(sa.text("UPDATE yearof_reports SET sort_order = :so WHERE id = :id"),
                         {"so": n * 1000, "id": report_id})


def downgrade():
    pass
