"""mindbox_items.parsed_text toevoegen - geextraheerde platte tekst van het bestand (item 1051)

Revision ID: ad1a70680c46
Revises: 6559f650dd63
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "ad1a70680c46"
down_revision = "6559f650dd63"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}
    if "parsed_text" in existing_cols:
        return
    op.add_column("mindbox_items", sa.Column("parsed_text", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("mindbox_items", "parsed_text")
