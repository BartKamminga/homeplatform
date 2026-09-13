"""yearof_team_links - teamlinkje v1 (item 1145): code-als-toegang, geen
per-wedstrijd-rotatie/vangnet nog (dat komt in item 1149).

Revision ID: 7d6c11305577
Revises: 08ff660e9733
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "7d6c11305577"
down_revision = "08ff660e9733"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
    if "yearof_team_links" not in existing:
        op.create_table(
            "yearof_team_links",
            sa.Column("id",         sa.Text(),     nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade():
    op.drop_table("yearof_team_links")
