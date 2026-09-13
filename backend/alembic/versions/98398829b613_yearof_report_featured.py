"""yearof report featured (In de kijker curatie)

Revision ID: 98398829b613
Revises: cf9fbaab1edf
Create Date: 2026-09-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "98398829b613"
down_revision = "cf9fbaab1edf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("yearof_reports")}
    if "featured" in existing_cols:
        return
    op.add_column("yearof_reports", sa.Column("featured", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("yearof_reports", "featured")
