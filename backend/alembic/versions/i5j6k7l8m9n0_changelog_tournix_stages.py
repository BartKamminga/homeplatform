"""changelog: tournix 0.3 stages en tijdreizen

Revision ID: i5j6k7l8m9n0
Revises: h4i5j6k7l8m9
Create Date: 2026-06-12
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "i5j6k7l8m9n0"
down_revision = "h4i5j6k7l8m9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    entry = {
        "id": str(uuid.uuid4()),
        "version": "0.3",
        "site": "tournix",
        "title": "Stages en tijdreizen",
        "description": (
            "Schakel tussen Inregel, Test en Productie. "
            "In Test-modus simuleer je scores lokaal zonder op te slaan. "
            "Sla rondes op als snapshot en bekijk hoe de stand er na elke ronde uitzag."
        ),
        "released_at": "2026-06-12T00:00:00",
    }
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
        "DELETE FROM changelog WHERE site = 'tournix' AND version = '0.3'"
    ))
