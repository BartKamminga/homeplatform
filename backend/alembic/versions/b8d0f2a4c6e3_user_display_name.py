"""users.display_name (optionele weergavenaam, bv. uit Google/Microsoft)

Revision ID: b8d0f2a4c6e3
Revises: a7c9e1b3d5f2
Create Date: 2026-10-11

Item 1271. Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "b8d0f2a4c6e3"
down_revision = "a7c9e1b3d5f2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "display_name" in [c["name"] for c in sa.inspect(bind).get_columns("users")]:
        return
    op.add_column("users", sa.Column("display_name", sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("display_name")
