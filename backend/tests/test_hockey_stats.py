"""Tests voor de Stats-tab data-kwaliteit-uitbreiding (roadmap item 974):
autoscan/wedstrijden-kolommen in stats/by-season en het nieuwe
stats/data-quality-endpoint."""

from datetime import datetime, timedelta

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding, HockeyTeam,
)
from routers.hockey_capture import get_data_quality, get_stats_by_season


def test_stats_by_season_reports_matches_and_autoscan(session):
    comp = HockeyCompetition(
        external_id="test|by-season", name="Test Comp", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    session.add(HockeyPoule(poule_id=1, name="Poule A", competition_id=comp.id, season="2026-2027"))
    session.add(HockeyPoule(poule_id=2, name="Poule B", competition_id=comp.id, season="2026-2027"))
    session.add(HockeyPouleMatch(poule_id=1, match_id=1, status="final"))
    session.add(HockeyPouleMatch(poule_id=1, match_id=2, status="final"))
    session.add(HockeyPouleMatch(poule_id=2, match_id=3, status="scheduled"))
    session.commit()

    stats = get_stats_by_season(session=session, _=None)["stats"]
    row = next(s for s in stats if s["season"] == "2026-2027")

    assert row["total_poules"] == 2
    assert row["total_matches"] == 3
    assert row["autoscan_poules"] == 2


def test_data_quality_flags_missing_result_and_unknown_kickoff(session):
    comp = HockeyCompetition(
        external_id="test|dq", name="Test DQ Comp", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    poule = HockeyPoule(poule_id=10, name="Poule A", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=1, club_external_id="HH11XX0", name="Team A", short_name="H1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=10,
    ))

    now = datetime.utcnow()
    yesterday_no_score = (now - timedelta(days=1)).isoformat()
    next_week_no_time  = (now + timedelta(days=2)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    session.add(HockeyPouleMatch(
        poule_id=10, match_id=1, status="final", match_date=yesterday_no_score,
        home_score=None, away_score=None,
    ))
    session.add(HockeyPouleMatch(
        poule_id=10, match_id=2, status="announced", match_date=next_week_no_time,
    ))
    session.commit()

    result = get_data_quality(session=session, _=None)

    assert result["season"] == "2026-2027"
    assert len(result["rows"]) == 1
    row = result["rows"][0]
    assert row["poule_id"] == 10
    assert row["mist_uitslag"] == 1
    assert row["geen_tijd"] == 1
    assert row["week"] == 0
    assert result["total_signaled_poules"] == 1


def test_data_quality_summary_counts(session):
    comp = HockeyCompetition(
        external_id="test|dq-summary", name="Test DQ Summary", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    poule_without_team = HockeyPoule(poule_id=20, name="Poule Zonder Team", competition_id=comp.id, season="2026-2027")
    poule_ghost = HockeyPoule(poule_id=21, name="Ghost Poule", competition_id=comp.id, season="2026-2027")
    session.add(poule_without_team)
    session.add(poule_ghost)
    session.add(HockeyPouleStanding(poule_id=21, team_id=1, team_name="A", points=0))
    session.add(HockeyTeam(
        team_id=2, club_external_id="HH11YY0", name="Pending Team", short_name="H2",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=None, season_pending=True,
    ))
    session.add(HockeyClub(external_id="HH11ZZ0", name="Nooit Gescand", friendly_name="Nooit Gescand", detail_loaded=False))
    session.commit()

    result = get_data_quality(session=session, _=None)

    assert result["poules_without_team"] == 2  # zowel 20 als 21 hebben geen gekoppeld team
    assert result["ghost_poules"] == 1
    assert result["teams_season_pending"] >= 1
    assert result["clubs_never_scanned"] >= 1
