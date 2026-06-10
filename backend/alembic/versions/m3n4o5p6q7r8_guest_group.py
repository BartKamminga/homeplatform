"""guest groep aanmaken als standaard voor nieuwe gebruikers

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa
import uuid

revision = "m3n4o5p6q7r8"
down_revision = "l2m3n4o5p6q7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(
        sa.text("SELECT id FROM groups WHERE slug = 'guest'")
    ).fetchone()
    if not existing:
        bind.execute(
            sa.text(
                "INSERT INTO groups (id, name, slug) VALUES (:id, :name, :slug)"
            ),
            {"id": str(uuid.uuid4()), "name": "Guest", "slug": "guest"},
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM groups WHERE slug = 'guest'"))
