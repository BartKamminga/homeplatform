"""changelog: dontforget 1.4 + mixmusic 1.2 — instellingen gesynchroniseerd

Revision ID: c9d0e1f2g3h4
Revises: b8c9d0e1f2g3
Create Date: 2026-06-12
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "c9d0e1f2g3h4"
down_revision = "b8c9d0e1f2g3"
branch_labels = None
depends_on = None

ENTRIES = [
    {
        "id": str(uuid.uuid4()),
        "version": "1.4",
        "site": "dontforget",
        "title": "Instellingen gesynchroniseerd",
        "description": (
            "Standaard moment, herhaling, foto verplicht en geschiedenis bewaren "
            "worden nu opgeslagen in je account. "
            "Instellingen zijn zichtbaar op elk apparaat en elke browser."
        ),
        "released_at": "2026-06-12T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "1.2",
        "site": "mixmusic",
        "title": "Layout gesynchroniseerd",
        "description": (
            "De gekozen desktop- en mobiel-layout worden opgeslagen in je account. "
            "Layout is nu hetzelfde op elk apparaat en elke browser."
        ),
        "released_at": "2026-06-12T00:00:00",
    },
]


def upgrade() -> None:
    bind = op.get_bind()
    for e in ENTRIES:
        existing = bind.execute(
            sa.text("SELECT id FROM changelog WHERE site = :site AND version = :ver"),
            {"site": e["site"], "ver": e["version"]},
        ).fetchone()
        if existing:
            continue
        bind.execute(
            sa.text(
                "INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
                "VALUES (:id, :version, :site, :title, :description, :released_at, :created_at)"
            ),
            {**e, "created_at": "2026-06-12T00:00:00"},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for e in ENTRIES:
        bind.execute(
            sa.text("DELETE FROM changelog WHERE id = :id"),
            {"id": e["id"]},
        )
