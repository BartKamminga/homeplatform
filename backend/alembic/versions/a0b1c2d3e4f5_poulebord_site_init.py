"""poulebord site registratie

Revision ID: a0b1c2d3e4f5
Revises: z5a6b7c8d9e0
Create Date: 2026-07-02
"""
import uuid
from alembic import op

revision = "a0b1c2d3e4f5"
down_revision = "z5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "INSERT OR IGNORE INTO sites (id, name, slug, module, icon, is_active, created_at) "
        "VALUES ("
        f"'{uuid.uuid4()}', "
        "'Poulebord', 'poulebord', 'poulebord', "
        "'🏒', 1, datetime('now'))"
    )


def downgrade() -> None:
    op.execute("DELETE FROM sites WHERE slug = 'poulebord'")
