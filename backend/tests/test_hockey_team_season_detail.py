"""Tests voor item 994: season-scoped teams-response (list_youth_teams) en
het nieuwe teamdetail-endpoint (get_team_detail) - regressie voor de
seizoen-wissel-bug uit item 993 (Discovery > Clubs veranderde niet bij het
wisselen van seizoen)."""

from models.hockey_discovery import (
    HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding,
    HockeyTeam, HockeyTeamPoule,
)
from models.settings import AppSetting
from routers.hockey_capture import DISC_TARGET_SEASON
from routers.hockey_clubs import list_youth_teams
from routers.hockey_team_detail import get_team_detail

CURRENT_SEASON = "2026-2027"
OLD_SEASON = "2024-2025"


def _team(**kw):
    defaults = dict(
        club_external_id="HH11XX0", hockey_type="VE", category_group_name="Junioren",
        no_new_poule_confirmed=False, season_pending=False,
    )
    defaults.update(kw)
    return HockeyTeam(**defaults)


def test_teams_without_season_param_is_unchanged(session):
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = list_youth_teams(session=session, _=None)

    assert result["teams"][0]["recent_poule_id"] == 100


def test_teams_with_season_param_hides_a_primary_poule_captured_for_another_season(session):
    session.add(AppSetting(key=DISC_TARGET_SEASON, value=CURRENT_SEASON))
    session.add(HockeyPoule(poule_id=100, name="Poule A", competition_id=1, season=OLD_SEASON))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = list_youth_teams(session=session, season=CURRENT_SEASON, _=None)
    assert result["teams"][0]["recent_poule_id"] is None

    result_old = list_youth_teams(session=session, season=OLD_SEASON, _=None)
    assert result_old["teams"][0]["recent_poule_id"] == 100


def test_teams_with_season_param_keeps_an_uncaptured_primary_poule_for_the_target_season(session):
    session.add(AppSetting(key=DISC_TARGET_SEASON, value=CURRENT_SEASON))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = list_youth_teams(session=session, season=CURRENT_SEASON, _=None)
    assert result["teams"][0]["recent_poule_id"] == 100

    result_old = list_youth_teams(session=session, season=OLD_SEASON, _=None)
    assert result_old["teams"][0]["recent_poule_id"] is None


def test_teams_with_season_param_filters_extra_poules_by_season(session):
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.add(HockeyTeamPoule(team_id=1, poule_id=200, season=CURRENT_SEASON))
    session.add(HockeyTeamPoule(team_id=1, poule_id=201, season=OLD_SEASON))
    session.commit()

    result = list_youth_teams(session=session, season=CURRENT_SEASON, _=None)
    assert result["teams"][0]["extra_poule_ids"] == [200]

    result_old = list_youth_teams(session=session, season=OLD_SEASON, _=None)
    assert result_old["teams"][0]["extra_poule_ids"] == [201]


def test_team_detail_returns_primary_and_extra_poule_with_standings_and_matches(session):
    comp = HockeyCompetition(id=1, external_id="c1", name="Hoofdklasse", class_name="Landelijk", season=CURRENT_SEASON)
    session.add(comp)
    session.add(HockeyPoule(poule_id=100, name="Poule A", competition_id=1, season=CURRENT_SEASON))
    session.add(HockeyPoule(poule_id=200, name="Poule Beker", competition_id=1, season=CURRENT_SEASON))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.add(HockeyTeamPoule(team_id=1, poule_id=200, season=CURRENT_SEASON))
    session.add(HockeyPouleStanding(poule_id=100, team_id=1, team_name="Team A", position=1, played=3, points=9))
    session.add(HockeyPouleMatch(poule_id=100, match_id=555, home_team_id=1, home_team_name="Team A", away_team_id=2, away_team_name="Team B", round=1))
    session.commit()

    result = get_team_detail(team_id=1, season=CURRENT_SEASON, session=session, _=None)

    assert result["team"]["team_id"] == 1
    pids = {p["poule_id"] for p in result["poules"]}
    assert pids == {100, 200}
    primary = next(p for p in result["poules"] if p["poule_id"] == 100)
    assert primary["is_primary"] is True
    assert primary["captured"] is True
    assert primary["own_standing"]["points"] == 9
    assert len(primary["matches"]) == 1
    extra = next(p for p in result["poules"] if p["poule_id"] == 200)
    assert extra["is_primary"] is False


def test_team_detail_for_a_season_with_no_matching_poules_returns_empty_list(session):
    session.add(AppSetting(key=DISC_TARGET_SEASON, value=CURRENT_SEASON))
    session.add(HockeyPoule(poule_id=100, name="Poule A", competition_id=1, season=CURRENT_SEASON))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = get_team_detail(team_id=1, season=OLD_SEASON, session=session, _=None)
    assert result["poules"] == []
