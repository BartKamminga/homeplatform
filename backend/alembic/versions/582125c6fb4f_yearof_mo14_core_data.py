"""yearof_players + yearof_custom_entries - kerndata voor de YearOf MO14
supportersite (item 1144): spelersroster en handmatige tijdlijn-items
(oefenwedstrijden + vrije "bijzondere dagen") naast de KNHB/Poulebord-sync.

Revision ID: 582125c6fb4f
Revises: e7d9b1f3a5c9
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "582125c6fb4f"
down_revision = "e7d9b1f3a5c9"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}

    if "yearof_players" not in existing:
        op.create_table(
            "yearof_players",
            sa.Column("id",           sa.Text(),     nullable=False),
            sa.Column("name",         sa.Text(),     nullable=False),
            sa.Column("shirt_number", sa.Integer(),  nullable=True),
            sa.Column("position",     sa.Text(),     nullable=True),
            sa.Column("photo_url",    sa.Text(),     nullable=True),
            sa.Column("bio",          sa.Text(),     nullable=True),
            sa.Column("fun_facts",    sa.Text(),     nullable=True),
            sa.Column("created_at",   sa.DateTime(), nullable=False),
            sa.Column("updated_at",   sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if "yearof_custom_entries" not in existing:
        op.create_table(
            "yearof_custom_entries",
            sa.Column("id",          sa.Text(),     nullable=False),
            sa.Column("kind",        sa.Text(),     nullable=False),
            sa.Column("title",       sa.Text(),     nullable=False),
            sa.Column("date",        sa.Text(),     nullable=False),
            sa.Column("opponent",    sa.Text(),     nullable=True),
            sa.Column("is_home",     sa.Boolean(),  nullable=True),
            sa.Column("score_us",    sa.Integer(),  nullable=True),
            sa.Column("score_them",  sa.Integer(),  nullable=True),
            sa.Column("description", sa.Text(),     nullable=True),
            sa.Column("is_pinned",   sa.Boolean(),  nullable=False),
            sa.Column("created_at",  sa.DateTime(), nullable=False),
            sa.Column("updated_at",  sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_yearof_custom_entries_kind", "yearof_custom_entries", ["kind"])


def downgrade():
    op.drop_table("yearof_custom_entries")
    op.drop_table("yearof_players")
