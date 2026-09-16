"""yearof report sort_order (WYSIWYG match page reordering)

Revision ID: 846634521e23
Revises: 98398829b613
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "846634521e23"
down_revision = "98398829b613"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("yearof_reports")}
    if "sort_order" not in existing_cols:
        op.add_column("yearof_reports", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))

    # Bestaande rijen per wedstrijd op hun huidige (created_at-)volgorde
    # zetten, in stappen van 1000 zodat er later makkelijk tussenin
    # ingevoegd kan worden zonder alles te hoeven herindexeren.
    rows = bind.execute(sa.text(
        "SELECT id, match_ref FROM yearof_reports WHERE match_ref IS NOT NULL ORDER BY match_ref, created_at"
    )).fetchall()
    counters = {}
    for row in rows:
        n = counters.get(row.match_ref, 0) + 1000
        counters[row.match_ref] = n
        bind.execute(sa.text("UPDATE yearof_reports SET sort_order = :n WHERE id = :id"), {"n": n, "id": row.id})


def downgrade() -> None:
    op.drop_column("yearof_reports", "sort_order")
