"""Sites tabel: beatload → beatcrades

Revision ID: 5e6f7g8h9i0j
Revises: 4d5e6f7g8h9i
Create Date: 2026-07-11
"""
import sqlalchemy as sa
from alembic import op

revision = "5e6f7g8h9i0j"
down_revision = "4d5e6f7g8h9i"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            "UPDATE sites SET slug = 'beatcrades', name = 'BeatCrades', module = 'beatcrades'"
            " WHERE slug = 'beatload'"
        )
    )


def downgrade():
    op.execute(
        sa.text(
            "UPDATE sites SET slug = 'beatload', name = 'Beatload', module = 'beatload'"
            " WHERE slug = 'beatcrades'"
        )
    )
