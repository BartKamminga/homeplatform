"""changelog: nkhockey initieel (6.0-6.2) + mixmusic 0.9

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-06-10
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "o5p6q7r8s9t0"
down_revision = "n4o5p6q7r8s9"
branch_labels = None
depends_on = None

ENTRIES = [
    {
        "id": str(uuid.uuid4()),
        "version": "6.0",
        "site": "nkhockey",
        "title": "Alles op één pagina",
        "description": (
            "Grote herindeling: alle informatie op één pagina zonder tabs. "
            "Poule-cards tonen stand, gespeelde en resterende wedstrijden. "
            "NK fases (Poulefase, HF, Finale) direct zichtbaar onder de poule-cards. "
            "Gespeelde wedstrijden toonbaar via instellingen."
        ),
        "released_at": "2026-05-31T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "6.1",
        "site": "nkhockey",
        "title": "NavFilter + platform themas",
        "description": (
            "Nieuwe NavFilter navigatie met drie scrollbare rijen: competitie, fase en poule. "
            "Multi-select: meerdere poules en NK fases tegelijk selecteren. "
            "Focus mode past de filter automatisch aan op eigen poule en fase. "
            "Thema-keuze verplaatst naar platform-instellingen: Licht, Donker, Minimal, Retro."
        ),
        "released_at": "2026-06-05T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "6.2",
        "site": "nkhockey",
        "title": "Simulaties als pure schakelaar",
        "description": (
            "Simulaties is nu een schakelaar die voorspelknoppen en wedstrijd-klikken aanzet. "
            "Poules en NK Fase zijn onafhankelijke filters zonder overlap. "
            "O16 NK Fase toont altijd KF/HF/Finale in één klik."
        ),
        "released_at": "2026-06-05T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "0.9",
        "site": "mixmusic",
        "title": "Sortering en filtering in de sidebar",
        "description": (
            "Sidebar heeft nu sorteerknopen: nieuwste, naam, beoordeling en hartjes. "
            "Genre-filter als klikbare chips. "
            "Beoordelingsfilter toont alleen tracks met minimaal 5, 7 of 9 sterren. "
            "Hartjes-filter toont alleen tracks met favoriete momenten. "
            "Teller geeft X / totaal aan bij actieve filters."
        ),
        "released_at": "2026-06-10T00:00:00",
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
            {**e, "created_at": "2026-06-10T00:00:00"},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for e in ENTRIES:
        bind.execute(
            sa.text("DELETE FROM changelog WHERE id = :id"),
            {"id": e["id"]},
        )
