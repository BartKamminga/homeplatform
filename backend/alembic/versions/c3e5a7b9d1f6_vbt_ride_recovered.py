"""vbt_rides: recovered (rit na een crash uit het journal hersteld)

Revision ID: c3e5a7b9d1f6
Revises: b2d4f6a8c0e3
Create Date: 2026-10-16

Item 1350: CONTINUE RIDE alleen bij een rit die niet netjes is afgesloten (in_progress of recovered).
Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "c3e5a7b9d1f6"
down_revision = "b2d4f6a8c0e3"
branch_labels = None
depends_on = None


def upgrade():
    cols = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("vbt_rides")]
    if "recovered" not in cols:
        op.add_column("vbt_rides", sa.Column("recovered", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table("vbt_rides") as batch_op:
        batch_op.drop_column("recovered")
