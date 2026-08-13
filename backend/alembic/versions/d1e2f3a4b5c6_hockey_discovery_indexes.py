"""hockey discovery: ontbrekende indexen op season, recent_poule_id, hockey_type

Revision ID: d1e2f3a4b5c6
Revises: c4d5e6f7g8h9, z6a7b8c9d0e1
Create Date: 2026-08-13
"""
from alembic import op

revision = "d1e2f3a4b5c6"
down_revision = ("c4d5e6f7g8h9", "z6a7b8c9d0e1")
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_hockey_competitions_season",  "hockey_competitions", ["season"],        if_not_exists=True)
    op.create_index("ix_hockey_poules_season",         "hockey_poules",       ["season"],        if_not_exists=True)
    op.create_index("ix_hockey_teams_recent_poule_id", "hockey_teams",        ["recent_poule_id"], if_not_exists=True)
    op.create_index("ix_hockey_teams_hockey_type",     "hockey_teams",        ["hockey_type"],   if_not_exists=True)


def downgrade():
    op.drop_index("ix_hockey_teams_hockey_type",     table_name="hockey_teams")
    op.drop_index("ix_hockey_teams_recent_poule_id", table_name="hockey_teams")
    op.drop_index("ix_hockey_poules_season",         table_name="hockey_poules")
    op.drop_index("ix_hockey_competitions_season",   table_name="hockey_competitions")
