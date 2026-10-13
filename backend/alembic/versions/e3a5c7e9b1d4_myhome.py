"""myhome: huismodel (homes, floors, rooms), apparaten + invoer (sources, notes) - item 1314

Revision ID: e3a5c7e9b1d4
Revises: d2f4a6c8e0b1
Create Date: 2026-10-13

Met has-table-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "e3a5c7e9b1d4"
down_revision = "d2f4a6c8e0b1"
branch_labels = None
depends_on = None


def upgrade():
    tables = sa.inspect(op.get_bind()).get_table_names()
    if "myhome_homes" not in tables:
        op.create_table(
            "myhome_homes",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("garden_orientation", sa.String(), nullable=True),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("meta", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if "myhome_floors" not in tables:
        op.create_table(
            "myhome_floors",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("home_id", sa.String(), sa.ForeignKey("myhome_homes.id"), nullable=False, index=True),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("level", sa.Float(), nullable=False),
            sa.Column("sort", sa.Integer(), nullable=False),
            sa.Column("ha_floor", sa.String(), nullable=True),
            sa.Column("roof", sa.JSON(), nullable=True),
        )
    if "myhome_rooms" not in tables:
        op.create_table(
            "myhome_rooms",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("home_id", sa.String(), sa.ForeignKey("myhome_homes.id"), nullable=False, index=True),
            sa.Column("floor_id", sa.String(), sa.ForeignKey("myhome_floors.id"), nullable=False, index=True),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("polygon", sa.JSON(), nullable=True),
            sa.Column("label_at", sa.JSON(), nullable=True),
            sa.Column("ha_area", sa.String(), nullable=True),
            sa.Column("link_status", sa.String(), nullable=False),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("sort", sa.Integer(), nullable=False),
        )
    if "myhome_sources" not in tables:
        op.create_table(
            "myhome_sources",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("home_id", sa.String(), sa.ForeignKey("myhome_homes.id"), nullable=False, index=True),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("file_path", sa.String(), nullable=False),
            sa.Column("floor_key", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
    if "myhome_notes" not in tables:
        op.create_table(
            "myhome_notes",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("home_id", sa.String(), sa.ForeignKey("myhome_homes.id"), nullable=False, index=True),
            sa.Column("text", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("response", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("resolved_at", sa.DateTime(), nullable=True),
        )
    if "myhome_devices" not in tables:
        op.create_table(
            "myhome_devices",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("home_id", sa.String(), sa.ForeignKey("myhome_homes.id"), nullable=False, index=True),
            sa.Column("room_id", sa.String(), sa.ForeignKey("myhome_rooms.id"), nullable=True, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("source", sa.String(), nullable=False),
            sa.Column("external_id", sa.String(), nullable=True, index=True),
            sa.Column("manufacturer", sa.String(), nullable=True),
            sa.Column("model", sa.String(), nullable=True),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("meta", sa.JSON(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )


def downgrade():
    for table in ("myhome_devices", "myhome_notes", "myhome_sources", "myhome_rooms", "myhome_floors", "myhome_homes"):
        op.drop_table(table)
