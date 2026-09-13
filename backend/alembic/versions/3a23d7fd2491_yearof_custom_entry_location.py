"""yearof custom entry location

Revision ID: 3a23d7fd2491
Revises: 53847427c04f
Create Date: 2026-09-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "3a23d7fd2491"
down_revision = "53847427c04f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("yearof_custom_entries")}
    if "location" in existing_cols:
        return
    op.add_column("yearof_custom_entries", sa.Column("location", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("yearof_custom_entries", "location")
