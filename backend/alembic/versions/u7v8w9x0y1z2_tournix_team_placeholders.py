"""Tournix — placeholder-teams voor vervolg-fases

Revision ID: u7v8w9x0y1z2
Revises: t6u7v8w9x0y1
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa

revision = "u7v8w9x0y1z2"
down_revision = "t6u7v8w9x0y1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tournix_teams", sa.Column("is_placeholder",              sa.Boolean(), nullable=True, server_default="0"))
    op.add_column("tournix_teams", sa.Column("placeholder_source_phase_id", sa.String(),  nullable=True))
    op.add_column("tournix_teams", sa.Column("placeholder_pool_name",       sa.String(),  nullable=True))
    op.add_column("tournix_teams", sa.Column("placeholder_position",        sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("tournix_teams", "placeholder_position")
    op.drop_column("tournix_teams", "placeholder_pool_name")
    op.drop_column("tournix_teams", "placeholder_source_phase_id")
    op.drop_column("tournix_teams", "is_placeholder")
