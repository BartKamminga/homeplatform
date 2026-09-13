"""yearof photo media_type + file_ext (video support, item 1154)

Revision ID: cf9fbaab1edf
Revises: 3a23d7fd2491
Create Date: 2026-09-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "cf9fbaab1edf"
down_revision = "3a23d7fd2491"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("yearof_photos")}

    if "media_type" not in existing_cols:
        op.add_column("yearof_photos", sa.Column("media_type", sa.String(), nullable=False, server_default="photo"))
    if "file_ext" not in existing_cols:
        op.add_column("yearof_photos", sa.Column("file_ext", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("yearof_photos", "file_ext")
    op.drop_column("yearof_photos", "media_type")
