"""yearof short links

Revision ID: 87053d2a0040
Revises: e92888f9cdfd
Create Date: 2026-09-18

"""
from alembic import op
import sqlalchemy as sa

revision = "87053d2a0040"
down_revision = "e92888f9cdfd"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "yearof_short_links" not in inspector.get_table_names():
        op.create_table(
            "yearof_short_links",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("team_code", sa.String(), nullable=False),
            sa.Column("match_ref", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )


def downgrade():
    op.drop_table("yearof_short_links")
