"""Test voor item 853: retentie/opruim-pad voor site_events (geen SQLModel-
model voor deze tabel - puur raw SQL, dus ook hier een raw CREATE TABLE in
de test-fixture zelf)."""

from unittest.mock import patch

from sqlalchemy import text

from routers.system_admin import delete_old_site_events


def test_delete_old_site_events_removes_only_rows_past_the_cutoff(session, engine):
    session.exec(text("CREATE TABLE site_events (id INTEGER PRIMARY KEY, site TEXT, ts TEXT)"))
    session.exec(text("INSERT INTO site_events (site, ts) VALUES ('hockey-inside', datetime('now', '-40 days'))"))
    session.exec(text("INSERT INTO site_events (site, ts) VALUES ('hockey-inside', datetime('now', '-1 days'))"))
    session.commit()

    with patch("core.database.engine", engine):
        result = delete_old_site_events(older_than_days=30, _=None)

    assert result["deleted"] == 1
    remaining = session.exec(text("SELECT COUNT(*) FROM site_events")).first()
    assert remaining[0] == 1
