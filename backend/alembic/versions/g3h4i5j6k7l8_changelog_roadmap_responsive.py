"""changelog: roadmap pagina, responsive design, CSS platform-integratie

Revision ID: g3h4i5j6k7l8
Revises: f2g3h4i5j6k7
Create Date: 2026-06-12
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "g3h4i5j6k7l8"
down_revision = "f2g3h4i5j6k7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    entries = [
        {
            "id": str(uuid.uuid4()),
            "version": "0.7",
            "site": "admin",
            "title": "Roadmap en mobiele navigatie",
            "description": (
                "Nieuwe Roadmap-pagina voor feature-beheer per site — "
                "maak items aan, stel prioriteit en status in, voeg Claude-context toe. "
                "Sidebar inklapbaar op mobiel via hamburger-menu."
            ),
            "released_at": "2026-06-12T00:00:00",
        },
        {
            "id": str(uuid.uuid4()),
            "version": "1.6",
            "site": "dontforget",
            "title": "Bredere weergave op tablet en desktop",
            "description": (
                "Layout schaalt nu mee: tot 720px op tablet en desktop "
                "(voorheen vast op 480px). Op mobiel ongewijzigd."
            ),
            "released_at": "2026-06-12T00:00:00",
        },
        {
            "id": str(uuid.uuid4()),
            "version": "1.2",
            "site": "landing",
            "title": "Responsive app-kaarten",
            "description": (
                "App-kaarten passen zich aan aan de schermgrootte: "
                "2 kolommen op mobiel, 1 kolom op smal mobiel."
            ),
            "released_at": "2026-06-12T00:00:00",
        },
    ]
    for entry in entries:
        existing = bind.execute(
            sa.text("SELECT id FROM changelog WHERE site = :site AND version = :ver"),
            {"site": entry["site"], "ver": entry["version"]},
        ).fetchone()
        if not existing:
            bind.execute(
                sa.text(
                    "INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
                    "VALUES (:id, :version, :site, :title, :description, :released_at, :created_at)"
                ),
                {**entry, "created_at": "2026-06-12T00:00:00"},
            )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "DELETE FROM changelog WHERE "
        "(site = 'admin' AND version = '0.7') OR "
        "(site = 'dontforget' AND version = '1.6') OR "
        "(site = 'landing' AND version = '1.2')"
    ))
