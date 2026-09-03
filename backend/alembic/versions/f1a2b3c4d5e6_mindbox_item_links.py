"""mindbox_item_links: generiek item<->item/case-koppelmechanisme met
link_type, vervangt mindbox_items.case_id (1 case per item -> 0+ cases,
item 1058: "alles is een bestand ... en linken aan de bron met een link type")

Revision ID: f1a2b3c4d5e6
Revises: 7a3c9f2e1b04
Create Date: 2026-09-03
"""
import uuid

import sqlalchemy as sa
from alembic import op

revision = "f1a2b3c4d5e6"
down_revision = "7a3c9f2e1b04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}

    if "mindbox_item_links" not in existing_tables:
        op.create_table(
            "mindbox_item_links",
            sa.Column("id",              sa.String(), nullable=False),
            sa.Column("item_id",         sa.String(), nullable=False),
            sa.Column("link_type",       sa.String(), nullable=False),
            sa.Column("target_item_id",  sa.String(), nullable=True),
            sa.Column("target_case_id",  sa.String(), nullable=True),
            sa.Column("created_at",      sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["item_id"], ["mindbox_items.id"]),
            sa.ForeignKeyConstraint(["target_item_id"], ["mindbox_items.id"]),
            sa.ForeignKeyConstraint(["target_case_id"], ["mindbox_cases.id"]),
        )
        op.create_index("ix_mindbox_item_links_item_id", "mindbox_item_links", ["item_id"])
        op.create_index("ix_mindbox_item_links_link_type", "mindbox_item_links", ["link_type"])
        op.create_index("ix_mindbox_item_links_target_item_id", "mindbox_item_links", ["target_item_id"])
        op.create_index("ix_mindbox_item_links_target_case_id", "mindbox_item_links", ["target_case_id"])

    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}
    if "case_id" in existing_cols:
        # Bestaande enkelvoudige case-koppeling overzetten naar de nieuwe
        # many-to-many-links voordat de kolom verdwijnt.
        links_tbl = sa.table(
            "mindbox_item_links",
            sa.column("id"), sa.column("item_id"), sa.column("link_type"),
            sa.column("target_case_id"), sa.column("created_at"),
        )
        rows = bind.execute(sa.text("SELECT id, case_id, updated_at FROM mindbox_items WHERE case_id IS NOT NULL")).fetchall()
        if rows:
            op.bulk_insert(links_tbl, [
                {
                    "id": str(uuid.uuid4()), "item_id": row[0], "link_type": "case_member",
                    "target_case_id": row[1], "created_at": row[2],
                }
                for row in rows
            ])
        with op.batch_alter_table("mindbox_items") as batch_op:
            batch_op.drop_column("case_id")


def downgrade() -> None:
    bind = op.get_bind()
    with op.batch_alter_table("mindbox_items") as batch_op:
        batch_op.add_column(sa.Column("case_id", sa.String(), nullable=True))
    bind.execute(sa.text(
        "UPDATE mindbox_items SET case_id = ("
        "SELECT target_case_id FROM mindbox_item_links "
        "WHERE mindbox_item_links.item_id = mindbox_items.id AND mindbox_item_links.link_type = 'case_member' "
        "LIMIT 1)"
    ))
    op.drop_table("mindbox_item_links")
