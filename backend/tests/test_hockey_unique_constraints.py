"""Tests voor de nieuwe DB-unique-constraints (refactor-plan hockey-inside
Fase 4a-4c, RFTR-B4, roadmap 987) - eerder alleen applicatie-laag-guards,
precies het soort gat dat de hl_comp_id-productiebug deze sessie mogelijk
maakte. Bevestigt dat de database zelf nu ook een dubbele combinatie weigert,
niet alleen de code eromheen."""

import pytest
from sqlalchemy.exc import IntegrityError

from models.hockey_discovery import HockeyCompetition, HockeyPouleMatch, HockeyPouleStanding


def _comp(**kw):
    defaults = dict(external_id="ext-" + str(id(kw)), name="Comp", class_name="1e klasse", season="2026-2027")
    defaults.update(kw)
    return HockeyCompetition(**defaults)


def test_duplicate_hl_comp_id_is_rejected_by_the_database(session):
    session.add(_comp(external_id="a", hl_comp_id=21))
    session.commit()

    session.add(_comp(external_id="b", hl_comp_id=21))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_multiple_null_hl_comp_id_are_allowed(session):
    session.add(_comp(external_id="a", hl_comp_id=None))
    session.add(_comp(external_id="b", hl_comp_id=None))
    session.commit()  # geen IntegrityError - NULL wordt niet als duplicaat gezien


def test_duplicate_poule_team_standing_is_rejected_by_the_database(session):
    session.add(HockeyPouleStanding(poule_id=1, team_id=1, team_name="Team A"))
    session.commit()

    session.add(HockeyPouleStanding(poule_id=1, team_id=1, team_name="Team A (dup)"))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_duplicate_poule_match_id_is_rejected_but_multiple_null_match_ids_allowed(session):
    session.add(HockeyPouleMatch(poule_id=1, match_id=100))
    session.commit()

    session.add(HockeyPouleMatch(poule_id=1, match_id=100))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

    session.add(HockeyPouleMatch(poule_id=1, match_id=None))
    session.add(HockeyPouleMatch(poule_id=1, match_id=None))
    session.commit()  # match_id ontbreekt vaak (wedstrijd zonder hockey.nl-id) - geen duplicaat
