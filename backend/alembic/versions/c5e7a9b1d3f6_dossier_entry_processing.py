"""dossier_entries.processing - status van gespreksopnames (item 1355)

Revision ID: c5e7a9b1d3f6
Revises: b4d6f8a0c2e5
Create Date: 2026-10-16

With has-column check, because create_all runs before the migration in the deploy pipeline.
"""
from alembic import op
import sqlalchemy as sa

revision = "c5e7a9b1d3f6"
down_revision = "b4d6f8a0c2e5"
branch_labels = None
depends_on = None


def upgrade():
    columns = [c["name"] for c in sa.inspect(op.get_bind()).get_columns("dossier_entries")]
    if "processing" not in columns:
        op.add_column("dossier_entries", sa.Column("processing", sa.String(), nullable=True))


def downgrade():
    op.drop_column("dossier_entries", "processing")
