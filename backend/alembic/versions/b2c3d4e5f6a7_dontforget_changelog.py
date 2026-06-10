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
    op.execute(f"""
        INSERT OR IGNORE INTO changelog (id, version, site, title, description, released_at, created_at)
        VALUES ('{uuid.uuid4()}', '0.1.0', 'dontforget', 'Taken en foto\'s',
        'Taken ophalen uit database, foto\'s als thumbnail in het overzicht, taken aanmaken en bewerken met foto-upload.',
        '2026-06-10T00:00:00', '{now}')
    """)
    op.execute(f"""
        INSERT OR IGNORE INTO changelog (id, version, site, title, description, released_at, created_at)
        VALUES ('{uuid.uuid4()}', '0.2.0', 'dontforget', 'Routines en dag-van-de-week',
        'Terugkerende taken (dagelijks, wekelijks, maandelijks). Wekelijkse routines tonen alleen op de ingestelde dag. Overzicht toont foto of herhaal-icoon.',
        '2026-06-10T00:00:00', '{now}')
    """)
    op.execute(f"""
        INSERT OR IGNORE INTO changelog (id, version, site, title, description, released_at, created_at)
        VALUES ('{uuid.uuid4()}', '0.3.0', 'dontforget', 'Geschiedenis en formulier',
        'Geschiedenis pagina met afgeronde taken gegroepeerd per dag. Formulier verbeterd: herhaling bovenaan, contextuele opties per herhalingstype, foto en omschrijving zij aan zij.',
        '2026-06-10T00:00:00', '{now}')
    """)


def downgrade() -> None:
    op.execute("DELETE FROM changelog WHERE site = 'dontforget' AND version IN ('0.1.0', '0.2.0', '0.3.0')")
