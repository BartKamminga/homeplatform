"""Karakteriseringstests voor het _call_poule_capture/upsert_poule_capture-
paar (refactor-plan hockey-inside Fase 1, RFTR-B1) - vastleggen van het
huidige gedrag VOORDAT Fase 2 (RFTR-B2) ze samenvoegt tot een gedeelde kern.
Inclusief een test die de bekende ZA-dead-code-divergentie in
upsert_poule_capture bewust tegen het HUIDIGE (foute) gedrag test, zodat de
samenvoeging in B2 een verifieerbare bugfix is, geen stille gedragswijziging."""

from sqlmodel import select

from models.hockey_discovery import HockeyCompetition, HockeyTeam
from routers.hockey_capture import PouleCaptureIn, TeamInPoule, upsert_poule_capture
from services.hockey_vanger_ingest import _call_poule_capture


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


def test_upsert_poule_capture_dead_code_currently_defaults_to_ve_for_z_prefixed_team(session):
    # BUG (bekend, wordt gefixt in RFTR-B2 door samenvoeging met apply_poule_capture):
    # hockey_capture.py:265 zet hockey_type = body.hockey_type or "VE" - dat maakt
    # hockey_type altijd truthy, dus de daaropvolgende "if not hockey_type"-tak
    # (de ZA-fallback) is dode code. Deze test legt het HUIDIGE, foute gedrag vast.
    body = _body(poule_id=2, team_id=2, team_name="zJO16-2")
    upsert_poule_capture(body, session=session, _=None)

    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 2)).first()
    assert team.hockey_type == "VE"  # zou "ZA" moeten zijn - zie RFTR-B2


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
