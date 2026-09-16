"""yearof photo report_id + match_ref optioneel

Revision ID: b86d79722251
Revises: c71be83bd705
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "b86d79722251"
down_revision = "c71be83bd705"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"]: c for c in inspector.get_columns("yearof_photos")}

    if "report_id" not in existing_cols:
        with op.batch_alter_table("yearof_photos") as batch_op:
            batch_op.add_column(sa.Column("report_id", sa.String(), nullable=True))
        op.create_index("ix_yearof_photos_report_id", "yearof_photos", ["report_id"])

    if existing_cols.get("match_ref") is not None and not existing_cols["match_ref"]["nullable"]:
        with op.batch_alter_table("yearof_photos") as batch_op:
            batch_op.alter_column("match_ref", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("yearof_photos") as batch_op:
        batch_op.alter_column("match_ref", existing_type=sa.String(), nullable=False)
        batch_op.drop_index("ix_yearof_photos_report_id")
        batch_op.drop_column("report_id")
