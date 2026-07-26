"""tournix_fase_tags: globale fase-tags tabel

Revision ID: pp3qq4rr5ss6
Revises: 7dd4731de3cb
Branch_labels: None
Depends_on: None
"""
from alembic import op


revision = "pp3qq4rr5ss6"
down_revision = "7dd4731de3cb"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS tournix_fase_tags (
            id   TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            "order" INTEGER NOT NULL DEFAULT 0
        )
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS tournix_fase_tags")
