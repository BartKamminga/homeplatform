"""Tournix — fases (follow-up brackets na de poule fase)

Revision ID: s5t6u7v8w9x0
Revises: r4s5t6u7v8w9
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa

revision = "s5t6u7v8w9x0"
down_revision = "r4s5t6u7v8w9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tournix_phases",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tournament_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("phase_type", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournix_tournaments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tournix_phases_tournament_id", "tournix_phases", ["tournament_id"])

    op.create_table(
        "tournix_phase_teams",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("phase_id", sa.String(), nullable=False),
        sa.Column("team_id", sa.String(), nullable=False),
        sa.Column("group_name", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["phase_id"], ["tournix_phases.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["tournix_teams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tournix_phase_teams_phase_id", "tournix_phase_teams", ["phase_id"])

    op.add_column("tournix_matches", sa.Column("phase_id", sa.String(), nullable=True))
    op.create_index("ix_tournix_matches_phase_id", "tournix_matches", ["phase_id"])


def downgrade():
    op.drop_index("ix_tournix_matches_phase_id", "tournix_matches")
    op.drop_column("tournix_matches", "phase_id")
    op.drop_index("ix_tournix_phase_teams_phase_id", "tournix_phase_teams")
    op.drop_table("tournix_phase_teams")
    op.drop_index("ix_tournix_phases_tournament_id", "tournix_phases")
    op.drop_table("tournix_phases")
