"""agent-control site registratie

Revision ID: 4aa1882f476d
Revises: f6g7h8i9j0k1
Create Date: 2026-08-23
"""
import uuid
from alembic import op

revision = "4aa1882f476d"
down_revision = "f6g7h8i9j0k1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "INSERT OR IGNORE INTO sites (id, name, slug, module, icon, is_active, created_at) "
        "VALUES ("
        f"'{uuid.uuid4()}', "
        "'Agent Control', 'agent-control', 'agent-control', "
        "'🤖', 1, datetime('now'))"
    )


def downgrade() -> None:
    op.execute("DELETE FROM sites WHERE slug = 'agent-control'")
