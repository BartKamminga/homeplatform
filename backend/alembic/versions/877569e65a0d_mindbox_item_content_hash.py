"""mindbox_items.content_hash toevoegen - duplicaatdetectie bij upload (item 1051)

Revision ID: 877569e65a0d
Revises: 8c893b44b86a
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "877569e65a0d"
down_revision = "8c893b44b86a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}
    if "content_hash" in existing_cols:
        # create_db_and_tables() (SQLModel create_all) maakt alleen ONTBREKENDE
        # tabellen aan, geen kolommen op bestaande tabellen - deze guard is hier
        # dus alleen voor het geval de migratie per ongeluk dubbel draait.
        return
    op.add_column("mindbox_items", sa.Column("content_hash", sa.String(), nullable=True))
    op.create_index("ix_mindbox_items_content_hash", "mindbox_items", ["content_hash"])


def downgrade() -> None:
    op.drop_index("ix_mindbox_items_content_hash", table_name="mindbox_items")
    op.drop_column("mindbox_items", "content_hash")
