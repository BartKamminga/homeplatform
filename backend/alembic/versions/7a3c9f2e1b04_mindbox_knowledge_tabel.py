"""mindbox_knowledge tabel (generieke, cross-case kennis-/reference-info,
los van MindboxContext (persona) en MindboxContact (persoon))

Revision ID: 7a3c9f2e1b04
Revises: 5b8d2a9f1c3e
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "7a3c9f2e1b04"
down_revision = "5b8d2a9f1c3e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
    if "mindbox_knowledge" not in existing_tables:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en heeft de tabel dan al aangemaakt.
        op.create_table(
            "mindbox_knowledge",
            sa.Column("id",         sa.String(),   nullable=False),
            sa.Column("user_id",    sa.String(),   nullable=False),
            sa.Column("name",       sa.String(),   nullable=False),
            sa.Column("content",    sa.String(),   nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        )
        op.create_index("ix_mindbox_knowledge_user_id", "mindbox_knowledge", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_mindbox_knowledge_user_id", table_name="mindbox_knowledge")
    op.drop_table("mindbox_knowledge")
