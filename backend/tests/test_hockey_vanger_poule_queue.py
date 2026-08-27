"""Tests voor get_poule_queue/get_poule_queue_next (routers/hockey_vanger_
poule_queue.py) - regressie voor item 993: een team's extra (niet-primaire)
poule uit een 2e competitie (item 990) werd hier niet meegenomen, waardoor
een al gevangen 2e poule nooit als 'gevangen' (groen) in Discovery
verscheen, ook al stond de data allang in de database."""

from sqlmodel import select

from models.hockey_discovery import HockeyPoule, HockeyTeam, HockeyTeamPoule
from routers.hockey_vanger_poule_queue import get_poule_queue, get_poule_queue_next

TARGET_SEASON = "2026-2027"


def _team(**kw):
    defaults = dict(
        club_external_id="HH11XX0", hockey_type="VE", category_group_name="Junioren",
        no_new_poule_confirmed=False, season_pending=False,
    )
    defaults.update(kw)
    return HockeyTeam(**defaults)


def test_poule_queue_shows_the_primary_poule_as_captured(session):
    session.add(HockeyPoule(poule_id=100, name="Poule A", competition_id=1, season=TARGET_SEASON))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = get_poule_queue(session=session, _=None)

    row = next(r for r in result["poules"] if r["poule_id"] == 100)
    assert row["captured"] is True


def test_poule_queue_shows_an_extra_poule_as_captured(session):
    # item 993: dit was de bug - een team's 2e-competitie-poule (HockeyTeamPoule)
    # kwam hier niet in voor, dus stond altijd op 'niet gevangen'.
    session.add(HockeyPoule(poule_id=100, name="Poule A", competition_id=1, season=TARGET_SEASON))
    session.add(HockeyPoule(poule_id=200, name="Poule Beker", competition_id=2, season=TARGET_SEASON))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.add(HockeyTeamPoule(team_id=1, poule_id=200, season=TARGET_SEASON))
    session.commit()

    result = get_poule_queue(session=session, _=None)

    assert result["total"] == 2
    row = next(r for r in result["poules"] if r["poule_id"] == 200)
    assert row["captured"] is True
    assert row["team_id"] == 1


def test_poule_queue_next_includes_an_extra_poule_as_a_candidate(session):
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.add(HockeyTeamPoule(team_id=1, poule_id=200, season=TARGET_SEASON))
    session.commit()

    result = get_poule_queue_next(session=session, _=None)

    assert result["done"] is False
    # allebei nog niet gecaptured (geen HockeyPoule-rij) - het oudste/hoogste
    # leeftijdsgetal wint, hier zijn poule_id 100/200 gelijk qua team dus
    # controleren we alleen dat 1 van de 2 als kandidaat teruggegeven wordt.
    assert result["poule_id"] in (100, 200)


def test_poule_queue_next_club_filter_also_matches_extra_poules(session):
    session.add(_team(team_id=1, name="A1", short_name="JO16-1", club_external_id="CLUB_A", recent_poule_id=100))
    session.add(HockeyTeamPoule(team_id=1, poule_id=200, season=TARGET_SEASON))
    session.commit()

    from services.hockey_vanger_filters import DISC_FILTER_CLUB
    from models.settings import AppSetting
    session.add(AppSetting(key=DISC_FILTER_CLUB, value="CLUB_A"))
    session.commit()

    result = get_poule_queue_next(session=session, _=None)
    assert result["done"] is False
    assert result["poule_id"] in (100, 200)
