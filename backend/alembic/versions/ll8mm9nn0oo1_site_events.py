"""Replace scrapster_events with generic site_events table."""

from alembic import op

revision = "ll8mm9nn0oo1"
down_revision = "kk7ll8mm9nn0"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("DROP TABLE IF EXISTS scrapster_events")

    op.execute("""
        CREATE TABLE IF NOT EXISTS site_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            site TEXT NOT NULL,
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
        "CREATE INDEX IF NOT EXISTS ix_site_events_site_ts "
        "ON site_events (site, ts)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_site_events_type_ts "
        "ON site_events (event_type, ts)"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS site_events")
