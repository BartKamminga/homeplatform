"""mindbox_items: preview_path (item 1068) - automatisch gegenereerde
voorbeeldafbeelding (bv. pagina 1 van een .pdf), los van file_path zodat
een preview geen aparte rij in de bestandenlijst wordt.

Revision ID: d3e4f5a6b7c8
Revises: c9d0e1f2a3b4
Create Date: 2026-09-03
"""
import sqlalchemy as sa
from alembic import op

revision = "d3e4f5a6b7c8"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}
    if "preview_path" in existing_cols:
        return
    op.add_column("mindbox_items", sa.Column("preview_path", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("mindbox_items", "preview_path")
