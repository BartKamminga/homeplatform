"""dontforget_changelog

Revision ID: b2c3d4e5f6a7
Revises: f3a1b2c4d5e6
Create Date: 2026-06-10

"""
from alembic import op
import uuid
from datetime import datetime

revision = 'b2c3d4e5f6a7'
down_revision = 'f3a1b2c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    now = datetime.utcnow().isoformat()
    entries = [
        ('0.9', 'Taken, routines en formulier verbeteringen',
         'Echte taken uit database met fotos, routines met dag-keuze, geschiedenis pagina, verbeterd formulier met foto en omschrijving zij aan zij.'),
    ]
    for version, title, description in entries:
        op.execute(
            f"INSERT OR IGNORE INTO changelog (id, version, site, title, description, released_at, created_at) "
            f"VALUES ('{uuid.uuid4()}', '{version}', 'dontforget', '{title}', '{description}', "
            f"'2026-06-10T00:00:00', '{now}')"
        )


def downgrade() -> None:
    op.execute("DELETE FROM changelog WHERE site = 'dontforget' AND version IN ('0.1.0', '0.2.0', '0.3.0')")
