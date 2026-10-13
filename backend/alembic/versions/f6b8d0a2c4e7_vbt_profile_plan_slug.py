"""vbt_profiles.plan_slug: actief trainingsplan per gebruiker (ftp-builder of build-me-up)

Revision ID: f6b8d0a2c4e7
Revises: e5a7c9e1f3b6
Create Date: 2026-10-13

Item 1300. Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "f6b8d0a2c4e7"
down_revision = "e5a7c9e1f3b6"
branch_labels = None
depends_on = None


def upgrade():
    cols = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("vbt_profiles")]
    if "plan_slug" not in cols:
        op.add_column("vbt_profiles", sa.Column("plan_slug", sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("vbt_profiles") as batch_op:
        batch_op.drop_column("plan_slug")
