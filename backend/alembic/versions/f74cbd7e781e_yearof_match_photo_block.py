"""yearof match photo block position (WYSIWYG match page reordering)

Revision ID: f74cbd7e781e
Revises: 846634521e23
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "f74cbd7e781e"
down_revision = "846634521e23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "yearof_match_photo_blocks" not in inspector.get_table_names():
        op.create_table(
            "yearof_match_photo_blocks",
            sa.Column("match_ref", sa.String(), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.PrimaryKeyConstraint("match_ref"),
        )


def downgrade() -> None:
    op.drop_table("yearof_match_photo_blocks")
