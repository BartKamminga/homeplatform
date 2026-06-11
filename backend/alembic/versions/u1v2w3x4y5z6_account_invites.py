"""account site + invite_tokens tabel

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Create Date: 2026-06-11
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "u1v2w3x4y5z6"
down_revision = "t0u1v2w3x4y5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invite_tokens",
        sa.Column("id",               sa.String(),   nullable=False),
        sa.Column("token",            sa.String(),   nullable=False),
        sa.Column("created_by",       sa.String(),   nullable=False),
        sa.Column("expires_at",       sa.DateTime(), nullable=False),
        sa.Column("used_at",          sa.DateTime(), nullable=True),
        sa.Column("used_by_user_id",  sa.String(),   nullable=True),
        sa.Column("created_at",       sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_invite_tokens_token", "invite_tokens", ["token"])

    bind = op.get_bind()
    existing = bind.execute(
        sa.text("SELECT id FROM sites WHERE slug = 'account'")
    ).fetchone()
    if not existing:
        bind.execute(
            sa.text(
                "INSERT INTO sites (id, name, slug, module, is_active, icon, created_at) "
                "VALUES (:id, :name, :slug, :module, :is_active, :icon, :created_at)"
            ),
            {
                "id": str(uuid.uuid4()), "name": "Mijn account",
                "slug": "account", "module": "account",
                "is_active": True, "icon": "👤",
                "created_at": "2026-06-11T00:00:00",
            },
        )


def downgrade() -> None:
    op.drop_index("ix_invite_tokens_token", table_name="invite_tokens")
    op.drop_table("invite_tokens")
    op.execute(sa.text("DELETE FROM sites WHERE slug = 'account'"))
