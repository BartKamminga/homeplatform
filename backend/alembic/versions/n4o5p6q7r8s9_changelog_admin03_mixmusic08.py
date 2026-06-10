"""changelog: admin 0.3 + mixmusic 0.8

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa
import uuid

revision = "n4o5p6q7r8s9"
down_revision = "m3n4o5p6q7r8"
branch_labels = None
depends_on = None

ENTRIES = [
    {
        "id": str(uuid.uuid4()),
        "version": "0.3",
        "site": "admin",
        "title": "Groepenbeheer & opruiming",
        "description": (
            "Gebruikers en groepen kunnen nu via de admin-UI aan elkaar worden gekoppeld. "
            "Guest-groep ingevoerd als standaard voor nieuwe gebruikers. "
            "Changelog is read-only (beheerd via migraties). "
            "Sites-pagina toont directe link naar elke site."
        ),
        "released_at": "2026-06-10T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "0.8",
        "site": "mixmusic",
        "title": "Nieuwste tracks bovenaan + @eaDir fix",
        "description": (
            "Tracks worden nu gesorteerd op wijzigingsdatum (nieuwste boven). "
            "Synology @eaDir thumbnail-mappen worden gefilterd uit de scan."
        ),
        "released_at": "2026-06-10T00:00:00",
    },
]


def upgrade() -> None:
    bind = op.get_bind()
    for e in ENTRIES:
        bind.execute(
            sa.text(
                "INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
                "VALUES (:id, :version, :site, :title, :description, :released_at, :created_at)"
            ),
            {**e, "created_at": "2026-06-10T00:00:00"},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for e in ENTRIES:
        bind.execute(
            sa.text("DELETE FROM changelog WHERE id = :id"),
            {"id": e["id"]},
        )
