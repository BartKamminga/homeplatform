"""hockey_publication_tag_categories: organisatorische groepering van tags (item 749)

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-08-20
"""
import sqlalchemy as sa
from alembic import op

revision = "f6g7h8i9j0k1"
down_revision = "e5f6g7h8i9j0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hockey_publication_tag_categories",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "hockey_publication_tags",
        sa.Column("category_id", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("hockey_publication_tags", "category_id")
    op.drop_table("hockey_publication_tag_categories")
