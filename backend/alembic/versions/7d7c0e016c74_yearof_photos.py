"""yearof_photos + yearof_photo_player_tags - foto-bijdragen (item 1146):
3 beeldvarianten op disk (thumb/medium/full), concept/published-status,
speler-tags als echte koppeltabel (spelersprofiel query't hierop).

Revision ID: 7d7c0e016c74
Revises: 7d6c11305577
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "7d7c0e016c74"
down_revision = "7d6c11305577"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}

    if "yearof_photos" not in existing:
        op.create_table(
            "yearof_photos",
            sa.Column("id",            sa.Text(),     nullable=False),
            sa.Column("match_ref",     sa.Text(),     nullable=False),
            sa.Column("photo_type",    sa.Text(),     nullable=False),
            sa.Column("status",        sa.Text(),     nullable=False),
            sa.Column("uploader_code", sa.Text(),     nullable=True),
            sa.Column("caption",       sa.Text(),     nullable=True),
            sa.Column("created_at",    sa.DateTime(), nullable=False),
            sa.Column("updated_at",    sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_yearof_photos_match_ref", "yearof_photos", ["match_ref"])

    if "yearof_photo_player_tags" not in existing:
        op.create_table(
            "yearof_photo_player_tags",
            sa.Column("id",        sa.Text(), nullable=False),
            sa.Column("photo_id",  sa.Text(), nullable=False),
            sa.Column("player_id", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["photo_id"], ["yearof_photos.id"]),
            sa.ForeignKeyConstraint(["player_id"], ["yearof_players.id"]),
        )
        op.create_index("ix_yearof_photo_player_tags_photo_id", "yearof_photo_player_tags", ["photo_id"])
        op.create_index("ix_yearof_photo_player_tags_player_id", "yearof_photo_player_tags", ["player_id"])


def downgrade():
    op.drop_table("yearof_photo_player_tags")
    op.drop_table("yearof_photos")
