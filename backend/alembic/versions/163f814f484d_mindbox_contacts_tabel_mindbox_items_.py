"""mindbox_contacts tabel + mindbox_items.contact_id toevoegen (item 1052:
Contact-entiteit los van Context, v1 koppelt alleen op e-mailadres)

Revision ID: 163f814f484d
Revises: b70c3863667c
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "163f814f484d"
down_revision = "b70c3863667c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
    if "mindbox_contacts" not in existing_tables:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en heeft de tabel dan al aangemaakt.
        op.create_table(
            "mindbox_contacts",
            sa.Column("id",            sa.String(),   nullable=False),
            sa.Column("user_id",       sa.String(),   nullable=False),
            sa.Column("email",         sa.String(),   nullable=False),
            sa.Column("display_name",  sa.String(),   nullable=True),
            sa.Column("notes",         sa.String(),   nullable=True),
            sa.Column("created_at",    sa.DateTime(), nullable=False),
            sa.Column("updated_at",    sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        )
        op.create_index("ix_mindbox_contacts_user_id", "mindbox_contacts", ["user_id"])
        op.create_index("ix_mindbox_contacts_email", "mindbox_contacts", ["email"])

    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_items)")).fetchall()}
    if "contact_id" not in existing_cols:
        op.add_column("mindbox_items", sa.Column("contact_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("mindbox_items", "contact_id")
    op.drop_index("ix_mindbox_contacts_email", table_name="mindbox_contacts")
    op.drop_index("ix_mindbox_contacts_user_id", table_name="mindbox_contacts")
    op.drop_table("mindbox_contacts")
