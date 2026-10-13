"""vbt_rides.client_id: id uit de browser, zodat een herhaalde upload (outbox) geen dubbele rit geeft

Revision ID: d4f6b8c0e2a5
Revises: c3e5a7b9d1f4
Create Date: 2026-10-13

Item 1292. Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "d4f6b8c0e2a5"
down_revision = "c3e5a7b9d1f4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "client_id" not in [c["name"] for c in insp.get_columns("vbt_rides")]:
        op.add_column("vbt_rides", sa.Column("client_id", sa.String(), nullable=True))
    if "ix_vbt_rides_client_id" not in [i["name"] for i in insp.get_indexes("vbt_rides")]:
        op.create_index("ix_vbt_rides_client_id", "vbt_rides", ["client_id"], unique=True)


def downgrade():
    op.drop_index("ix_vbt_rides_client_id", table_name="vbt_rides")
    with op.batch_alter_table("vbt_rides") as batch_op:
        batch_op.drop_column("client_id")
