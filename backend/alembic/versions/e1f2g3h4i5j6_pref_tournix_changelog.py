"""users: voeg pref_group_tournix toe; changelogs dontforget 1.5, tournix 0.2, fiets 0.2, account 1.3

Revision ID: e1f2g3h4i5j6
Revises: d0e1f2g3h4i5
Create Date: 2026-06-12
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "e1f2g3h4i5j6"
down_revision = "d0e1f2g3h4i5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── pref_group_tournix kolom ──────────────────────────────────────────────
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("pref_group_tournix", sa.String(), nullable=True))

    # ── Changelog entries ─────────────────────────────────────────────────────
    bind = op.get_bind()
    entries = [
        {
            "id": str(uuid.uuid4()),
            "version": "1.5",
            "site": "dontforget",
            "title": "Groepchip in de topbar",
            "description": (
                "Actieve groep zichtbaar als chip in de topbar van Vandaag. "
                "Klik om direct van groep te wisselen zonder naar Instellingen te gaan."
            ),
            "released_at": "2026-06-12T00:00:00",
        },
        {
            "id": str(uuid.uuid4()),
            "version": "0.2",
            "site": "tournix",
            "title": "Groepchip en Account-knop in de header",
            "description": (
                "Actieve groep zichtbaar als chip in de header. "
                "Klik om direct van groep te wisselen. "
                "Account-knop in de header navigeert terug naar Tournix."
            ),
            "released_at": "2026-06-12T00:00:00",
        },
        {
            "id": str(uuid.uuid4()),
            "version": "0.2",
            "site": "fiets",
            "title": "Account-knop met terugnavigatie",
            "description": (
                "Account-knop in de header navigeert terug naar FietsPrognose "
                "na het aanpassen van instellingen."
            ),
            "released_at": "2026-06-12T00:00:00",
        },
        {
            "id": str(uuid.uuid4()),
            "version": "1.3",
            "site": "account",
            "title": "Terugnavigatie voor Tournix en FietsPrognose",
            "description": (
                "Terugknop herkent nu ook Tournix en FietsPrognose. "
                "Na het aanpassen van groepsinstellingen navigeer je terug naar de app waar je vandaan kwam."
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
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("pref_group_tournix")
    bind = op.get_bind()
    bind.execute(sa.text(
        "DELETE FROM changelog WHERE (site = 'dontforget' AND version = '1.5') "
        "OR (site = 'tournix' AND version = '0.2') "
        "OR (site = 'fiets' AND version = '0.2') "
        "OR (site = 'account' AND version = '1.3')"
    ))
