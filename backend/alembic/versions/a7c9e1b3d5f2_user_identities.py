"""gekoppelde externe logins (user_identities) - Google/Microsoft via OIDC

Revision ID: a7c9e1b3d5f2
Revises: f2c4e6a8b0d1
Create Date: 2026-10-11

Item 1271. Met has-table-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "a7c9e1b3d5f2"
down_revision = "f2c4e6a8b0d1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "user_identities" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "user_identities",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("linked_at", sa.DateTime(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_user_identities_user_id", "user_identities", ["user_id"])
    op.create_index("ux_user_identities_provider_subject", "user_identities", ["provider", "subject"], unique=True)


def downgrade():
    op.drop_table("user_identities")
