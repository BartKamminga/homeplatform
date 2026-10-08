"""yearof Parijs weekend als eigen pagina

Revision ID: e2b4d6f8a1c3
Revises: d7f9b1c3e5a2
Create Date: 2026-10-08

Item 1239: de pagina Parijs weekend hing aan een vastgepinde bijzondere dag.
Nu is het een eigen pagina met eigen berichten en fotos onder de vaste
verwijzing page:pinksterweekend. Deze migratie verhuist de inhoud van de
vastgepinde (niet-gearchiveerde) dag(en) naar die verwijzing en maakt ze los.
De dag zelf blijft bestaan als gewone bijzondere dag.
"""
from alembic import op
import sqlalchemy as sa

revision = "e2b4d6f8a1c3"
down_revision = "d7f9b1c3e5a2"
branch_labels = None
depends_on = None

PARIS_REF = "page:pinksterweekend"
# Tabellen met een match_ref-kolom waarvan de inhoud meeverhuist.
CONTENT_TABLES = ["yearof_reports", "yearof_photos", "yearof_contributor_links"]


def upgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "yearof_custom_entries" not in tables:
        return
    pinned = bind.execute(sa.text(
        "SELECT id FROM yearof_custom_entries WHERE is_pinned = 1 AND archived_at IS NULL"
    )).fetchall()
    for (entry_id,) in pinned:
        old_ref = f"custom:{entry_id}"
        for table in CONTENT_TABLES:
            if table in tables:
                bind.execute(sa.text(f"UPDATE {table} SET match_ref = :new WHERE match_ref = :old"),
                             {"new": PARIS_REF, "old": old_ref})
        # Positie van het fotoblok meenemen, als de pagina er nog geen heeft.
        if "yearof_match_photo_blocks" in tables:
            exists = bind.execute(sa.text("SELECT 1 FROM yearof_match_photo_blocks WHERE match_ref = :new"),
                                  {"new": PARIS_REF}).first()
            if exists:
                bind.execute(sa.text("DELETE FROM yearof_match_photo_blocks WHERE match_ref = :old"), {"old": old_ref})
            else:
                bind.execute(sa.text("UPDATE yearof_match_photo_blocks SET match_ref = :new WHERE match_ref = :old"),
                             {"new": PARIS_REF, "old": old_ref})
    bind.execute(sa.text("UPDATE yearof_custom_entries SET is_pinned = 0 WHERE is_pinned = 1"))


def downgrade():
    # Niet terug te draaien: welke dag vastgepind was, is niet bewaard.
    pass
