"""tournament published flag

Revision ID: ww0xx1yy2zz3
Revises: vv9ww0xx1yy2
Create Date: 2026-08-03
"""
import sqlalchemy as sa
from alembic import op

revision = "ww0xx1yy2zz3"
down_revision = "vv9ww0xx1yy2"
branch_labels = None
depends_on = None


def upgrade():
    # Bestaande publicaties krijgen published=1 zodat ze zichtbaar blijven op Poulebord.
    # Nieuwe publicaties starten op published=0 (model default=False).
    op.add_column(
        "tournix_tournaments",
        sa.Column("published", sa.Boolean(), nullable=False, server_default="1"),
    )


def downgrade():
    op.drop_column("tournix_tournaments", "published")
