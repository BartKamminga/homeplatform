"""Tests voor het _call_poule_capture/upsert_poule_capture-paar
(refactor-plan hockey-inside Fase 1/2, RFTR-B1/B2) - beide paden delen nu
apply_poule_capture (services/hockey_poule_capture_core.py). De
ZA-dead-code-divergentie die upsert_poule_capture voorheen had (hockey_type
= body.hockey_type or "VE" maakte de ZA-fallback onbereikbaar) is met de
samenvoeging structureel opgelost - beide paden geven nu dezelfde,
correcte ZA-fallback."""

from unittest.mock import patch

from sqlmodel import select

from models.hockey_discovery import HockeyCompetition, HockeyTeam
from models.settings import AppSetting
from routers.hockey_capture import MatchIn, PouleCaptureIn, TeamInPoule, upsert_poule_capture
from services.hockey_poule_capture_core import apply_poule_capture, notify_finished_matches
from services.hockey_vanger_ingest import _call_poule_capture
from services.hockey_vanger_settings import get_target_season


def _body(poule_id, team_id, team_name, **kw):
    defaults = dict(
        poule_id=poule_id, poule_name="Poule A", competition_name="Test Comp",
        class_name="1e klasse", district="Noord-Holland", hockey_type="", season="2026-2027",
        teams_in_poule=[TeamInPoule(id=team_id, name=team_name, short_name=team_name,
                                     federation_reference_id="HH11XX0")],
    )
    defaults.update(kw)
    return PouleCaptureIn(**defaults)


def test_call_poule_capture_falls_back_to_za_for_z_prefixed_team_without_hockey_type(session):
    body = _body(poule_id=1, team_id=1, team_name="zJO16-1")
    _call_poule_capture(body, session)
    session.commit()

    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 1)).first()
    assert team.hockey_type == "ZA"


def test_upsert_poule_capture_falls_back_to_za_for_z_prefixed_team_without_hockey_type(session):
    # Was de dode ZA-fallback-tak (RFTR-B2: gefixt door samenvoeging met
    # _call_poule_capture's kern in apply_poule_capture).
    body = _body(poule_id=2, team_id=2, team_name="zJO16-2")
    upsert_poule_capture(body, session=session, _=None)

    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 2)).first()
    assert team.hockey_type == "ZA"


def test_both_paths_upsert_the_same_competition_and_poule_for_identical_input(session):
    body1 = _body(poule_id=10, team_id=10, team_name="JO16-1", hockey_type="VE")
    _call_poule_capture(body1, session)
    session.commit()

    body2 = _body(poule_id=11, team_id=11, team_name="JO16-2", hockey_type="VE")
    upsert_poule_capture(body2, session=session, _=None)

    comps = session.exec(select(HockeyCompetition).where(HockeyCompetition.name == "Test Comp")).all()
    # Beide paden hergebruiken (of maken) dezelfde competitie-rij voor
    # naam+klasse+seizoen - geen duplicaat per capture-pad.
    assert len(comps) == 1
    assert comps[0].class_name == "1e klasse"


# ── item 1001, Fase A: "wedstrijd net final geworden"-detectie ──────────

def _match(match_id, status, home_score=None, away_score=None):
    return MatchIn(
        match_id=match_id, home_team_id=100, home_team_name="Home",
        away_team_id=200, away_team_name="Away", match_date="2026-08-29",
        status=status, home_score=home_score, away_score=away_score,
    )


def test_apply_poule_capture_reports_a_match_that_just_became_final(session):
    target_season = get_target_season(session)
    body1 = _body(poule_id=50, team_id=50, team_name="JO16-50",
                   matches_data=[_match(1, "scheduled")])
    result1 = apply_poule_capture(session, body1, target_season)
    session.commit()
    assert result1.newly_finished == []

    body2 = _body(poule_id=50, team_id=50, team_name="JO16-50",
                   matches_data=[_match(1, "final", home_score=3, away_score=1)])
    result2 = apply_poule_capture(session, body2, target_season)
    session.commit()

    assert len(result2.newly_finished) == 1
    assert result2.newly_finished[0]["home_score"] == 3
    assert result2.newly_finished[0]["away_score"] == 1


def test_apply_poule_capture_does_not_report_an_already_final_match_again(session):
    # Voorkomt dubbele meldingen bij een gewone herscan van een al-afgeronde
    # wedstrijd (bv. late standen-correctie).
    target_season = get_target_season(session)
    body1 = _body(poule_id=51, team_id=51, team_name="JO16-51",
                   matches_data=[_match(2, "final", home_score=2, away_score=2)])
    apply_poule_capture(session, body1, target_season)
    session.commit()

    body2 = _body(poule_id=51, team_id=51, team_name="JO16-51",
                   matches_data=[_match(2, "final", home_score=2, away_score=2)])
    result2 = apply_poule_capture(session, body2, target_season)
    session.commit()

    assert result2.newly_finished == []


def test_notify_finished_matches_skips_teams_not_in_notify_setting(session):
    session.add(AppSetting(key="notify_team_ids", value="999"))
    session.commit()

    with patch("services.hockey_poule_capture_core.send_push") as mock_send_push:
        sent = notify_finished_matches(session, [
            {"home_team_id": 100, "home_team_name": "Home", "away_team_id": 200,
             "away_team_name": "Away", "home_score": 1, "away_score": 0},
        ])

    assert sent == 0
    mock_send_push.assert_not_called()


def test_notify_finished_matches_sends_for_a_followed_team(session):
    session.add(AppSetting(key="notify_team_ids", value="200, 300"))
    session.commit()

    with patch("services.hockey_poule_capture_core.send_push", return_value=1) as mock_send_push:
        sent = notify_finished_matches(session, [
            {"home_team_id": 100, "home_team_name": "Home", "away_team_id": 200,
             "away_team_name": "Away", "home_score": 1, "away_score": 0},
        ])

    assert sent == 1
    mock_send_push.assert_called_once()
    assert "Home 1 - 0 Away" in mock_send_push.call_args.kwargs["title"]
