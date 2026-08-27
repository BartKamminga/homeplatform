"""backfill_final_match_scores: vul ontbrekende uitslagen voor status='final'
wedstrijden vanuit gearchiveerde poule_capture-payloads.

_call_poule_capture (get_poule ingest-pad) checkte "md.status == 'finished'"
om te bepalen of een score bewaard mocht worden, maar de hockey.nl-API geeft
nooit die waarde terug (status is announced/scheduled/final/result/
discontinued/cancelled) - dus elke score werd genuld, ook bij afgeronde
wedstrijden. De ruwe payload met de echte score staat nog in data_captures
(capture_type='poule_capture'), dus geen herscan nodig om dit te herstellen.

Revision ID: 519a43d52a53
Revises: f4a1c8b2d6e9
Branch_labels: None
Depends_on: None
"""
import json
from datetime import datetime, timezone

from alembic import op  # noqa: E402
from sqlalchemy import text

revision = "519a43d52a53"
down_revision = "f4a1c8b2d6e9"
branch_labels = None
depends_on = None

NOW = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")


def upgrade():
    bind = op.get_bind()
    rows = bind.execute(
        text("SELECT payload FROM data_captures WHERE capture_type = 'poule_capture'")
    ).fetchall()

    updated = 0
    for (payload_str,) in rows:
        try:
            poule = json.loads(payload_str)["data"]["data"]["poule"]
        except Exception:
            continue
        poule_id = poule.get("id")
        if not poule_id:
            continue
        for m in poule.get("matches") or []:
            if m.get("status") != "final":
                continue
            match_id = m.get("id")
            score = m.get("score") or {}
            home_score, away_score = score.get("home"), score.get("away")
            if match_id is None or home_score is None or away_score is None:
                continue
            result = bind.execute(
                text("""
                    UPDATE hockey_poule_matches
                    SET home_score = :hs, away_score = :aw, updated_at = :now
                    WHERE poule_id = :pid AND match_id = :mid
                      AND status = 'final'
                      AND (home_score IS NULL OR away_score IS NULL)
                """),
                {"hs": home_score, "aw": away_score, "pid": poule_id, "mid": match_id, "now": NOW},
            )
            updated += result.rowcount or 0

    print(f"[backfill-final-scores] {updated} wedstrijden bijgewerkt met ontbrekende uitslag")


def downgrade():
    pass
