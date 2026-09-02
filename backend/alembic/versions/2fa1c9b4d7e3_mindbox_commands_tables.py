"""mindbox_commands + mindbox_command_steps tabellen (item 1053: backend-
gedreven command-catalogus, MindBox.ps1 blijft dun via -Explain)

Revision ID: 2fa1c9b4d7e3
Revises: ff76855dc04a
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "2fa1c9b4d7e3"
down_revision = "ff76855dc04a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}

    if "mindbox_commands" not in existing_tables:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en heeft de tabel dan al aangemaakt.
        op.create_table(
            "mindbox_commands",
            sa.Column("id",                 sa.String(),   nullable=False),
            sa.Column("user_id",            sa.String(),   nullable=False),
            sa.Column("entity",             sa.String(),   nullable=True),
            sa.Column("action",             sa.String(),   nullable=False),
            sa.Column("notation_key",       sa.String(),   nullable=False),
            sa.Column("param_kind",         sa.String(),   nullable=False, server_default="none"),
            sa.Column("notation_template",  sa.String(),   nullable=False),
            sa.Column("icon",               sa.String(),   nullable=False, server_default="⚙️"),
            sa.Column("description",        sa.String(),   nullable=True),
            sa.Column("created_at",         sa.DateTime(), nullable=False),
            sa.Column("updated_at",         sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        )
        op.create_index("ix_mindbox_commands_user_id", "mindbox_commands", ["user_id"])
        # Uniek per user - resolve_command() zoekt altijd op (user_id, notation_key)
        # samen, en dit voorkomt dubbele commando's met dezelfde notatie.
        op.create_index(
            "ux_mindbox_commands_user_notation", "mindbox_commands",
            ["user_id", "notation_key"], unique=True,
        )

    if "mindbox_command_steps" not in existing_tables:
        op.create_table(
            "mindbox_command_steps",
            sa.Column("id",           sa.String(),  nullable=False),
            sa.Column("command_id",   sa.String(),  nullable=False),
            sa.Column("position",     sa.Integer(), nullable=False),
            sa.Column("kind",         sa.String(),  nullable=False),
            sa.Column("action_key",   sa.String(),  nullable=True),
            sa.Column("instruction",  sa.String(),  nullable=False),
            sa.Column("cli_hint",     sa.String(),  nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["command_id"], ["mindbox_commands.id"]),
        )
        op.create_index("ix_mindbox_command_steps_command_id", "mindbox_command_steps", ["command_id"])


def downgrade() -> None:
    op.drop_index("ix_mindbox_command_steps_command_id", table_name="mindbox_command_steps")
    op.drop_table("mindbox_command_steps")
    op.drop_index("ux_mindbox_commands_user_notation", table_name="mindbox_commands")
    op.drop_index("ix_mindbox_commands_user_id", table_name="mindbox_commands")
    op.drop_table("mindbox_commands")
