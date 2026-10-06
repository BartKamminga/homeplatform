"""yearof player spotlights

Revision ID: b5d7f9a1c3e2
Revises: a4c6e8f0b2d1
Create Date: 2026-10-06

Item 1200: speelster van de week (max 1 tegelijk in de kijker).
"""
from alembic import op
import sqlalchemy as sa

revision = "b5d7f9a1c3e2"
down_revision = "a4c6e8f0b2d1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # create_all draait in de deploy-pipeline voor deze migratie.
    if "yearof_player_spotlights" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "yearof_player_spotlights",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("player_id", sa.String(), sa.ForeignKey("yearof_players.id"), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=False),
            sa.Column("ended_at", sa.DateTime(), nullable=True),
        )
    indexes = {i["name"] for i in sa.inspect(bind).get_indexes("yearof_player_spotlights")}
    if "ix_yearof_player_spotlights_player_id" not in indexes:
        op.create_index("ix_yearof_player_spotlights_player_id", "yearof_player_spotlights", ["player_id"])


def downgrade():
    op.drop_table("yearof_player_spotlights")
