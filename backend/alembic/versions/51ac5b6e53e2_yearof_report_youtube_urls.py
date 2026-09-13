"""yearof report youtube_urls

Revision ID: 51ac5b6e53e2
Revises: 092159846d26
Create Date: 2026-09-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "51ac5b6e53e2"
down_revision = "092159846d26"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("yearof_reports")}
    if "youtube_urls" in existing_cols:
        return
    op.add_column("yearof_reports", sa.Column("youtube_urls", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("yearof_reports", "youtube_urls")
