"""yearof photo match_highlight

Revision ID: 9d8e7c6b5a4f
Revises: a19225186f41
Create Date: 2026-09-21

"""
from alembic import op
import sqlalchemy as sa

revision = "9d8e7c6b5a4f"
down_revision = "a19225186f41"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("yearof_photos")]
    if "match_highlight" not in columns:
        op.add_column(
            "yearof_photos",
            sa.Column("match_highlight", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade():
    op.drop_column("yearof_photos", "match_highlight")
