"""hockey_team no_new_poule_confirmed flag

Revision ID: bb8cc9dd0ee1
Revises: aa7bb8cc9dd0
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "bb8cc9dd0ee1"
down_revision = "aa7bb8cc9dd0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "hockey_teams",
        sa.Column("no_new_poule_confirmed", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("hockey_teams", "no_new_poule_confirmed")
