"""vbt_rides: recovered (rit na een crash uit het journal hersteld) en review (workout-score met uitleg)

Revision ID: c3e5a7b9d1f6
Revises: b2d4f6a8c0e3
Create Date: 2026-10-16

Item 1350: CONTINUE RIDE alleen bij een rit die niet netjes is afgesloten (in_progress of recovered).
Item 1307: review = {score, power, cadence, tips} van een workout.
Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "c3e5a7b9d1f6"
down_revision = "b2d4f6a8c0e3"
branch_labels = None
depends_on = None

COLUMNS = [
    ("recovered", lambda: sa.Column("recovered", sa.Boolean(), nullable=False, server_default=sa.false())),
    ("review", lambda: sa.Column("review", sa.JSON(), nullable=True)),
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
