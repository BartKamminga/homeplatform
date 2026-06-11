"""changelog: dontforget 1.1 (groepstaken + herhaaltaken) + mixmusic 0.8 (groepsdata)

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-06-11
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "r8s9t0u1v2w3"
down_revision = "q7r8s9t0u1v2"
branch_labels = None
depends_on = None

ENTRIES = [
    {
        "id": str(uuid.uuid4()),
        "version": "1.1",
        "site": "dontforget",
        "title": "Groepstaken en terugkerende taken",
        "description": (
            "Taken per groep: elke groep heeft een eigen takenlijst, persoonlijk blijft apart. "
            "Groepswisselaar in Instellingen onder Huishouden. "
            "Ledenantal van de actieve groep zichtbaar bij Leden. "
            "Herhaaltaken verschijnen automatisch opnieuw na hun periode (dag, week of maand)."
        ),
        "released_at": "2026-06-11T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "0.8",
        "site": "mixmusic",
        "title": "Muziekdata per groep",
        "description": (
            "Beoordelingen, genres en hartjes zijn nu groepspecifiek. "
            "Wissel van groep in instellingen en de data past zich direct aan. "
            "Persoonlijke data blijft gescheiden van groepsdata."
        ),
        "released_at": "2026-06-11T00:00:00",
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
            {**e, "created_at": "2026-06-11T00:00:00"},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for e in ENTRIES:
        bind.execute(
            sa.text("DELETE FROM changelog WHERE id = :id"),
            {"id": e["id"]},
        )
