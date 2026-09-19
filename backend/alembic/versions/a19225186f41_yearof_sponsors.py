"""yearof sponsors

Revision ID: a19225186f41
Revises: 0ff588add681
Create Date: 2026-09-19

"""
from alembic import op
import sqlalchemy as sa

revision = "a19225186f41"
down_revision = "0ff588add681"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "yearof_sponsors" not in inspector.get_table_names():
        op.create_table(
            "yearof_sponsors",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("logo_url", sa.String(), nullable=True),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("website_url", sa.String(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )


def downgrade():
    op.drop_table("yearof_sponsors")
