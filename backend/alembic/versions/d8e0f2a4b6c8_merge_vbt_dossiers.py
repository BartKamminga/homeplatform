"""merge: vbt (c3e5a7b9d1f6) en dossiers (c5e7a9b1d3f6) takken weer samen

Revision ID: d8e0f2a4b6c8
Revises: c3e5a7b9d1f6, c5e7a9b1d3f6
Create Date: 2026-10-16

Beide takken hingen aan b2d4f6a8c0e3; zonder deze merge heeft alembic twee heads
en faalt "alembic upgrade head" in de deploy. Geen schemawijziging.
"""

revision = "d8e0f2a4b6c8"
down_revision = ("c3e5a7b9d1f6", "c5e7a9b1d3f6")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
