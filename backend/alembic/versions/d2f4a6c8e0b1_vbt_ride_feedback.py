"""vbt_rides: feedback na de rit - rpe (hoe zwaar, 1-10) en readiness (fresh/ok/tired/wrecked)

Revision ID: d2f4a6c8e0b1
Revises: c9e1a3b5d7f2
Create Date: 2026-10-13

Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "d2f4a6c8e0b1"
down_revision = "c9e1a3b5d7f2"
branch_labels = None
depends_on = None


def upgrade():
    cols = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("vbt_rides")]
    if "rpe" not in cols:
        op.add_column("vbt_rides", sa.Column("rpe", sa.Integer(), nullable=True))
    if "readiness" not in cols:
        op.add_column("vbt_rides", sa.Column("readiness", sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("vbt_rides") as batch_op:
        batch_op.drop_column("readiness")
        batch_op.drop_column("rpe")
