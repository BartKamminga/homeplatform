"""yearof match goals

Revision ID: 092159846d26
Revises: 78fedc04671a
Create Date: 2026-09-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "092159846d26"
down_revision = "78fedc04671a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "yearof_match_goals",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("match_ref", sa.String(), nullable=False),
        sa.Column("player_id", sa.String(), nullable=False),
        sa.Column("goals", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["player_id"], ["yearof_players.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_yearof_match_goals_match_ref"), "yearof_match_goals", ["match_ref"])
    op.create_index(op.f("ix_yearof_match_goals_player_id"), "yearof_match_goals", ["player_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_yearof_match_goals_player_id"), table_name="yearof_match_goals")
    op.drop_index(op.f("ix_yearof_match_goals_match_ref"), table_name="yearof_match_goals")
    op.drop_table("yearof_match_goals")
