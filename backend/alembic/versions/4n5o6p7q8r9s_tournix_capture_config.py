"""capture_config kolommen op tournix_phases (item 316)

Revision ID: 4n5o6p7q8r9s
Revises: 3m4n5o6p7q8r
Create Date: 2026-07-19
"""

from alembic import op

revision = "4n5o6p7q8r9s"
down_revision = "3m4n5o6p7q8r"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE tournix_phases ADD COLUMN capture_type TEXT")
    op.execute("ALTER TABLE tournix_phases ADD COLUMN capture_group TEXT")
    op.execute("ALTER TABLE tournix_phases ADD COLUMN capture_ids TEXT")
    op.execute("ALTER TABLE tournix_phases ADD COLUMN capture_labels TEXT")


def downgrade():
    pass
