"""vbt_routes: points (coördinaten per sectie) en photos (Mapillary-beelden) voor Real Ride

Revision ID: f0a2c4e6b8d1
Revises: e9f1a3b5c7d0
Create Date: 2026-10-16

Item Real Ride. Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "f0a2c4e6b8d1"
down_revision = "e9f1a3b5c7d0"
branch_labels = None
depends_on = None

COLUMNS = ["points", "photos"]


def upgrade():
    cols = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("vbt_routes")]
    for name in COLUMNS:
        if name not in cols:
            op.add_column("vbt_routes", sa.Column(name, sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("vbt_routes") as batch_op:
        for name in reversed(COLUMNS):
            batch_op.drop_column(name)
