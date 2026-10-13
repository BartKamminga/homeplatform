"""vbt_rides.in_progress + synced_at: live backup van de rit naar de server tijdens het rijden

Revision ID: e5a7c9e1f3b6
Revises: d4f6b8c0e2a5
Create Date: 2026-10-13

Item 1292. Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "e5a7c9e1f3b6"
down_revision = "d4f6b8c0e2a5"
branch_labels = None
depends_on = None


def upgrade():
    cols = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("vbt_rides")]
    if "in_progress" not in cols:
        op.add_column("vbt_rides", sa.Column("in_progress", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "synced_at" not in cols:
        op.add_column("vbt_rides", sa.Column("synced_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("vbt_rides") as batch_op:
        batch_op.drop_column("synced_at")
        batch_op.drop_column("in_progress")
