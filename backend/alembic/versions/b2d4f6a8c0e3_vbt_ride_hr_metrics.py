"""vbt_rides: hr_metrics (EF, aerobic decoupling, HR/W-fit per rit)

Revision ID: b2d4f6a8c0e3
Revises: f1a3c5e7b9d2
Create Date: 2026-10-15

Item 1351. Bestaande ritten worden lui aangevuld bij het ophalen van de lijst (routers/vbt.py).
Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "b2d4f6a8c0e3"
down_revision = "f1a3c5e7b9d2"
branch_labels = None
depends_on = None


def upgrade():
    cols = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("vbt_rides")]
    if "hr_metrics" not in cols:
        op.add_column("vbt_rides", sa.Column("hr_metrics", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("vbt_rides") as batch_op:
        batch_op.drop_column("hr_metrics")
