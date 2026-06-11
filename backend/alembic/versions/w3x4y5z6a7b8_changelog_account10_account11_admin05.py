"""changelog: account 1.0 + 1.1 + admin 0.5 + landing 1.1

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-06-11
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "w3x4y5z6a7b8"
down_revision = "v2w3x4y5z6a7"
branch_labels = None
depends_on = None

ENTRIES = [
    {
        "id": str(uuid.uuid4()),
        "version": "1.0",
        "site": "account",
        "title": "Account pagina",
        "description": (
            "Nieuwe account-sectie op /account/. "
            "Profielpagina toont gebruikersnaam en e-mail; wachtwoord wijzigen mogelijk. "
            "Groepenpagina om te schakelen tussen persoonlijk en gedeelde groepen. "
            "Admin kan via Gebruikers een uitnodigingslink genereren (7 dagen geldig, eenmalig). "
            "Uitgenodigde gebruiker registreert via /account/invite/:token en is direct ingelogd."
        ),
        "released_at": "2026-06-11T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "1.1",
        "site": "account",
        "title": "Groepsgerichte uitnodigingen",
        "description": (
            "Uitnodigingslink is nu koppelbaar aan een groep. "
            "De uitgenodigde gebruiker wordt automatisch lid en de groep is meteen actief. "
            "Elk groepslid kan uitnodigen, niet alleen admins. "
            "De uitnodigingspagina toont de naam van de groep waarvoor je bent uitgenodigd."
        ),
        "released_at": "2026-06-11T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "0.5",
        "site": "admin",
        "title": "Groepsgerichte uitnodigingen",
        "description": (
            "Uitnodigingsmodal heeft nu een groepskiezer. "
            "Kies een groep bij het genereren van een link; de nieuwe gebruiker wordt direct lid. "
            "Zonder groepskeuze is een admin-account vereist."
        ),
        "released_at": "2026-06-11T00:00:00",
    },
    {
        "id": str(uuid.uuid4()),
        "version": "1.1",
        "site": "landing",
        "title": "Welkom bij naam + Account-link",
        "description": (
            "Landing pagina toont 'Welkom, {naam}' na inloggen. "
            "Beheer-knop vervangen door Account-knop die naar /account/profile leidt."
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
