"""yearof_reports + yearof_report_player_tags + yearof_contributor_links
(item 1147): verslagen/interviews, spelertags, en de eenmalige/tijdelijke
wedstrijd-invullink.

Revision ID: 2524d638cfb4
Revises: 7d7c0e016c74
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "2524d638cfb4"
down_revision = "7d7c0e016c74"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}

    if "yearof_contributor_links" not in existing:
        op.create_table(
            "yearof_contributor_links",
            sa.Column("id",         sa.Text(),     nullable=False),
            sa.Column("match_ref",  sa.Text(),     nullable=False),
            sa.Column("player_id",  sa.Text(),     nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["player_id"], ["yearof_players.id"]),
        )

    if "yearof_reports" not in existing:
        op.create_table(
            "yearof_reports",
            sa.Column("id",               sa.Text(),     nullable=False),
            sa.Column("match_ref",        sa.Text(),     nullable=False),
            sa.Column("report_type",      sa.Text(),     nullable=False),
            sa.Column("status",           sa.Text(),     nullable=False),
            sa.Column("title",            sa.Text(),     nullable=False),
            sa.Column("body",             sa.Text(),     nullable=False),
            sa.Column("author_name",      sa.Text(),     nullable=True),
            sa.Column("insta_url",        sa.Text(),     nullable=True),
            sa.Column("youtube_url",      sa.Text(),     nullable=True),
            sa.Column("contributor_code", sa.Text(),     nullable=True),
            sa.Column("created_at",       sa.DateTime(), nullable=False),
            sa.Column("updated_at",       sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_yearof_reports_match_ref", "yearof_reports", ["match_ref"])

    if "yearof_report_player_tags" not in existing:
        op.create_table(
            "yearof_report_player_tags",
            sa.Column("id",        sa.Text(), nullable=False),
            sa.Column("report_id", sa.Text(), nullable=False),
            sa.Column("player_id", sa.Text(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["report_id"], ["yearof_reports.id"]),
            sa.ForeignKeyConstraint(["player_id"], ["yearof_players.id"]),
        )
        op.create_index("ix_yearof_report_player_tags_report_id", "yearof_report_player_tags", ["report_id"])
        op.create_index("ix_yearof_report_player_tags_player_id", "yearof_report_player_tags", ["player_id"])


def downgrade():
    op.drop_table("yearof_report_player_tags")
    op.drop_table("yearof_reports")
    op.drop_table("yearof_contributor_links")
