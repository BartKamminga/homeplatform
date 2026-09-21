"""external deploy grants

Revision ID: e3f4a5b6c7d8
Revises: 9d8e7c6b5a4f
Create Date: 2026-09-21

"""
from alembic import op
import sqlalchemy as sa

revision = "e3f4a5b6c7d8"
down_revision = "9d8e7c6b5a4f"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "external_deploy_grants" not in inspector.get_table_names():
        op.create_table(
            "external_deploy_grants",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("repo_url", sa.String(), nullable=True),
            sa.Column("host", sa.String(), nullable=False, server_default="192.168.30.232"),
            sa.Column("deploy_user", sa.String(), nullable=False),
            sa.Column("forced_command", sa.String(), nullable=True),
            sa.Column("sudo_rule", sa.String(), nullable=True),
            sa.Column("ports", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="active"),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )


def downgrade():
    op.drop_table("external_deploy_grants")
