"""tournix_import_log + external_id op matches

Revision ID: 1a2b3c4d5e6f
Revises: a1b2c3d4e5f6
Create Date: 2026-07-09
"""
import sqlalchemy as sa
from alembic import op

revision = "1a2b3c4d5e6f"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tournix_import_log",
        sa.Column("id",               sa.String(),   primary_key=True),
        sa.Column("source",           sa.String(),   nullable=False),
        sa.Column("label",            sa.String(),   nullable=False),
        sa.Column("tournament_id",    sa.String(),   nullable=True),
        sa.Column("action",           sa.String(),   nullable=False),
        sa.Column("pools_count",      sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("teams_count",      sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("matches_created",  sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("matches_updated",  sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("created_at",       sa.DateTime(), nullable=False),
    )
    op.add_column("tournix_matches", sa.Column("external_id", sa.String(), nullable=True))
    op.create_index("ix_tournix_matches_external_id", "tournix_matches", ["external_id"])


def downgrade():
    op.drop_index("ix_tournix_matches_external_id", "tournix_matches")
    op.drop_column("tournix_matches", "external_id")
    op.drop_table("tournix_import_log")
