"""Tests voor de geaggregeerde scan-statistieken (backend/routers/hockey_
vanger_stats.py, items 1108/1096/1097/1104) - los van de live debug-browse
(zie test_hockey_vanger_schedule_debug.py)."""

import json
from datetime import datetime, timedelta

from models.hockey_discovery import HockeyCompetition, HockeyPoule, ScanHistoryDaily, ScanScheduleEntry
from routers.hockey_vanger_stats import competition_stats, poule_ranking, stats_for_day, stats_summary


def _setup_poule(session, poule_id, name="Poule A", comp_name="Comp A"):
    comp = HockeyCompetition(
        external_id=f"test|stats-{poule_id}", name=comp_name, class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    poule = HockeyPoule(poule_id=poule_id, name=name, competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.commit()
    session.refresh(poule)
    return comp, poule


def _promoted(target_type, target_id, planned_at, reason):
    return ScanScheduleEntry(
        target_type=target_type, target_id=target_id, cmd_type="get_poule",
        params=json.dumps({"poule_id": target_id}), planned_at=planned_at, reason=reason,
        status="promoted",
    )


def test_stats_for_day_buckets_by_reason_and_ranks_top_targets(session):
    comp, poule = _setup_poule(session, poule_id=1, name="Poule Z")
    day = datetime(2026, 9, 5)
    session.add(_promoted("poule", poule.poule_id, day.replace(hour=9, minute=10), "daily_fallback"))
    session.add(_promoted("poule", poule.poule_id, day.replace(hour=9, minute=20), "daily_fallback"))
    session.add(_promoted("poule", poule.poule_id, day.replace(hour=18, minute=5), "match_live"))
    # buiten de opgevraagde dag - mag niet meetellen.
    session.add(_promoted("poule", poule.poule_id, day + timedelta(days=1), "daily_fallback"))
    session.commit()

    result = stats_for_day(date="2026-09-05", bucket_min=30, session=session, _=None)

    assert result["date"] == "2026-09-05"
    nine_bucket = next(b for b in result["buckets"] if b["bucket"] == "09:00")
    assert nine_bucket["by_reason"]["daily_fallback"] == 2
    eighteen_bucket = next(b for b in result["buckets"] if b["bucket"] == "18:00")
    assert eighteen_bucket["by_reason"]["match_live"] == 1
    assert set(result["reasons_present"]) == {"daily_fallback", "match_live"}
    assert result["top_targets"][0]["target_id"] == poule.poule_id
    assert result["top_targets"][0]["total"] == 3
    assert "Poule Z" in result["top_targets"][0]["label"]


def test_stats_for_day_returns_a_full_zeroed_timeline_on_a_quiet_day(session):
    result = stats_for_day(date="2026-09-05", bucket_min=60, session=session, _=None)

    assert len(result["buckets"]) == 24
    assert all(b["total"] == 0 for b in result["buckets"])
    assert result["reasons_present"] == []
    assert result["top_targets"] == []


def test_stats_summary_aggregates_daily_totals_and_outcome_by_reason(session):
    now = datetime.utcnow()
    session.add(_promoted("poule", 1, now - timedelta(days=1), "daily_fallback"))
    session.add(_promoted("poule", 1, now - timedelta(days=1), "manual_weekly"))
    session.add(_promoted("poule", 1, now, "daily_fallback"))
    session.add(ScanHistoryDaily(date=(now - timedelta(days=1)).date().isoformat(), reason="daily_fallback", outcome="success", count=5))
    session.add(ScanHistoryDaily(date=(now - timedelta(days=1)).date().isoformat(), reason="daily_fallback", outcome="failed", count=1))
    session.commit()

    result = stats_summary(days=7, session=session, _=None)

    assert result["days"] == 7
    total_across_days = sum(d["total"] for d in result["daily_totals"])
    assert total_across_days == 3
    row = next(r for r in result["outcome_by_reason"] if r["reason"] == "daily_fallback")
    assert row["success"] == 5 and row["failed"] == 1


def test_poule_ranking_sorts_poules_by_scan_count_descending(session):
    _, poule_busy = _setup_poule(session, poule_id=10, name="Drukke poule")
    _, poule_quiet = _setup_poule(session, poule_id=11, name="Rustige poule")
    now = datetime.utcnow()
    for _i in range(5):
        session.add(_promoted("poule", poule_busy.poule_id, now, "daily_fallback"))
    session.add(_promoted("poule", poule_quiet.poule_id, now, "daily_fallback"))
    session.commit()

    result = poule_ranking(days=7, limit=10, session=session, _=None)

    assert result["rows"][0]["target_id"] == poule_busy.poule_id
    assert result["rows"][0]["total"] == 5
    assert result["rows"][1]["target_id"] == poule_quiet.poule_id


def test_competition_stats_reports_per_poule_counts_and_falls_back_to_unknown_outcome(session):
    """item 07-09-2026 ('als de scan-queue is opgeruimd dan mist deze
    info?'): de uitkomst komt niet meer uit een join naar VangerCmd (die
    kan opgeruimd zijn), maar uit ScanHistoryDaily.target_type/target_id -
    permanent, ook als de queue leeg is."""
    comp, poule = _setup_poule(session, poule_id=20, name="Poule met scans")
    now = datetime.utcnow()
    session.add(_promoted("poule", poule.poule_id, now, "daily_fallback"))
    # 2e scan heeft nog geen ScanHistoryDaily-uitkomst (bv. nog pending) -> "unknown".
    session.add(_promoted("poule", poule.poule_id, now, "daily_fallback"))
    session.add(ScanHistoryDaily(
        date=now.date().isoformat(), reason="daily_fallback", outcome="success", count=1,
        target_type="poule", target_id=poule.poule_id,
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=poule.poule_id, cmd_type="get_poule", params="{}",
        planned_at=now + timedelta(days=1), reason="daily_fallback", status="planned",
    ))
    session.commit()

    result = competition_stats(competition_id=comp.id, days=7, session=session, _=None)

    assert result["outcome"]["success"] == 1
    assert result["outcome"]["unknown"] == 1
    poule_row = result["poules"][0]
    assert poule_row["scan_count"] == 2
    assert poule_row["schedule_status"] == "gepland"


def test_competition_stats_returns_no_scheduling_when_nothing_planned(session):
    comp, poule = _setup_poule(session, poule_id=30, name="Stille poule")

    result = competition_stats(competition_id=comp.id, days=7, session=session, _=None)

    assert result["poules"][0]["schedule_status"] == "geen planning"
    assert result["poules"][0]["scan_count"] == 0
    assert result["outcome"] == {"success": 0, "failed": 0, "unknown": 0}
