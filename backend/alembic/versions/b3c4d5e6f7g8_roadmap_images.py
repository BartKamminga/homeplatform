"""roadmap_items: images kolom voor screenshot-bijlagen

Revision ID: b3c4d5e6f7g8
Revises: a2b3c4d5e6f7
Create Date: 2026-08-13
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "b3c4d5e6f7g8"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    cols = [c["name"] for c in inspect(conn).get_columns("roadmap_items")]
    if "images" not in cols:
        op.add_column("roadmap_items", sa.Column("images", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("roadmap_items", "images")
