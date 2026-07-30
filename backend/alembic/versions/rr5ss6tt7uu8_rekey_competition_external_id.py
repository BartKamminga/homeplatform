"""rekey_competition_external_id: voeg class_name en district toe aan external_id

Revision ID: rr5ss6tt7uu8
Revises: qq4rr5ss6tt7
Branch_labels: None
Depends_on: None
"""
from alembic import op  # noqa: E402

revision = "rr5ss6tt7uu8"
down_revision = "qq4rr5ss6tt7"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        UPDATE hockey_competitions
        SET external_id = name || '|' || COALESCE(class_name, '') || '|' || COALESCE(district, '') || '|' || season
    """)


def downgrade():
    op.execute("""
        UPDATE hockey_competitions
        SET external_id = name || '|' || season
    """)
