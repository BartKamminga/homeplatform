"""hockey-inside site registratie

Revision ID: b9c0d1e2f3g4
Revises: a8b9c0d1e2f3
Create Date: 2026-08-12
"""
import uuid
from alembic import op

revision = "b9c0d1e2f3g4"
down_revision = "a8b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "INSERT OR IGNORE INTO sites (id, name, slug, module, icon, is_active, created_at) "
        "VALUES ("
        f"'{uuid.uuid4()}', "
        "'Hockey Inside', 'hockey-inside', 'hockey-inside', "
        "'🏒', 1, datetime('now'))"
    )


def downgrade() -> None:
    op.execute("DELETE FROM sites WHERE slug = 'hockey-inside'")
