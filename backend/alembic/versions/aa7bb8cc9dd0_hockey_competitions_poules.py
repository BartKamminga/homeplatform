"""hockey_competitions en hockey_poules tabellen

Revision ID: aa7bb8cc9dd0
Revises: z6a7b8c9d0e1
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "aa7bb8cc9dd0"
down_revision = "7q8r9s0t1u2v"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hockey_competitions",
        sa.Column("id",           sa.Integer(),    primary_key=True, autoincrement=True),
        sa.Column("external_id",  sa.Text(),       nullable=False, unique=True),
        sa.Column("name",         sa.Text(),       nullable=False),
        sa.Column("class_name",   sa.Text(),       nullable=False),
        sa.Column("district",     sa.Text(),       nullable=True),
        sa.Column("hockey_type",  sa.Text(),       nullable=False, server_default=""),
        sa.Column("season",       sa.Text(),       nullable=False),
        sa.Column("discovered_at", sa.DateTime(),  nullable=False),
        sa.Column("updated_at",   sa.DateTime(),   nullable=False),
    )
    op.create_index("ix_hockey_competitions_external_id", "hockey_competitions", ["external_id"])

    op.create_table(
        "hockey_poules",
        sa.Column("id",             sa.Integer(),  primary_key=True, autoincrement=True),
        sa.Column("poule_id",       sa.Integer(),  nullable=False, unique=True),
        sa.Column("name",           sa.Text(),     nullable=False),
        sa.Column("competition_id", sa.Integer(),  nullable=False),
        sa.Column("season",         sa.Text(),     nullable=False),
        sa.Column("discovered_at",  sa.DateTime(), nullable=False),
        sa.Column("updated_at",     sa.DateTime(), nullable=False),
    )
    op.create_index("ix_hockey_poules_poule_id",       "hockey_poules", ["poule_id"])
    op.create_index("ix_hockey_poules_competition_id", "hockey_poules", ["competition_id"])


def downgrade():
    op.drop_table("hockey_poules")
    op.drop_table("hockey_competitions")
