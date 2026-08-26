"""Tests voor de matchday-interval-toggle in _step_active_profiles (item 968)."""

from datetime import datetime, timedelta

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam
from models.settings import AppSetting
from services.hockey_vanger_scanplan import ACTIVE_MATCHDAY_ENABLED_KEY, _step_active_profiles


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
