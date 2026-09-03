"""MindboxResponse -> MindboxItem (kind="response"), MindboxResponseSource/
parent_response_id -> MindboxItemLink ("source_of"/"reply_to") - item 1058,
increment 2: "alles is een bestand"

Revision ID: b7c8d9e0f1a2
Revises: f1a2b3c4d5e6
Create Date: 2026-09-03
"""
import uuid

import sqlalchemy as sa
from alembic import op

revision = "b7c8d9e0f1a2"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}

    with op.batch_alter_table("mindbox_items") as batch_op:
        if "kind" not in existing_cols:
            batch_op.add_column(sa.Column("kind", sa.String(), nullable=False, server_default="upload"))
        if "text_content" not in existing_cols:
            batch_op.add_column(sa.Column("text_content", sa.String(), nullable=True))

    if "mindbox_responses" not in existing_tables:
        return  # al gemigreerd (bv. opnieuw draaien na create_db_and_tables())

    items_tbl = sa.table(
        "mindbox_items",
        sa.column("id"), sa.column("user_id"), sa.column("original_filename"), sa.column("file_path"),
        sa.column("content_type"), sa.column("size_bytes"), sa.column("status"), sa.column("kind"),
        sa.column("text_content"), sa.column("created_at"), sa.column("updated_at"),
    )
    links_tbl = sa.table(
        "mindbox_item_links",
        sa.column("id"), sa.column("item_id"), sa.column("link_type"),
        sa.column("target_item_id"), sa.column("target_case_id"), sa.column("created_at"),
    )

    responses = bind.execute(sa.text(
        "SELECT id, user_id, content, parent_response_id, case_id, created_at FROM mindbox_responses"
    )).fetchall()

    # Response-id blijft het item-id (referentiele stabiliteit - o.a.
    # audit-log payloads met response_id) - file_path blijft leeg tot de
    # eerste edit (lazy materialisatie, met Bart afgestemd: acceptabel voor
    # het huidige lage aantal responses).
    item_rows = [
        {
            "id": r[0], "user_id": r[1], "original_filename": f"response-{r[0]}.eml", "file_path": "",
            "content_type": "message/rfc822", "size_bytes": 0, "status": "new", "kind": "response",
            "text_content": r[2], "created_at": r[5], "updated_at": r[5],
        }
        for r in responses
    ]
    if item_rows:
        op.bulk_insert(items_tbl, item_rows)

    link_rows = []
    for r in responses:
        resp_id, _user_id, _content, parent_response_id, case_id, created_at = r
        link_rows.append({
            "id": str(uuid.uuid4()), "item_id": resp_id, "link_type": "case_member",
            "target_item_id": None, "target_case_id": case_id, "created_at": created_at,
        })
        if parent_response_id:
            link_rows.append({
                "id": str(uuid.uuid4()), "item_id": resp_id, "link_type": "reply_to",
                "target_item_id": parent_response_id, "target_case_id": None, "created_at": created_at,
            })
    sources = bind.execute(sa.text("SELECT response_id, item_id FROM mindbox_response_sources")).fetchall()
    for response_id, item_id in sources:
        link_rows.append({
            "id": str(uuid.uuid4()), "item_id": response_id, "link_type": "source_of",
            "target_item_id": item_id, "target_case_id": None, "created_at": None,
        })
    if link_rows:
        # created_at is NOT NULL op mindbox_item_links - source_of-links hebben
        # geen bronrij met een timestamp, dus die op "nu" zetten.
        now = bind.execute(sa.text("SELECT CURRENT_TIMESTAMP")).scalar()
        for row in link_rows:
            if row["created_at"] is None:
                row["created_at"] = now
        op.bulk_insert(links_tbl, link_rows)

    op.drop_table("mindbox_response_sources")
    op.drop_table("mindbox_responses")


def downgrade() -> None:
    bind = op.get_bind()
    op.create_table(
        "mindbox_responses",
        sa.Column("id",                  sa.String(), nullable=False),
        sa.Column("user_id",             sa.String(), nullable=False),
        sa.Column("content",             sa.String(), nullable=False),
        sa.Column("parent_response_id",  sa.String(), nullable=True),
        sa.Column("case_id",             sa.String(), nullable=False),
        sa.Column("created_at",          sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["parent_response_id"], ["mindbox_responses.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["mindbox_cases.id"]),
    )
    op.create_table(
        "mindbox_response_sources",
        sa.Column("response_id",  sa.String(), nullable=False),
        sa.Column("item_id",      sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("response_id", "item_id"),
        sa.ForeignKeyConstraint(["response_id"], ["mindbox_responses.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["mindbox_items.id"]),
    )

    responses_tbl = sa.table(
        "mindbox_responses",
        sa.column("id"), sa.column("user_id"), sa.column("content"),
        sa.column("parent_response_id"), sa.column("case_id"), sa.column("created_at"),
    )
    sources_tbl = sa.table("mindbox_response_sources", sa.column("response_id"), sa.column("item_id"))

    items = bind.execute(sa.text(
        "SELECT id, user_id, text_content, created_at FROM mindbox_items WHERE kind = 'response'"
    )).fetchall()
    response_rows = []
    for item_id, user_id, text_content, created_at in items:
        case_row = bind.execute(sa.text(
            "SELECT target_case_id FROM mindbox_item_links WHERE item_id = :id AND link_type = 'case_member' LIMIT 1"
        ), {"id": item_id}).fetchone()
        reply_row = bind.execute(sa.text(
            "SELECT target_item_id FROM mindbox_item_links WHERE item_id = :id AND link_type = 'reply_to' LIMIT 1"
        ), {"id": item_id}).fetchone()
        response_rows.append({
            "id": item_id, "user_id": user_id, "content": text_content or "",
            "parent_response_id": reply_row[0] if reply_row else None,
            "case_id": case_row[0] if case_row else None, "created_at": created_at,
        })
    if response_rows:
        op.bulk_insert(responses_tbl, response_rows)

        source_rows = []
        for item_id, *_ in items:
            for (target_item_id,) in bind.execute(sa.text(
                "SELECT target_item_id FROM mindbox_item_links WHERE item_id = :id AND link_type = 'source_of'"
            ), {"id": item_id}).fetchall():
                source_rows.append({"response_id": item_id, "item_id": target_item_id})
        if source_rows:
            op.bulk_insert(sources_tbl, source_rows)

        for rid in (r["id"] for r in response_rows):
            bind.execute(sa.text("DELETE FROM mindbox_item_links WHERE item_id = :id"), {"id": rid})
            bind.execute(sa.text("DELETE FROM mindbox_items WHERE id = :id"), {"id": rid})

    with op.batch_alter_table("mindbox_items") as batch_op:
        batch_op.drop_column("text_content")
        batch_op.drop_column("kind")
