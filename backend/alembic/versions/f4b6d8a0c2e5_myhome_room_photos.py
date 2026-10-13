"""myhome: foto's per ruimte (sources.room_id) en uiterlijk per ruimte (rooms.meta) - item 1318

Revision ID: f4b6d8a0c2e5
Revises: e3a5c7e9b1d4
Create Date: 2026-10-13

Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "f4b6d8a0c2e5"
down_revision = "e3a5c7e9b1d4"
branch_labels = None
depends_on = None


def upgrade():
    insp = sa.inspect(op.get_bind())
    if "room_id" not in [c["name"] for c in insp.get_columns("myhome_sources")]:
        op.add_column("myhome_sources", sa.Column("room_id", sa.String(), nullable=True))
    if "meta" not in [c["name"] for c in insp.get_columns("myhome_rooms")]:
        op.add_column("myhome_rooms", sa.Column("meta", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("myhome_rooms") as batch_op:
        batch_op.drop_column("meta")
    with op.batch_alter_table("myhome_sources") as batch_op:
        batch_op.drop_column("room_id")
