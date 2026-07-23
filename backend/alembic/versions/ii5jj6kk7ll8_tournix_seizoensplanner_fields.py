"""tournix seizoensplanner fields

Revision ID: ii5jj6kk7ll8
Revises: hh4ii5jj6kk7
Create Date: 2026-07-23
"""
from alembic import op
import sqlalchemy as sa

revision = "ii5jj6kk7ll8"
down_revision = "hh4ii5jj6kk7"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("tournix_phases") as batch:
        # Welk competitietype: veld | zaal
        batch.add_column(sa.Column("surface", sa.String(), nullable=True))
        # Welke periode: herfst | lente | nk | overig
        batch.add_column(sa.Column("period", sa.String(), nullable=True))
        # Vrij label voor weergave, bv. "🏑 Herfst" of "🏒 Zaal Winter"
        batch.add_column(sa.Column("phase_label", sa.String(), nullable=True))
        # Koppeling naar hockey_poules.id (int PK)
        batch.add_column(sa.Column("hockey_poule_id", sa.Integer(), nullable=True))

    with op.batch_alter_table("tournix_teams") as batch:
        # Koppeling naar hockey_teams.id (int PK) voor auto-matching
        batch.add_column(sa.Column("hockey_team_id", sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table("tournix_teams") as batch:
        batch.drop_column("hockey_team_id")

    with op.batch_alter_table("tournix_phases") as batch:
        batch.drop_column("hockey_poule_id")
        batch.drop_column("phase_label")
        batch.drop_column("period")
        batch.drop_column("surface")
