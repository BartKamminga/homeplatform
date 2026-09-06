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
    # item 1090: naast de wedstrijd-balk ook de fase-vensters (Live-check,
    # Eind-check) - Live-recheck ontbreekt hier bewust (nog niet live bevestigd).
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={}), session=session, _=None)
    assert result["now"]
    bars = result["rows"][0]["bars"]
    labels = {b["label"] for b in bars}
    assert labels == {"Wedstrijd", "Live-check", "Eind-check"}
    assert result["rows"][1]["bars"][0]["dimmed"] is True


def test_preview_match_never_live_has_no_start_check_tick_but_a_past_marker(session):
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="never_live", settings={}), session=session, _=None)
    autoscan = result["rows"][0]
    assert {t["reason"] for t in autoscan["ticks"]} == {"match_end_check"}
    assert autoscan["past"][0]["reason"] == "match_start_check"


def test_preview_match_live_confirmed_bars_include_live_recheck_phase(session):
    # item 1090 (Bart, 06-09-2026: "graag de fases weer geven op deze view"):
    # Live-recheck-balk verschijnt alleen als de wedstrijd al bevestigd live
    # is (normal/never_live/runs_over hebben dit niet).
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="live_confirmed", settings={}), session=session, _=None)
    labels = {b["label"] for b in result["rows"][0]["bars"]}
    assert labels == {"Wedstrijd", "Live-check", "Live-recheck", "Eind-check"}


def test_preview_match_phase_bars_are_anchored_on_their_own_trigger(session):
    # Live-check-venster begint op de starttijd zelf (niet pas bij de eerste
    # tick, die een cadans-stap later valt) - Eind-check-venster begint op
    # het voorspelde einde.
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={}), session=session, _=None)
    bars = {b["label"]: b for b in result["rows"][0]["bars"]}
    assert bars["Live-check"]["from"] == bars["Wedstrijd"]["from"]
    assert bars["Eind-check"]["from"] == bars["Wedstrijd"]["to"]


def test_preview_match_setting_change_shifts_end_check_tick(session):
    a = preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={"match_duration_min": "60"}), session=session, _=None)
    b = preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={"match_duration_min": "120"}), session=session, _=None)
    end_a = next(t for t in a["rows"][0]["ticks"] if t["reason"] == "match_end_check")["planned_at"]
    end_b = next(t for t in b["rows"][0]["ticks"] if t["reason"] == "match_end_check")["planned_at"]
    assert end_a != end_b


def test_preview_match_live_confirmed_shows_a_real_retry_series(session):
    # Bart, 4-09-2026: "ik zie het wel in tekst staan maar niet in scan's en
    # dat wil ik juist" - meerdere match_live-ticks, elk live_recheck_
    # cadence_min uit elkaar (item 1090: fase 2, vaste cadans, i.t.t. fase
    # 3's oplopende backoff), i.p.v. 1 tick met een tekstuele toelichting.
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="live_confirmed", settings={"live_recheck_cadence_min": "10"}), session=session, _=None)
    live_ticks = [t for t in result["rows"][0]["ticks"] if t["reason"] == "match_live"]
    assert len(live_ticks) >= 2
    from datetime import datetime
    times = [datetime.fromisoformat(t["planned_at"].rstrip("Z")) for t in live_ticks]
    gaps = [(b - a).total_seconds() / 60 for a, b in zip(times, times[1:])]
    assert all(abs(g - 10) < 0.01 for g in gaps)


def test_preview_match_runs_over_shows_an_escalating_retry_series(session):
    # item 1090 (Bart, 06-09-2026: "8, 8*2, 8*3... tussentijd"): fase 3's
    # retry-cadans loopt op i.p.v. vast te staan - elke volgende tussenpoos
    # groter dan de vorige.
    result = preview_scenario(PreviewScenarioIn(scope="match", scenario="runs_over", settings={"end_check_cadence_min": "8"}), session=session, _=None)
    retry_ticks = [t for t in result["rows"][0]["ticks"] if t["reason"] == "retry_match_end"]
    assert len(retry_ticks) >= 3
    from datetime import datetime
    times = [datetime.fromisoformat(t["planned_at"].rstrip("Z")) for t in retry_ticks]
    gaps = [(b - a).total_seconds() / 60 for a, b in zip(times, times[1:])]
    assert all(b > a for a, b in zip(gaps, gaps[1:]))


