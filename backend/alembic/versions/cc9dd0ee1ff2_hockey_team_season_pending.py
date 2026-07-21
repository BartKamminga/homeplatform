"""hockey_team season_pending flag

Revision ID: cc9dd0ee1ff2
Revises: bb8cc9dd0ee1
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "cc9dd0ee1ff2"
down_revision = "bb8cc9dd0ee1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "hockey_teams",
        sa.Column("season_pending", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("hockey_teams", "season_pending")
