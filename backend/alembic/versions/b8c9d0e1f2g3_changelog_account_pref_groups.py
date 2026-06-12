"""changelog: account 1.2 + dontforget 1.3 + mixmusic 1.1

Revision ID: b8c9d0e1f2g3
Revises: a7b8c9d0e1f2
Create Date: 2026-06-12
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "b8c9d0e1f2g3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None

ENTRIES = [
    {
        "id": str(uuid.uuid4()),
        "version": "1.2",
        "site": "account",
        "title": "Voorkeurs-groep per app",
        "description": (
            "Stel per app in welke groep je wilt gebruiken voor DontForget en MixMusic. "
            "Ga naar Account - Groepen en kies onder App voorkeuren de gewenste groep. "
            "De instellingen voor DontForget zijn verplaatst naar de Account-site."
        ),
        "released_at": "2026-06-12T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "1.3",
        "site": "dontforget",
        "title": "Instellingen verplaatst naar Account",
        "description": (
            "Profiel en groepsinstellingen zijn verplaatst naar de Account-site. "
            "DontForget gebruikt nu de voorkeurs-groep die je instelt in Account - Groepen. "
            "Instellingen bevat een directe link naar Account."
        ),
        "released_at": "2026-06-12T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "1.1",
        "site": "mixmusic",
        "title": "Voorkeurs-groep via Account",
        "description": (
            "Muziekdata gebruikt nu de voorkeurs-groep die je instelt in Account - Groepen. "
            "MixMusic en DontForget kunnen elk een eigen groep gebruiken, onafhankelijk van elkaar."
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
