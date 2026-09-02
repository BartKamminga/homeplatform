"""mindbox_items.parent_item_id toevoegen - bijlagen van een mail (item 1051)

Revision ID: b70c3863667c
Revises: ad1a70680c46
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "b70c3863667c"
down_revision = "ad1a70680c46"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}
    if "parent_item_id" in existing_cols:
        return
    op.add_column("mindbox_items", sa.Column("parent_item_id", sa.String(), nullable=True))
    op.create_index("ix_mindbox_items_parent_item_id", "mindbox_items", ["parent_item_id"])


def downgrade() -> None:
    op.drop_index("ix_mindbox_items_parent_item_id", table_name="mindbox_items")
    op.drop_column("mindbox_items", "parent_item_id")
