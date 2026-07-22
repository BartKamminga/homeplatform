"""hockey_poule_standings and hockey_poule_matches tables

Revision ID: dd0ee1ff2gg3
Revises: cc9dd0ee1ff2
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa

revision = "dd0ee1ff2gg3"
down_revision = "cc9dd0ee1ff2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    existing_tables = {r[0] for r in existing}

    if "hockey_poule_standings" in existing_tables and "hockey_poule_matches" in existing_tables:
        return

    op.create_table(
        "hockey_poule_standings",
        sa.Column("id",            sa.Integer(),  nullable=False),
        sa.Column("poule_id",      sa.Integer(),  nullable=False),
        sa.Column("team_id",       sa.Integer(),  nullable=False),
        sa.Column("team_name",     sa.Text(),     nullable=False),
        sa.Column("position",      sa.Integer(),  nullable=True),
        sa.Column("played",        sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("won",           sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("drawn",         sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("lost",          sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("goals_for",     sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("goals_against", sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("points",        sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("updated_at",    sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hockey_poule_standings_poule_id", "hockey_poule_standings", ["poule_id"])
    op.create_index("ix_hockey_poule_standings_team_id",  "hockey_poule_standings", ["team_id"])

    op.create_table(
        "hockey_poule_matches",
        sa.Column("id",             sa.Integer(),  nullable=False),
        sa.Column("poule_id",       sa.Integer(),  nullable=False),
        sa.Column("match_id",       sa.Integer(),  nullable=True),
        sa.Column("home_team_id",   sa.Integer(),  nullable=True),
        sa.Column("home_team_name", sa.Text(),     nullable=False, server_default=""),
        sa.Column("away_team_id",   sa.Integer(),  nullable=True),
        sa.Column("away_team_name", sa.Text(),     nullable=False, server_default=""),
        sa.Column("match_date",     sa.Text(),     nullable=True),
        sa.Column("status",         sa.Text(),     nullable=False, server_default=""),
        sa.Column("home_score",     sa.Integer(),  nullable=True),
        sa.Column("away_score",     sa.Integer(),  nullable=True),
        sa.Column("round",          sa.Integer(),  nullable=True),
        sa.Column("updated_at",     sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hockey_poule_matches_poule_id", "hockey_poule_matches", ["poule_id"])
    op.create_index("ix_hockey_poule_matches_match_id", "hockey_poule_matches", ["match_id"])


def downgrade():
    op.drop_table("hockey_poule_matches")
    op.drop_table("hockey_poule_standings")
