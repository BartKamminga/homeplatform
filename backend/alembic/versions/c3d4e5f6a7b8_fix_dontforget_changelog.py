"""fix_dontforget_changelog

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-10

"""
from alembic import op
import uuid
from datetime import datetime

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    now = datetime.utcnow().isoformat()
    op.execute("DELETE FROM changelog WHERE site = 'dontforget'")
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.9', 'dontforget', "
        f"'Taken, routines en formulier', "
        f"'Echte taken uit database met fotos, routines met dag-keuze, "
        f"geschiedenis pagina, verbeterd formulier met foto en omschrijving zij aan zij.', "
        f"'2026-06-10T00:00:00', '{now}')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM changelog WHERE site = 'dontforget' AND version = '0.9'")
