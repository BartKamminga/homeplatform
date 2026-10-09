"""spelerskaart in FIFA-stijl per speelster (yearof_player_cards)

Revision ID: f2c4e6a8b0d1
Revises: e1b3d5f7a9c2
Create Date: 2026-10-09

Waarden (SNE/TEC/PAS/SCH/VER/FYS), eventueel eigen totaal, stijl en live/concept.
Met has-table-check, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "f2c4e6a8b0d1"
down_revision = "e1b3d5f7a9c2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "yearof_player_cards" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "yearof_player_cards",
        sa.Column("player_id", sa.String(), sa.ForeignKey("yearof_players.id"), primary_key=True),
        sa.Column("stats", sa.Text(), nullable=True),
        sa.Column("overall_override", sa.Integer(), nullable=True),
        sa.Column("style", sa.String(), nullable=True),
        sa.Column("live", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("yearof_player_cards")
