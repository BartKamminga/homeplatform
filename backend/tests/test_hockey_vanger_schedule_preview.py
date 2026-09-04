"""Tests voor item 1084: scan-plan preview + shadow-run (routers/hockey_
vanger_schedule_debug.py). preview-scenario roept de echte event-generators
aan met een gefabriceerd object; shadow-run roept build_schedule_events zelf
aan op echte data - beide binnen candidate_settings_scope, die nooit
committed (bewezen door de rollback-test hieronder)."""

from datetime import datetime

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam
from models.settings import AppSetting
from routers.hockey_vanger_schedule_debug import (
    PreviewScenarioIn, ShadowRunIn, preview_scenario, schedule_summary, shadow_run,
)


def test_preview_match_normal_has_two_rows_and_two_ticks(session):
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={}), session=session, _=None)
    rows = result["rows"]
    assert [r["key"] for r in rows] == ["autoscan", "non_autoscan"]
    reasons = {t["reason"] for t in rows[0]["ticks"]}
    assert reasons == {"match_start_check", "match_end_check"}


def test_preview_match_normal_returns_a_now_marker_and_a_match_bar(session):
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={}), session=session, _=None)
    assert result["now"]
    bars = result["rows"][0]["bars"]
    assert len(bars) == 1 and bars[0]["label"] == "Wedstrijd"
    assert result["rows"][1]["bars"][0]["dimmed"] is True


def test_preview_match_never_live_has_no_start_check_tick_but_a_past_marker(session):
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="never_live", settings={}), session=session, _=None)
    autoscan = result["rows"][0]
    assert {t["reason"] for t in autoscan["ticks"]} == {"match_end_check"}
    assert autoscan["past"][0]["reason"] == "match_start_check"


def test_preview_match_setting_change_shifts_end_check_tick(session):
    a = preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={"match_duration_min": "60"}), session=session, _=None)
    b = preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={"match_duration_min": "120"}), session=session, _=None)
    end_a = next(t for t in a["rows"][0]["ticks"] if t["reason"] == "match_end_check")["planned_at"]
    end_b = next(t for t in b["rows"][0]["ticks"] if t["reason"] == "match_end_check")["planned_at"]
    assert end_a != end_b


def test_preview_scenario_never_commits_candidate_settings(session):
    session.add(AppSetting(key="match_duration_min", value="90"))
    session.commit()

    preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={"match_duration_min": "5"}), session=session, _=None)

    row = session.get(AppSetting, "match_duration_min")
    assert row.value == "90"


def test_preview_poule_unknown_start_returns_recheck_ticks(session):
    result = preview_scenario(PreviewScenarioIn(scope="poule", scenario="unknown_start", settings={}), session=session, _=None)
    ticks = result["rows"][0]["ticks"]
    assert ticks and all(t["reason"] == "unknown_start_recheck" for t in ticks)


def test_preview_match_scope_no_longer_accepts_unknown_start(session):
    import pytest
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        preview_scenario(PreviewScenarioIn(scope="match", scenario="unknown_start", settings={}), session=session, _=None)


def test_preview_poule_healthy_marks_ticks_skipped(session):
    result = preview_scenario(PreviewScenarioIn(scope="poule", scenario="healthy", settings={}), session=session, _=None)
    ticks = result["rows"][0]["ticks"]
    assert ticks and all(t["skipped"] for t in ticks)


def test_preview_club_scan_never_lands_on_weekend(session):
    result = preview_scenario(PreviewScenarioIn(scope="club", scenario="club_scan", settings={"club_scan_days": "1"}), session=session, _=None)
    for t in result["rows"][0]["ticks"]:
        dow = datetime.fromisoformat(t["planned_at"].rstrip("Z")).weekday()
        assert dow < 5


def test_preview_season_manual_weekly_spreads_over_5_competitions(session):
    result = preview_scenario(PreviewScenarioIn(scope="season", scenario="manual_weekly", settings={}), session=session, _=None)
    ticks = result["rows"][0]["ticks"]
    assert len(ticks) == 5


def test_preview_unknown_scope_raises(session):
    import pytest
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        preview_scenario(PreviewScenarioIn(scope="nope", scenario="x", settings={}), session=session, _=None)


def _setup_real_poule_for_shadow_run(session):
    comp = HockeyCompetition(
        external_id="test|shadow-run-comp", name="Shadow Run Comp", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=777, name="Shadow Poule", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=42, club_external_id="HH11ZZ0", name="Shadow Team", short_name="H9",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=777,
    ))
    session.add(HockeyPouleMatch(
        poule_id=777, match_id=1, home_team_id=42, away_team_id=43,
        match_date=(datetime.utcnow().replace(microsecond=0)).isoformat(), status="",
    ))
    session.commit()
    return poule


def test_shadow_run_returns_totals_and_by_reason(session):
    _setup_real_poule_for_shadow_run(session)
    result = shadow_run(ShadowRunIn(settings={}, horizon_days=14), session=session, _=None)
    assert result["totals"]["planned"] >= 1
    assert sum(result["by_reason"].values()) == result["totals"]["planned"]
    assert result["totals"]["matches_filter"] <= result["totals"]["planned"]


def test_shadow_run_leaves_schedule_summary_unchanged(session):
    _setup_real_poule_for_shadow_run(session)
    before = schedule_summary(session=session, _=None)
    shadow_run(ShadowRunIn(settings={"match_duration_min": "45"}, horizon_days=14), session=session, _=None)
    after = schedule_summary(session=session, _=None)
    assert before == after


def test_shadow_run_queue_filter_reduces_matches_filter_count(session):
    _setup_real_poule_for_shadow_run(session)
    unfiltered = shadow_run(ShadowRunIn(settings={}, categories=[], horizon_days=14), session=session, _=None)
    filtered = shadow_run(ShadowRunIn(settings={}, categories=["Junioren"], horizon_days=14), session=session, _=None)
    assert filtered["totals"]["matches_filter"] <= unfiltered["totals"]["matches_filter"]
