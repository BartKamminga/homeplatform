"""Smoke-tests voor hockey-inside routers zonder eerdere testdekking
(refactor-plan hockey-inside Fase 1, RFTR-B1, punt 7): hockey_clubs.py,
hockey_query.py, hockey_public.py, hockey_publication.py. Doel is niet
volledige dekking maar vangen van ongelukjes uit Fase 3's bestand-
verplaatsingen: elke functie minstens één keer aanroepen tegen een lege of
minimale DB en de verwachte vorm bevestigen."""

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleStanding, HockeyTeam
from models.settings import AppSetting  # noqa: F401 - registreert app_settings-tabel voor create_all
from routers.hockey_clubs import ClubDetailIn, ClubIn, ClubsBody, TeamIn, list_clubs, list_youth_teams, upsert_club_detail, upsert_clubs
from routers.hockey_publication import PublicationCreate, TagCreate, create_publication, create_tag, list_publications, list_tags
from routers.hockey_public import (
    get_competition_matches, get_public_season, list_public_clubs, list_public_publications, search_discovery,
)
from routers.hockey_query import get_club_ranking, get_tag_ranking, get_upcoming_matches


# ── hockey_clubs.py ───────────────────────────────────────

def test_upsert_clubs_creates_then_updates(session):
    body = ClubsBody(clubs=[ClubIn(federation_reference_id="HH11XX0", name="Club X", friendly_name="Club X")])
    result = upsert_clubs(body, session=session, _=None)
    assert result == {"created": 1, "updated": 0, "total": 1}

    result2 = upsert_clubs(body, session=session, _=None)
    assert result2 == {"created": 0, "updated": 1, "total": 1}

    listed = list_clubs(session=session, _=None)
    assert listed["total"] == 1


def test_upsert_club_detail_creates_club_and_teams(session):
    body = ClubDetailIn(
        federation_reference_id="HH11YY0", name="Club Y", friendly_name="Club Y",
        teams=[TeamIn(id=1, name="Team A", short_name="JO16-1", hockey_type="VE", category_group_name="Junioren")],
    )
    result = upsert_club_detail(body, session=session, _=None)
    assert result == {"club": "HH11YY0", "teams_created": 1, "teams_updated": 0, "total_teams": 1, "youth_teams": 1}

    teams = list_youth_teams(category="Junioren", session=session, _=None)
    assert teams["total"] == 1


# ── hockey_query.py ───────────────────────────────────────

def test_get_tag_ranking_returns_empty_rows_when_publication_has_no_links(session):
    result = get_tag_ranking(tid="pub1", tag=None, session=session)
    assert result == {"tags": None, "stat": "points", "rows": []}


def test_get_tag_ranking_and_club_ranking_with_a_scoped_poule(session):
    comp = HockeyCompetition(
        external_id="test|query", name="Test Comp", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, visible=True))
    session.add(HockeyPoule(poule_id=1, name="Poule A", competition_id=comp.id, season="2026-2027"))
    session.add(HockeyTeam(
        team_id=1, club_external_id="HH11XX0", name="Team A", short_name="H1",
        hockey_type="VE", category_group_name="Senioren",
    ))
    session.add(HockeyPouleStanding(poule_id=1, team_id=1, team_name="Team A", points=9, won=3, drawn=0, lost=0, goals_for=10, goals_against=2, played=3, position=1))
    session.commit()

    ranking = get_tag_ranking(tid="pub1", tag=None, session=session)
    assert len(ranking["rows"]) == 1
    assert ranking["rows"][0]["team_name"] == "Team A"

    club_ranking = get_club_ranking(tid="pub1", tag=None, session=session)
    assert club_ranking["rows"] == [{"rank": 1, "club_name": "HH11XX0", "club_logo_url": None, "team_count": 1}]

    upcoming = get_upcoming_matches(tid="pub1", tag=None, session=session)
    assert upcoming == {"tags": None, "rows": []}


# ── hockey_public.py ──────────────────────────────────────

def test_list_public_clubs_and_publications_empty(session):
    assert list_public_clubs(session=session) == []
    assert list_public_publications(session=session) == []


def test_get_public_season_defaults_when_no_setting_row(session):
    assert get_public_season(session=session) == {"season": "2026-2027"}


def test_get_competition_matches_returns_poules_and_empty_matches(session):
    comp = HockeyCompetition(
        external_id="test|public", name="Test Comp", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPoule(poule_id=1, name="Poule A", competition_id=comp.id, season="2026-2027"))
    session.commit()

    result = get_competition_matches(comp.id, session=session)
    assert result["name"] == "Test Comp"
    assert result["poules"] == [{"id": result["poules"][0]["id"], "name": "Poule A", "poule_id": 1, "finished": [], "scheduled": []}]


def test_search_discovery_requires_at_least_two_characters(session):
    assert search_discovery(q="a", session=session) == []


# ── hockey_publication.py ─────────────────────────────────

def test_create_and_list_publication(session):
    pub = create_publication(PublicationCreate(name="Test Publicatie"), session=session, user=admin_user_stub())
    assert pub.name == "Test Publicatie"

    listed = list_publications(session=session, _=None)
    assert listed[0]["name"] == "Test Publicatie"
    assert listed[0]["competition_count"] == 0


def test_create_tag_is_idempotent_by_name(session):
    tag1 = create_tag(TagCreate(name="1e klasse"), session=session, _=admin_user_stub())
    # Tweede aanroep vindt de bestaande rij en geeft 'm ongewijzigd terug (model
    # i.p.v. geserialiseerd dict - bestaande asymmetrie, niet iets voor deze
    # smoke-test om te fixen).
    tag2 = create_tag(TagCreate(name="1e klasse"), session=session, _=admin_user_stub())
    assert tag1["id"] == tag2.id

    tags = list_tags(session=session, _=None)
    assert len(tags) == 1


def admin_user_stub():
    class _U:
        id = "test-admin"
    return _U()
