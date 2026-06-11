"""changelog: mixmusic 1.0 (speelteller + UI) + admin 0.4 (dashboard)

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-06-11
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "t0u1v2w3x4y5"
down_revision = "s9t0u1v2w3x4"
branch_labels = None
depends_on = None

ENTRIES = [
    {
        "id": str(uuid.uuid4()),
        "version": "1.0",
        "site": "mixmusic",
        "title": "Afspeelteller en verbeterd detailpaneel",
        "description": (
            "Afspeelteller per nummer wordt bijgehouden per groep. "
            "Zichtbaar in de tracklijst en rechts in het detailpaneel. "
            "Sorteer op meest afgespeeld via de driehoek-knop in de sidebar. "
            "Detailpaneel: favoriete momenten staat nu boven de tijdstip-selector. "
            "Duidelijke hartjesknop toont de actuele afspeelpositie voor snel markeren."
        ),
        "released_at": "2026-06-11T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "0.4",
        "site": "admin",
        "title": "Dashboard, landing retry en GlitchTip fix",
        "description": (
            "Dashboard toont nu statistiekkaarten, recente activiteit en snelkoppelingen. "
            "Landing herlaadt automatisch bij verbindingsproblemen (max 10 keer, met voortgangsbalk). "
            "GlitchTip-link in monitoring bevat nu het juiste poortnummer."
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
