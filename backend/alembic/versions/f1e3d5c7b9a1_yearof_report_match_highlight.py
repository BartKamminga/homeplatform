"""yearof report match_highlight

Revision ID: f1e3d5c7b9a1
Revises: e3f4a5b6c7d8
Create Date: 2026-09-22

"""
from alembic import op
import sqlalchemy as sa

revision = "f1e3d5c7b9a1"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("yearof_reports")]
    if "match_highlight" not in columns:
        op.add_column(
            "yearof_reports",
            sa.Column("match_highlight", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade():
    op.drop_column("yearof_reports", "match_highlight")
