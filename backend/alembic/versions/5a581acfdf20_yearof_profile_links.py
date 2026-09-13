"""yearof_profile_links + yearof_player_edits (item 1148): permanent
profiellinkje per speler + losse staging-rij voor concept-wijzigingen.

Revision ID: 5a581acfdf20
Revises: 9c2bb80877f6
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "5a581acfdf20"
down_revision = "9c2bb80877f6"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}

    if "yearof_profile_links" not in existing:
        op.create_table(
            "yearof_profile_links",
            sa.Column("id",         sa.Text(),     nullable=False),
            sa.Column("player_id",  sa.Text(),     nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["player_id"], ["yearof_players.id"]),
        )
        op.create_index("ix_yearof_profile_links_player_id", "yearof_profile_links", ["player_id"])

    if "yearof_player_edits" not in existing:
        op.create_table(
            "yearof_player_edits",
            sa.Column("id",         sa.Text(),     nullable=False),
            sa.Column("player_id",  sa.Text(),     nullable=False),
            sa.Column("nickname",   sa.Text(),     nullable=True),
            sa.Column("position",   sa.Text(),     nullable=True),
            sa.Column("photo_url",  sa.Text(),     nullable=True),
            sa.Column("bio",        sa.Text(),     nullable=True),
            sa.Column("fun_facts",  sa.Text(),     nullable=True),
            sa.Column("status",     sa.Text(),     nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["player_id"], ["yearof_players.id"]),
        )
        op.create_index("ix_yearof_player_edits_player_id", "yearof_player_edits", ["player_id"])


def downgrade():
    op.drop_table("yearof_player_edits")
    op.drop_table("yearof_profile_links")
