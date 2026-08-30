"""Tests voor de matchday-interval-toggle in _step_active_profiles (item 968)."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, VangerCmd
from models.settings import AppSetting
from services.hockey_vanger_scanplan import (
    ACTIVE_MATCHDAY_ENABLED_KEY, _manual_scan_weekday, _reclaim_stale_in_progress,
    _step_active_profiles, _step_manual_profiles_weekly, _step_new_or_empty_poules,
)


def _next_weekday(base, weekday):
    """Eerstvolgende datum (op of na base) die op de gevraagde ISO-weekday valt
    (maandag=0 .. zondag=6) - zodat de maandag/vrijdag-tests niet afhangen van
    de dag waarop ze toevallig draaien."""
    days_ahead = (weekday - base.weekday()) % 7
    return base + timedelta(days=days_ahead)


def _setup_active_competition(session, now, last_scanned_at):
    comp = HockeyCompetition(
        external_id="test|matchday-comp", name="Matchday Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(
        poule_id=444, name="Poule Z", competition_id=comp.id, season="2026-2027",
        last_scanned_at=last_scanned_at,
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=9, club_external_id="HH11ZZ0", name="Matchday Team", short_name="H9",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=444,
    ))
    # Wedstrijd van vandaag, ruim afgelopen (dus in principe "matchday due").
    match_start = now - timedelta(hours=3)
    session.add(HockeyPouleMatch(
        poule_id=444, match_id=7001, home_team_id=9, away_team_id=10,
        status="finished", round=1, match_date=match_start.isoformat(),
    ))
    session.commit()
    return poule


def test_matchday_boost_triggers_early_rescan_when_enabled(session):
    now = datetime.utcnow()
    # 2 uur geleden gescand - binnen de dagelijkse fallback (24u), dus dat
    # alleen zou "niet due" opleveren; de matchday-boost (45 min) moet 'm alsnog
    # oppikken omdat de wedstrijd van vandaag al voorbij is.
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    added = _step_active_profiles(session, now, cap=10)
    assert added == 1


def test_matchday_boost_disabled_falls_back_to_daily_interval(session):
    now = datetime.utcnow()
    session.add(AppSetting(key=ACTIVE_MATCHDAY_ENABLED_KEY, value="0"))
    session.commit()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    added = _step_active_profiles(session, now, cap=10)
    assert added == 0  # 2u geleden gescand, binnen de 24u-fallback -> niet due


def test_matchday_boost_disabled_still_uses_daily_fallback_when_stale(session):
    now = datetime.utcnow()
    session.add(AppSetting(key=ACTIVE_MATCHDAY_ENABLED_KEY, value="0"))
    session.commit()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))

    added = _step_active_profiles(session, now, cap=10)
    assert added == 1  # ouder dan de dagelijkse fallback -> alsnog due


# ── stale in_progress reclaim (roadmap-melding 29-08-2026) ──────────────

def test_reclaim_resets_a_cmd_stuck_in_progress_past_the_timeout(session):
    now = datetime.utcnow()
    session.add(VangerCmd(
        cmd_type="get_poule", params='{"poule_id": 1}', status="in_progress",
        started_at=now - timedelta(minutes=20),
    ))
    session.commit()

    reclaimed = _reclaim_stale_in_progress(session, now)

    assert reclaimed == 1
    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.status == "failed"
    assert cmd.finished_at == now
    assert "Timeout" in cmd.error


def test_reclaim_leaves_a_recently_started_cmd_alone(session):
    now = datetime.utcnow()
    session.add(VangerCmd(
        cmd_type="get_poule", params='{"poule_id": 1}', status="in_progress",
        started_at=now - timedelta(minutes=2),
    ))
    session.commit()

    reclaimed = _reclaim_stale_in_progress(session, now)

    assert reclaimed == 0
    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.status == "in_progress"


def test_reclaim_timeout_is_configurable(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="stale_cmd_timeout_min", value="2"))
    session.add(VangerCmd(
        cmd_type="get_poule", params='{"poule_id": 1}', status="in_progress",
        started_at=now - timedelta(minutes=5),
    ))
    session.commit()

    reclaimed = _reclaim_stale_in_progress(session, now)

    assert reclaimed == 1


# ── item 1013: landelijke competities niet los per poule scannen ────────

def test_step_active_profiles_skips_a_poule_from_an_hl_comp_id_competition(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    comp = session.get(HockeyCompetition, poule.competition_id)
    comp.hl_comp_id = 21
    session.add(comp)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0  # zou zonder de guard due zijn (25u > 24u fallback)


def test_step_new_or_empty_poules_skips_a_poule_from_an_hl_comp_id_competition(session):
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|hl-comp", name="Landelijk Test", class_name="Topklasse",
        hockey_type="VE", season="2026-2027", hl_comp_id=99,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    poule = HockeyPoule(poule_id=555, name="Poule Z", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=42, club_external_id="HH11ZZ0", name="Test Team", short_name="H1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=555,
    ))
    session.commit()

    added = _step_new_or_empty_poules(session, "2026-2027", cap=10)

    assert added == 0  # poule heeft geen matches, zou anders opgepakt worden


# ── item 970: live-check kort na aanvang van de wedstrijd ────────────────

def test_step_active_profiles_triggers_a_one_time_live_check_shortly_after_kickoff(session):
    now = datetime.utcnow()
    # Wedstrijd 20 minuten geleden begonnen, nog lang niet afgelopen (90 min
    # duur) - buiten de matchday-boost (die pas na afloop reageert) en
    # buiten de dagelijkse fallback (recent gescand). Default
    # live_check_delay_min=15 -> we zitten nu in het live-check-venster.
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = (now - timedelta(minutes=20)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1


def test_live_check_does_not_fire_again_after_it_already_ran(session):
    now = datetime.utcnow()
    match_start = now - timedelta(minutes=20)
    # last_scanned_at ligt NA de wedstrijdstart - de live-check is dus al
    # eerder deze wedstrijd gedaan, mag niet nogmaals vuren.
    poule = _setup_active_competition(session, now, last_scanned_at=match_start + timedelta(minutes=1))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = match_start.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


# ── burst-modus stopt zodra alles bekend is of de deadline voorbij is ────

def test_burst_mode_stops_once_all_of_todays_matches_are_final(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(minutes=50))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0  # zonder de all-final-check zou de matchday-boost 'm alsnog due maken


def test_burst_mode_stops_after_the_configured_hours_past_the_last_match(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(minutes=50))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    # Wedstrijd 4u geleden begonnen (dus 2.5u geleden geeindigd bij 90 min
    # duur) - bewust NIET op "final" gezet, om puur de tijd-gebaseerde
    # stopregel te testen (standaard burst_stop_hours_after_last_match=2u
    # is dan al gepasseerd).
    match.match_date = (now - timedelta(hours=4)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


def test_burst_stop_hours_after_last_match_is_configurable(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="burst_stop_hours_after_last_match", value="5"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(minutes=50))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = (now - timedelta(hours=4)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1  # met een ruimere deadline (5u) valt de wedstrijd nog binnen burst-bereik


def test_live_check_delay_is_configurable(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="live_check_delay_min", value="5"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = (now - timedelta(minutes=6)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1


# ── onbekende starttijd binnen X dagen vaker checken ─────────────────────

def test_unknown_start_time_within_lookahead_triggers_a_more_frequent_rescan(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    # Wedstrijd over 3 dagen, datum al bekend maar starttijd nog niet
    # (middernacht-placeholder) - binnen de standaard lookahead van 5 dagen.
    future_date = (now + timedelta(days=3)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1  # 10u geleden gescand > unknown_start_fallback_hours (8u default) -> due


def test_unknown_start_time_beyond_lookahead_does_not_trigger_extra_rescan(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    future_date = (now + timedelta(days=20)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0  # 20 dagen vooruit valt buiten de standaard 5-dagen-lookahead


def test_unknown_start_lookahead_days_is_configurable(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="unknown_start_lookahead_days", value="30"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    future_date = (now + timedelta(days=20)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1


# ── item: niet-autoscan (scan_profile='manual') publicaties 1x per week,
# verdeeld over maandag/vrijdag ───────────────────────────────────────────

def _setup_manual_competition(session, comp_id_hint, last_scanned_at):
    comp = HockeyCompetition(
        external_id=f"test|manual-{comp_id_hint}", name=f"Manual Test {comp_id_hint}", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    poule = HockeyPoule(
        poule_id=9000 + comp_id_hint, name="Poule M", competition_id=comp.id, season="2026-2027",
        last_scanned_at=last_scanned_at,
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=9000 + comp_id_hint, club_external_id="HH11ZZ0", name="Manual Team", short_name="M1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=poule.poule_id,
    ))
    session.commit()
    session.refresh(comp)
    session.refresh(poule)
    return comp, poule


def test_manual_profile_scans_on_its_assigned_weekday(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=1, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 1


def test_manual_profile_does_not_scan_on_the_other_weekday(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=2, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    target_weekday = _manual_scan_weekday(comp.id)
    other_weekday = (target_weekday + 1) % 5
    now = _next_weekday(datetime.utcnow(), other_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 0


def test_manual_profile_skips_if_recently_scanned(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=3, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)
    poule.last_scanned_at = now - timedelta(days=1)
    session.add(poule)
    session.commit()

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 0


def test_manual_profiles_weekly_ignores_active_scan_profile_competitions(session):
    now_monday = _next_weekday(datetime.utcnow(), 0).replace(hour=10, minute=0, second=0, microsecond=0)
    _setup_active_competition(session, now_monday, last_scanned_at=now_monday - timedelta(days=10))

    added = _step_manual_profiles_weekly(session, now_monday, cap=10)

    assert added == 0


def test_manual_profiles_weekly_skips_a_landelijke_competition(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=4, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    comp.hl_comp_id = 55
    session.add(comp)
    session.commit()
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 0  # al gedekt door _step_landelijke_competitions


# ── reason wordt getagd op de aangemaakte VangerCmd (scan-historie) ──────

def test_matchday_burst_cmd_is_tagged_with_its_reason(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    _step_active_profiles(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "matchday_burst"


def test_live_check_cmd_is_tagged_with_its_reason(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = (now - timedelta(minutes=20)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    _step_active_profiles(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "live_check"


def test_daily_fallback_cmd_is_tagged_with_its_reason(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"  # burst uitgeschakeld, puur de dagelijkse fallback testen
    session.add(match)
    session.commit()

    _step_active_profiles(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "daily_fallback"


def test_manual_weekly_cmd_is_tagged_with_its_reason(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=10, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    _step_manual_profiles_weekly(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "manual_weekly"