def test_preview_match_live_series_stops_at_predicted_end_independent_of_end_check_window(session):
    # item 1090 (was: burst_stop_hours_after_last_match): fase 2 (Live-
    # recheck) loopt tot het voorspelde einde, ONAFHANKELIJK van
    # end_check_window_min - dat begrenst alleen fase 3 (de escalerende
    # eind-check-backoff die erna komt).
    short = preview_scenario(PreviewScenarioIn(scope="match", scenario="live_confirmed", settings={"live_recheck_cadence_min": "10", "end_check_window_min": "60"}), session=session, _=None)
    long = preview_scenario(PreviewScenarioIn(scope="match", scenario="live_confirmed", settings={"live_recheck_cadence_min": "10", "end_check_window_min": "600"}), session=session, _=None)
    short_live = len([t for t in short["rows"][0]["ticks"] if t["reason"] == "match_live"])
    long_live = len([t for t in long["rows"][0]["ticks"] if t["reason"] == "match_live"])
    assert short_live == long_live  # onafhankelijk van end_check_window_min
    short_retry = len([t for t in short["rows"][0]["ticks"] if t["reason"] == "retry_match_end"])
    long_retry = len([t for t in long["rows"][0]["ticks"] if t["reason"] == "retry_match_end"])
    assert long_retry > short_retry  # wél begrensd door end_check_window_min


def test_preview_scenario_never_commits_candidate_settings(session):
    session.add(AppSetting(key="match_duration_min", value="90"))
    session.commit()

    preview_scenario(PreviewScenarioIn(scope="match", scenario="normal", settings={"match_duration_min": "5"}), session=session, _=None)

    row = session.get(AppSetting, "match_duration_min")
    assert row.value == "90"


def test_preview_match_scope_no_longer_accepts_unknown_start(session):
    import pytest
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        preview_scenario(PreviewScenarioIn(scope="match", scenario="unknown_start", settings={}), session=session, _=None)


def test_preview_poule_scope_returns_the_3_situations_regardless_of_scenario(session):
    # item 1084 (Bart, 4-09-2026: "geen sub keuze"): Poule & Competitie
    # heeft geen scenario-tabs meer - retourneert altijd alle 3 situaties
    # samen, wat er ook als scenario wordt meegegeven.
    result = preview_scenario(PreviewScenarioIn(scope="poule", scenario="anything", settings={}), session=session, _=None)
    assert [r["key"] for r in result["rows"]] == ["up_to_date", "missing_result", "missing_start_time"]


def test_preview_poule_up_to_date_marks_ticks_skipped(session):
    result = preview_scenario(PreviewScenarioIn(scope="poule", scenario="x", settings={}), session=session, _=None)
    up_to_date = next(r for r in result["rows"] if r["key"] == "up_to_date")
    assert up_to_date["ticks"] and all(t["skipped"] for t in up_to_date["ticks"])


def test_preview_poule_missing_start_time_returns_recheck_ticks(session):
    result = preview_scenario(PreviewScenarioIn(scope="poule", scenario="x", settings={}), session=session, _=None)
    row = next(r for r in result["rows"] if r["key"] == "missing_start_time")
    assert row["ticks"] and all(t["reason"] == "unknown_start_recheck" for t in row["ticks"])


def test_preview_poule_missing_result_returns_daily_fallback_ticks(session):
    result = preview_scenario(PreviewScenarioIn(scope="poule", scenario="x", settings={}), session=session, _=None)
    row = next(r for r in result["rows"] if r["key"] == "missing_result")
    assert row["ticks"] and all(t["reason"] == "daily_fallback" for t in row["ticks"])


def test_preview_club_scope_returns_both_rows_regardless_of_scenario(session):
    # item 1084 (Bart, 4-09-2026: "pak maar op" - Club dezelfde behandeling
    # als Poule & Competitie): geen scenario-tabs meer - altijd beide
    # activiteiten samen.
    result = preview_scenario(PreviewScenarioIn(scope="club", scenario="anything", settings={}), session=session, _=None)
    assert [r["key"] for r in result["rows"]] == ["club_scan", "club_list"]


def test_preview_club_scan_never_lands_on_weekend(session):
    result = preview_scenario(PreviewScenarioIn(scope="club", scenario="x", settings={"club_scan_days": "1"}), session=session, _=None)
    club_scan_row = next(r for r in result["rows"] if r["key"] == "club_scan")
    for t in club_scan_row["ticks"]:
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
