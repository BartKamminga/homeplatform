"""fix club city data: Victoria, AthenA, Amsterdam, Gooische

Revision ID: m9n0o1p2q3r4
Revises: l8m9n0o1p2q3
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = "m9n0o1p2q3r4"
down_revision = "l8m9n0o1p2q3"
branch_labels = None
depends_on = None

FIXES = [
    ("Victoria",  "Rotterdam"),
    ("AthenA",    "Amsterdam"),
    ("Amsterdam", "Amsterdam"),
    ("Gooische",  "Hilversum"),
]


def upgrade():
    for name, city in FIXES:
        op.execute(
            sa.text("UPDATE tournix_clubs SET city = :city WHERE name = :name").bindparams(city=city, name=name)
        )


def downgrade():
    pass
