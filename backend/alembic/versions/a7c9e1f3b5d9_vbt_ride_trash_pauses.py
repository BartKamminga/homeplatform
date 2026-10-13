"""vbt_rides: prullenbak (deleted_at), klok-tijd, pauzes en eventlog per rit

Revision ID: a7c9e1f3b5d9
Revises: f6b8d0a2c4e7
Create Date: 2026-10-13

Item 1292 (geen dataverlies). Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "a7c9e1f3b5d9"
down_revision = "f6b8d0a2c4e7"   # na vbt_profiles.plan_slug (item 1300, andere sessie)
branch_labels = None
depends_on = None

COLUMNS = [
    ("elapsed", lambda: sa.Column("elapsed", sa.Integer(), nullable=False, server_default="0")),
    ("pauses", lambda: sa.Column("pauses", sa.JSON(), nullable=True)),
    ("events", lambda: sa.Column("events", sa.JSON(), nullable=True)),
    ("deleted_at", lambda: sa.Column("deleted_at", sa.DateTime(), nullable=True)),
]


def upgrade():
    cols = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("vbt_rides")]
    for name, make in COLUMNS:
        if name not in cols:
            op.add_column("vbt_rides", make())


def downgrade():
    with op.batch_alter_table("vbt_rides") as batch_op:
        for name, _ in reversed(COLUMNS):
            batch_op.drop_column(name)
