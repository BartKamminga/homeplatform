"""yearof report archived_at

Revision ID: a4d6f8b1c3e5
Revises: f3c5e7a9b2d4
Create Date: 2026-10-08

Item 1239: berichten worden niet meer verwijderd maar gearchiveerd.
"""
from alembic import op
import sqlalchemy as sa

revision = "a4d6f8b1c3e5"
down_revision = "f3c5e7a9b2d4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # create_all draait in de deploy-pipeline voor deze migratie.
    columns = {c["name"] for c in sa.inspect(bind).get_columns("yearof_reports")}
    if "archived_at" not in columns:
        op.add_column("yearof_reports", sa.Column("archived_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("yearof_reports") as batch_op:
        batch_op.drop_column("archived_at")
