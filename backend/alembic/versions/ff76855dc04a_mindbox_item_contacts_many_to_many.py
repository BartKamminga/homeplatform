"""mindbox_items.contact_id -> many-to-many mindbox_item_contacts (item 1052: meerdere deelnemers per mail)

Revision ID: ff76855dc04a
Revises: 163f814f484d
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "ff76855dc04a"
down_revision = "163f814f484d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
    if "mindbox_item_contacts" not in existing_tables:
        op.create_table(
            "mindbox_item_contacts",
            sa.Column("item_id",     sa.String(), nullable=False),
            sa.Column("contact_id",  sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("item_id", "contact_id"),
            sa.ForeignKeyConstraint(["item_id"], ["mindbox_items.id"]),
            sa.ForeignKeyConstraint(["contact_id"], ["mindbox_contacts.id"]),
        )

    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}
    if "contact_id" in existing_cols:
        # Best-effort overzetten van de bestaande enkelvoudige koppeling naar
        # de nieuwe many-to-many-tabel voordat de kolom verdwijnt.
        bind.execute(sa.text(
            "INSERT INTO mindbox_item_contacts (item_id, contact_id) "
            "SELECT id, contact_id FROM mindbox_items WHERE contact_id IS NOT NULL"
        ))
        with op.batch_alter_table("mindbox_items") as batch_op:
            batch_op.drop_column("contact_id")


def downgrade() -> None:
    with op.batch_alter_table("mindbox_items") as batch_op:
        batch_op.add_column(sa.Column("contact_id", sa.String(), nullable=True))
    op.drop_table("mindbox_item_contacts")
