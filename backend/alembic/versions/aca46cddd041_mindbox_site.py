"""mindbox site + mindbox_cases/mindbox_contexts/mindbox_items/mindbox_responses/mindbox_response_sources tabellen

Revision ID: aca46cddd041
Revises: c974d15e8a21
Create Date: 2026-09-02
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "aca46cddd041"
down_revision = "c974d15e8a21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mindbox_cases",
        sa.Column("id",          sa.String(),   nullable=False),
        sa.Column("user_id",     sa.String(),   nullable=False),
        sa.Column("name",        sa.String(),   nullable=False),
        sa.Column("created_at",  sa.DateTime(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_mindbox_cases_user_id", "mindbox_cases", ["user_id"])

    op.create_table(
        "mindbox_contexts",
        sa.Column("id",          sa.String(),   nullable=False),
        sa.Column("user_id",     sa.String(),   nullable=False),
        sa.Column("name",        sa.String(),   nullable=False),
        sa.Column("content",     sa.String(),   nullable=False),
        sa.Column("created_at",  sa.DateTime(), nullable=False),
        sa.Column("updated_at",  sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_mindbox_contexts_user_id", "mindbox_contexts", ["user_id"])

    op.create_table(
        "mindbox_items",
        sa.Column("id",                 sa.String(),   nullable=False),
        sa.Column("user_id",            sa.String(),   nullable=False),
        sa.Column("original_filename",  sa.String(),   nullable=False),
        sa.Column("file_path",          sa.String(),   nullable=False),
        sa.Column("content_type",       sa.String(),   nullable=True),
        sa.Column("size_bytes",         sa.Integer(),  nullable=False),
        sa.Column("status",             sa.String(),   nullable=False),
        sa.Column("notes",              sa.String(),   nullable=True),
        sa.Column("context_id",         sa.String(),   nullable=True),
        sa.Column("case_id",            sa.String(),   nullable=True),
        sa.Column("created_at",         sa.DateTime(), nullable=False),
        sa.Column("updated_at",         sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["context_id"], ["mindbox_contexts.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["mindbox_cases.id"]),
    )
    op.create_index("ix_mindbox_items_user_id", "mindbox_items", ["user_id"])

    op.create_table(
        "mindbox_responses",
        sa.Column("id",                  sa.String(),   nullable=False),
        sa.Column("user_id",             sa.String(),   nullable=False),
        sa.Column("content",             sa.String(),   nullable=False),
        sa.Column("parent_response_id",  sa.String(),   nullable=True),
        sa.Column("case_id",             sa.String(),   nullable=True),
        sa.Column("created_at",          sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["parent_response_id"], ["mindbox_responses.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["mindbox_cases.id"]),
    )
    op.create_index("ix_mindbox_responses_user_id", "mindbox_responses", ["user_id"])

    op.create_table(
        "mindbox_response_sources",
        sa.Column("response_id", sa.String(), nullable=False),
        sa.Column("item_id",     sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("response_id", "item_id"),
        sa.ForeignKeyConstraint(["response_id"], ["mindbox_responses.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["mindbox_items.id"]),
    )

    op.create_table(
        "mindbox_case_events",
        sa.Column("id",           sa.String(),   nullable=False),
        sa.Column("case_id",      sa.String(),   nullable=False),
        sa.Column("user_id",      sa.String(),   nullable=False),
        sa.Column("event_type",   sa.String(),   nullable=False),
        sa.Column("description",  sa.String(),   nullable=False),
        sa.Column("created_at",   sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["mindbox_cases.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_mindbox_case_events_case_id", "mindbox_case_events", ["case_id"])

    bind = op.get_bind()
    existing = bind.execute(
        sa.text("SELECT id FROM sites WHERE slug = 'mindbox'")
    ).fetchone()
    if not existing:
        bind.execute(
            sa.text(
                "INSERT INTO sites (id, name, slug, module, is_active, icon, created_at) "
                "VALUES (:id, :name, :slug, :module, :is_active, :icon, :created_at)"
            ),
            {
                "id": str(uuid.uuid4()), "name": "Mindbox",
                "slug": "mindbox", "module": "mindbox",
                "is_active": True, "icon": "\U0001F9E0",
                "created_at": "2026-09-02T00:00:00",
            },
        )


def downgrade() -> None:
    op.drop_index("ix_mindbox_case_events_case_id", table_name="mindbox_case_events")
    op.drop_table("mindbox_case_events")
    op.drop_table("mindbox_response_sources")
    op.drop_index("ix_mindbox_responses_user_id", table_name="mindbox_responses")
    op.drop_table("mindbox_responses")
    op.drop_index("ix_mindbox_items_user_id", table_name="mindbox_items")
    op.drop_table("mindbox_items")
    op.drop_index("ix_mindbox_contexts_user_id", table_name="mindbox_contexts")
    op.drop_table("mindbox_contexts")
    op.drop_index("ix_mindbox_cases_user_id", table_name="mindbox_cases")
    op.drop_table("mindbox_cases")
    op.execute(sa.text("DELETE FROM sites WHERE slug = 'mindbox'"))
