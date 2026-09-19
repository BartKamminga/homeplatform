"""yearof report/photo published_at

Revision ID: 9a1ecb4c1146
Revises: 87053d2a0040
Create Date: 2026-09-19

"""
from alembic import op
import sqlalchemy as sa

revision = "9a1ecb4c1146"
down_revision = "87053d2a0040"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    report_columns = [c["name"] for c in inspector.get_columns("yearof_reports")]
    if "published_at" not in report_columns:
        with op.batch_alter_table("yearof_reports") as batch_op:
            batch_op.add_column(sa.Column("published_at", sa.DateTime(), nullable=True))

    photo_columns = [c["name"] for c in inspector.get_columns("yearof_photos")]
    if "published_at" not in photo_columns:
        with op.batch_alter_table("yearof_photos") as batch_op:
            batch_op.add_column(sa.Column("published_at", sa.DateTime(), nullable=True))

    # Backfill: bestaande al-gepubliceerde content had nog geen published_at -
    # created_at is de beste beschikbare benadering voor content van voor deze migratie.
    bind.execute(sa.text(
        "UPDATE yearof_reports SET published_at = created_at WHERE status = 'published' AND published_at IS NULL"
    ))
    bind.execute(sa.text(
        "UPDATE yearof_photos SET published_at = created_at WHERE status = 'published' AND published_at IS NULL"
    ))


def downgrade():
    with op.batch_alter_table("yearof_reports") as batch_op:
        batch_op.drop_column("published_at")
    with op.batch_alter_table("yearof_photos") as batch_op:
        batch_op.drop_column("published_at")
