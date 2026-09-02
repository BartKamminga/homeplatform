"""context verhuist van mindbox_items naar mindbox_cases (item 1051: per case, niet per bestand)

Revision ID: 6559f650dd63
Revises: 877569e65a0d
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "6559f650dd63"
down_revision = "877569e65a0d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    case_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_cases)")).fetchall()}
    if "context_id" not in case_cols:
        op.add_column("mindbox_cases", sa.Column("context_id", sa.String(), nullable=True))

    item_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}
    if "context_id" in item_cols:
        # Best-effort overzetten: elke case krijgt de context van het eerst
        # geuploade gekoppelde item dat er een had. Had een case meerdere
        # items met VERSCHILLENDE contexts (kon in de oude, per-item opzet),
        # dan gaan de overige keuzes verloren - acceptabel, dit is nog geen
        # data waar echt mee gewerkt is.
        bind.execute(sa.text(
            "UPDATE mindbox_cases SET context_id = ("
            "  SELECT mi.context_id FROM mindbox_items mi"
            "  WHERE mi.case_id = mindbox_cases.id AND mi.context_id IS NOT NULL"
            "  ORDER BY mi.created_at ASC LIMIT 1"
            ") WHERE context_id IS NULL"
        ))
        with op.batch_alter_table("mindbox_items") as batch_op:
            batch_op.drop_column("context_id")


def downgrade() -> None:
    with op.batch_alter_table("mindbox_items") as batch_op:
        batch_op.add_column(sa.Column("context_id", sa.String(), nullable=True))
    op.drop_column("mindbox_cases", "context_id")
