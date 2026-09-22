"""yearof report match_highlight backfill

Vóór dit veld bestond, toonde de wedstrijdlink (/l/code) automatisch ALLE
gepubliceerde verslagen van die wedstrijd - er was geen curatieconcept voor
verslagen, alleen voor fotos. Zonder backfill zou elk bestaand verslag na
deze rollout plotseling verdwijnen van de wedstrijdlink (default false).
Deze migratie zet bestaande, aan een wedstrijd gekoppelde verslagen op
highlighted, zodat de link niet leger wordt. Nieuwe verslagen vanaf nu
blijven bewust opt-in (default false), zelfde als bij fotos.

Revision ID: a3c5e7f9b1d3
Revises: f1e3d5c7b9a1
Create Date: 2026-09-22

"""
from alembic import op
import sqlalchemy as sa

revision = "a3c5e7f9b1d3"
down_revision = "f1e3d5c7b9a1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("yearof_reports")]
    if "match_highlight" in columns:
        bind.execute(
            sa.text("UPDATE yearof_reports SET match_highlight = 1 WHERE match_ref IS NOT NULL")
        )


def downgrade():
    pass
