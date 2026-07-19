"""data_captures tabel voor DataVault (hockey-vanger archief)

Revision ID: 5o6p7q8r9s0t
Revises: 4n5o6p7q8r9s
Create Date: 2026-07-19
"""

from alembic import op

revision = "5o6p7q8r9s0t"
down_revision = "4n5o6p7q8r9s"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE data_captures (
            id           TEXT NOT NULL PRIMARY KEY,
            source       TEXT NOT NULL,
            capture_type TEXT NOT NULL,
            external_id  TEXT NOT NULL,
            session_id   TEXT NOT NULL,
            payload      TEXT NOT NULL,
            meta         TEXT NOT NULL,
            captured_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX ix_data_captures_source ON data_captures (source)")
    op.execute("CREATE INDEX ix_data_captures_session ON data_captures (session_id)")
    op.execute("CREATE INDEX ix_data_captures_external ON data_captures (external_id)")
    op.execute("CREATE INDEX ix_data_captures_at ON data_captures (captured_at)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS data_captures")
