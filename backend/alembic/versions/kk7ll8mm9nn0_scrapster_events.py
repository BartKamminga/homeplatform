"""Add scrapster_events table for analytics tracking."""

from alembic import op

revision = "kk7ll8mm9nn0"
down_revision = "jj6kk7ll8mm9"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS scrapster_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            ts DATETIME NOT NULL,
            ip_hash TEXT,
            user_agent TEXT,
            endpoint TEXT,
            duration_ms INTEGER,
            status_code INTEGER,
            result_count INTEGER,
            source_url TEXT,
            cache_hit INTEGER,
            token TEXT
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_scrapster_events_ts "
        "ON scrapster_events (ts)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_scrapster_events_type_ts "
        "ON scrapster_events (event_type, ts)"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS scrapster_events")
