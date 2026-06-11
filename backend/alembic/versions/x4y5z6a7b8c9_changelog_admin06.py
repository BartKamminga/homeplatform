"""changelog: admin 0.6 — beheer & links uitgebreid

Revision ID: x4y5z6a7b8c9
Revises: w3x4y5z6a7b8
Create Date: 2026-06-11
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "x4y5z6a7b8c9"
down_revision = "w3x4y5z6a7b8"
branch_labels = None
depends_on = None

ENTRIES = [
    {
        "id": str(uuid.uuid4()),
        "version": "0.6",
        "site": "admin",
        "title": "Beheer & links uitgebreid",
        "description": (
            "Beheer & links pagina toont nu Cloudflare Tunnel en Analytics, "
            "externe URL (webheaven.nl), omgevingsinformatie en twee workflow-secties: "
            "deploy-workflow (hpem.ps1-commando's) en gebruikers-workflow (uitnodiging t/m groepsbeheer)."
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
