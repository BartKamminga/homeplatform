"""core init

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("email", sa.String, nullable=False, unique=True),
        sa.Column("password_hash", sa.String, nullable=False),
        sa.Column("locale", sa.String, nullable=False, server_default="nl"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "groups",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("slug", sa.String, nullable=False, unique=True),
    )
    op.create_index("ix_groups_slug", "groups", ["slug"])

    op.create_table(
        "user_groups",
        sa.Column("user_id", sa.String, sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("group_id", sa.String, sa.ForeignKey("groups.id"), primary_key=True),
        sa.Column("role", sa.String, nullable=False, server_default="member"),
    )

    op.create_table(
        "themes",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("tokens", sa.JSON, nullable=True),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="0"),
    )

    op.create_table(
        "user_preferences",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("user_id", sa.String, sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("theme_id", sa.String, sa.ForeignKey("themes.id"), nullable=True),
        sa.Column("language", sa.String, nullable=False, server_default="nl"),
        sa.Column("extra", sa.JSON, nullable=True),
    )
    op.create_index("ix_user_preferences_user_id", "user_preferences", ["user_id"])

    op.create_table(
        "sites",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("slug", sa.String, nullable=False, unique=True),
        sa.Column("module", sa.String, nullable=False),
        sa.Column("theme_id", sa.String, sa.ForeignKey("themes.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
    )
    op.create_index("ix_sites_slug", "sites", ["slug"])
    op.create_index("ix_sites_module", "sites", ["module"])

    op.create_table(
        "site_access",
        sa.Column("site_id", sa.String, sa.ForeignKey("sites.id"), primary_key=True),
        sa.Column("group_id", sa.String, sa.ForeignKey("groups.id"), primary_key=True),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("user_id", sa.String, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("site", sa.String, nullable=True),
        sa.Column("action", sa.String, nullable=False),
        sa.Column("payload", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Standaard thema en admin groep aanmaken
    op.execute("""
        INSERT INTO themes (id, name, tokens, is_default)
        VALUES ('default-theme', 'Default', '{}', 1)
    """)
    op.execute("""
        INSERT INTO groups (id, name, slug)
        VALUES ('group-admins', 'Admins', 'admins')
    """)
    op.execute("""
        INSERT INTO groups (id, name, slug)
        VALUES ('group-members', 'Members', 'members')
    """)


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("site_access")
    op.drop_table("sites")
    op.drop_table("user_preferences")
    op.drop_table("themes")
    op.drop_table("user_groups")
    op.drop_table("groups")
    op.drop_table("users")
