"""last_scanned_at: voeg kolom toe aan hockey_clubs, hockey_teams, hockey_poules + backfill

Revision ID: uu8vv9ww0xx1
Revises: tt7uu8vv9ww0
Branch_labels: None
Depends_on: None
"""
import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "uu8vv9ww0xx1"
down_revision = "tt7uu8vv9ww0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("hockey_clubs") as batch:
        batch.add_column(sa.Column("last_scanned_at", sa.DateTime(), nullable=True))

    with op.batch_alter_table("hockey_teams") as batch:
        batch.add_column(sa.Column("last_scanned_at", sa.DateTime(), nullable=True))

    with op.batch_alter_table("hockey_poules") as batch:
        batch.add_column(sa.Column("last_scanned_at", sa.DateTime(), nullable=True))

    bind = op.get_bind()

    # Backfill hockey_poules.last_scanned_at
    # Gebruik captured_at van de meest recente poule-capture per poule_id
    poule_captures = bind.execute(
        text("SELECT captured_at, payload FROM data_captures WHERE capture_type = 'poule'")
    ).fetchall()

    poule_latest = {}  # poule_id (int) -> max captured_at
    for captured_at, payload_str in poule_captures:
        try:
            pay = json.loads(payload_str)
            pid = pay.get("data", {}).get("poule", {}).get("id")
            if pid and captured_at:
                pid = int(pid)
                if pid not in poule_latest or captured_at > poule_latest[pid]:
                    poule_latest[pid] = captured_at
        except Exception:
            pass

    poule_cap_captures = bind.execute(
        text("SELECT captured_at, payload FROM data_captures WHERE capture_type = 'poule_capture'")
    ).fetchall()
    for captured_at, payload_str in poule_cap_captures:
        try:
            pay = json.loads(payload_str)
            pid = pay.get("poule_id")
            if pid and captured_at:
                pid = int(pid)
                if pid not in poule_latest or captured_at > poule_latest[pid]:
                    poule_latest[pid] = captured_at
        except Exception:
            pass

    for pid, ts in poule_latest.items():
        bind.execute(
            text("UPDATE hockey_poules SET last_scanned_at = :ts WHERE poule_id = :pid"),
            {"ts": ts, "pid": pid},
        )

    # Backfill hockey_clubs.last_scanned_at via scan_club captures
    club_captures = bind.execute(
        text("SELECT captured_at, payload FROM data_captures WHERE capture_type IN ('club_detail', 'scan_club')")
    ).fetchall()

    club_latest = {}  # external_id -> max captured_at
    for captured_at, payload_str in club_captures:
        try:
            pay = json.loads(payload_str)
            ext_id = pay.get("external_id") or pay.get("club_external_id")
            if ext_id and captured_at:
                if ext_id not in club_latest or captured_at > club_latest[ext_id]:
                    club_latest[ext_id] = captured_at
        except Exception:
            pass

    for ext_id, ts in club_latest.items():
        bind.execute(
            text("UPDATE hockey_clubs SET last_scanned_at = :ts WHERE external_id = :eid"),
            {"ts": ts, "eid": ext_id},
        )

    print(f"[last_scanned_at] poules backfilled: {len(poule_latest)}, clubs: {len(club_latest)}")


def downgrade():
    with op.batch_alter_table("hockey_poules") as batch:
        batch.drop_column("last_scanned_at")
    with op.batch_alter_table("hockey_teams") as batch:
        batch.drop_column("last_scanned_at")
    with op.batch_alter_table("hockey_clubs") as batch:
        batch.drop_column("last_scanned_at")
