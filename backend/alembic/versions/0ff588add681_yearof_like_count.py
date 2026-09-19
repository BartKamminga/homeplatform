"""yearof report/photo like_count

Revision ID: 0ff588add681
Revises: 9a1ecb4c1146
Create Date: 2026-09-19

"""
from alembic import op
import sqlalchemy as sa

revision = "0ff588add681"
down_revision = "e318326111e7"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    report_columns = [c["name"] for c in inspector.get_columns("yearof_reports")]
    if "like_count" not in report_columns:
        with op.batch_alter_table("yearof_reports") as batch_op:
            batch_op.add_column(sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"))

    photo_columns = [c["name"] for c in inspector.get_columns("yearof_photos")]
    if "like_count" not in photo_columns:
        with op.batch_alter_table("yearof_photos") as batch_op:
            batch_op.add_column(sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    with op.batch_alter_table("yearof_reports") as batch_op:
        batch_op.drop_column("like_count")
    with op.batch_alter_table("yearof_photos") as batch_op:
        batch_op.drop_column("like_count")
