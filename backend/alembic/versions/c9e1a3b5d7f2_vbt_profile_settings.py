"""vbt_profiles.settings: vrije instellingen per gebruiker (max-hartslag voor HR-zones, stem, verkeer)

Revision ID: c9e1a3b5d7f2
Revises: a7c9e1f3b5d9
Create Date: 2026-10-13

Met has-column-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "c9e1a3b5d7f2"
down_revision = "a7c9e1f3b5d9"
branch_labels = None
depends_on = None


def upgrade():
    cols = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("vbt_profiles")]
    if "settings" not in cols:
        op.add_column("vbt_profiles", sa.Column("settings", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("vbt_profiles") as batch_op:
        batch_op.drop_column("settings")
