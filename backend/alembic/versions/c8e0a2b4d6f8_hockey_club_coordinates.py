"""hockey_clubs.latitude/longitude (item 1184)

Centroide van de clubpostcode (PDOK locatieserver), gebruikt om in de
herindelingsprognose per poule de grootste reisafstand te tonen. Gevuld via
POST /api/hockey/clubs/geocode, niet in deze migratie (geen netwerk in
migraties). Kolommen alleen toevoegen als create_all ze nog niet maakte.

Revision ID: c8e0a2b4d6f8
Revises: b4d6f8a0c2e4
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

revision = "c8e0a2b4d6f8"
down_revision = "b4d6f8a0c2e4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("hockey_clubs")]
    for name in ("latitude", "longitude"):
        if name not in columns:
            bind.execute(sa.text(f"ALTER TABLE hockey_clubs ADD COLUMN {name} FLOAT"))


def downgrade():
    op.drop_column("hockey_clubs", "longitude")
    op.drop_column("hockey_clubs", "latitude")
