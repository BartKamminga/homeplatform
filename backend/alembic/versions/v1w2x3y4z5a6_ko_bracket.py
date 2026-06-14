"""Tournix — KO-fase type en bracket-velden op wedstrijden

Revision ID: v1w2x3y4z5a6
Revises: u7v8w9x0y1z2
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa

revision = "v1w2x3y4z5a6"
down_revision = "u7v8w9x0y1z2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tournix_phases",  sa.Column("ko_type", sa.String(), nullable=True, server_default="single"))
    op.add_column("tournix_matches", sa.Column("bracket_round",    sa.Integer(), nullable=True))
    op.add_column("tournix_matches", sa.Column("source_match_a_id", sa.String(), nullable=True))
    op.add_column("tournix_matches", sa.Column("source_match_b_id", sa.String(), nullable=True))
    op.add_column("tournix_matches", sa.Column("source_a_takes",   sa.String(), nullable=True, server_default="winner"))
    op.add_column("tournix_matches", sa.Column("source_b_takes",   sa.String(), nullable=True, server_default="winner"))


def downgrade():
    op.drop_column("tournix_phases",  "ko_type")
    op.drop_column("tournix_matches", "bracket_round")
    op.drop_column("tournix_matches", "source_match_a_id")
    op.drop_column("tournix_matches", "source_match_b_id")
    op.drop_column("tournix_matches", "source_a_takes")
    op.drop_column("tournix_matches", "source_b_takes")
