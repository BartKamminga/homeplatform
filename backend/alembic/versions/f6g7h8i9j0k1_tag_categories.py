"""hockey_publication_tag_categories: organisatorische groepering van tags (item 749)

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-08-20
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "f6g7h8i9j0k1"
down_revision = "e5f6g7h8i9j0"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    existing = set(inspect(conn).get_table_names())

    # Idempotent: create_db_and_tables() (app-startup) kan deze tabel al hebben
    # aangemaakt vóórdat deze migratie draait - zelfde patroon als fade12ab34cd.
    if "hockey_publication_tag_categories" not in existing:
        op.create_table(
            "hockey_publication_tag_categories",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False, unique=True),
            sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        )

    cols = [c["name"] for c in inspect(conn).get_columns("hockey_publication_tags")]
    if "category_id" not in cols:
        op.add_column(
            "hockey_publication_tags",
            sa.Column("category_id", sa.String(), nullable=True),
        )


def downgrade():
    op.drop_column("hockey_publication_tags", "category_id")
    op.drop_table("hockey_publication_tag_categories")
