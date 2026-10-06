"""yearof photo archived_at

Revision ID: c6e8a0b2d4f1
Revises: b5d7f9a1c3e2
Create Date: 2026-10-06

Item 1214: fotos niet meer echt verwijderen maar archiveren.
"""
from alembic import op
import sqlalchemy as sa

revision = "c6e8a0b2d4f1"
down_revision = "b5d7f9a1c3e2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # create_all draait in de deploy-pipeline voor deze migratie.
    columns = {c["name"] for c in sa.inspect(bind).get_columns("yearof_photos")}
    if "archived_at" not in columns:
        op.add_column("yearof_photos", sa.Column("archived_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("yearof_photos") as batch_op:
        batch_op.drop_column("archived_at")
