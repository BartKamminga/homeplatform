"""Tests voor item 990: een team dat in hetzelfde seizoen ook in een 2e
competitie speelt (bv. een bekertoernooi naast de reguliere competitie)
mag niet zijn primaire poule (HockeyTeam.recent_poule_id) verliezen -
apply_poule_capture (services/hockey_poule_capture_core.py) moet de 2e
poule als extra koppeling (HockeyTeamPoule) toevoegen i.p.v. overschrijven."""

from sqlmodel import select

from models.hockey_discovery import HockeyTeam, HockeyTeamPoule
from routers.hockey_capture import PouleCaptureIn, TeamInPoule
from services.hockey_poule_capture_core import apply_poule_capture

TARGET_SEASON = "2026-2027"


def _body(poule_id, competition_name, team_id, team_name="H1", **kw):
    defaults = dict(
        poule_id=poule_id, poule_name="Poule " + str(poule_id), competition_name=competition_name,
        class_name="1e klasse", district="Noord-Holland", hockey_type="VE", season=TARGET_SEASON,
        teams_in_poule=[TeamInPoule(id=team_id, name=team_name, short_name=team_name,
                                     federation_reference_id="HH11XX0")],
    )
    defaults.update(kw)
    return PouleCaptureIn(**defaults)


def test_second_poule_from_a_different_competition_is_added_as_extra_not_overwritten(session):
    apply_poule_capture(session, _body(poule_id=100, competition_name="Test Liga", team_id=1), TARGET_SEASON)
    session.commit()

    apply_poule_capture(session, _body(poule_id=200, competition_name="Test Beker", team_id=1), TARGET_SEASON)
    session.commit()

    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 1)).first()
    assert team.recent_poule_id == 100  # primaire poule blijft ongewijzigd

    extra = session.exec(
        select(HockeyTeamPoule).where(HockeyTeamPoule.team_id == 1).where(HockeyTeamPoule.poule_id == 200)
    ).first()
    assert extra is not None
    assert extra.season == TARGET_SEASON


def test_second_poule_within_the_same_competition_still_overwrites_the_primary(session):
    # Regressie: een team dat binnen dezelfde competitie naar een andere
    # poule verhuist (bv. promotie/degradatie tijdens het seizoen) moet het
    # bestaande overschrijf-gedrag behouden - dat is geen 2e competitie.
    apply_poule_capture(session, _body(poule_id=101, competition_name="Test Liga", team_id=2), TARGET_SEASON)
    session.commit()

    apply_poule_capture(session, _body(poule_id=102, competition_name="Test Liga", team_id=2), TARGET_SEASON)
    session.commit()

    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 2)).first()
    assert team.recent_poule_id == 102

    extra = session.exec(select(HockeyTeamPoule).where(HockeyTeamPoule.team_id == 2)).all()
    assert extra == []


def test_rescanning_an_already_linked_extra_poule_refreshes_it_instead_of_duplicating(session):
    apply_poule_capture(session, _body(poule_id=103, competition_name="Test Liga", team_id=3), TARGET_SEASON)
    session.commit()
    apply_poule_capture(session, _body(poule_id=203, competition_name="Test Beker", team_id=3), TARGET_SEASON)
    session.commit()

    apply_poule_capture(session, _body(poule_id=203, competition_name="Test Beker", team_id=3), TARGET_SEASON)
    session.commit()

    rows = session.exec(
        select(HockeyTeamPoule).where(HockeyTeamPoule.team_id == 3).where(HockeyTeamPoule.poule_id == 203)
    ).all()
    assert len(rows) == 1
