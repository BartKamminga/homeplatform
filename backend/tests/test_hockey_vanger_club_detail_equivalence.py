"""Tests voor club-detail-upserts (refactor-plan hockey-inside Fase 1/2,
RFTR-B1/B2): de HTTP-router (upsert_club_detail) en de vanger-ingest-service
(_call_club_detail) delen nu apply_club_detail (services/hockey_club_capture_core.py).
De derde variant (_call_club_detail_raw, raw-dict) is per Fase 2b verwijderd -
die rol vervult _parse_raw_club (raw -> ClubDetailIn) + apply_club_detail nu,
zie routers/capture.py's reprocess-endpoint."""

from sqlmodel import select

from models.hockey_discovery import HockeyClub, HockeyTeam
from routers.hockey_clubs import ClubDetailIn, TeamIn, upsert_club_detail
from services.hockey_vanger_ingest import _call_club_detail, _parse_raw_club
from services.hockey_club_capture_core import apply_club_detail


def _shared_fields(ext_id, team_id):
    return dict(
        federation_reference_id=ext_id, name="Test Club", friendly_name="Test",
        city="Amsterdam", district="Noord-Holland",
        teams=[TeamIn(id=team_id, name="Team A", short_name="JO16-1",
                      hockey_type="VE", category_group_name="Junioren")],
    )


def test_router_endpoint_and_typed_ingest_helper_produce_equivalent_state(session):
    body_a = ClubDetailIn(**_shared_fields("HH11AAA", 1))
    upsert_club_detail(body_a, session=session, _=None)

    body_b = ClubDetailIn(**_shared_fields("HH11BBB", 2))
    _call_club_detail(body_b, session)
    session.commit()

    club_a = session.exec(select(HockeyClub).where(HockeyClub.external_id == "HH11AAA")).first()
    club_b = session.exec(select(HockeyClub).where(HockeyClub.external_id == "HH11BBB")).first()
    assert club_a.name == club_b.name == "Test Club"
    assert club_a.detail_loaded is True and club_b.detail_loaded is True

    team_a = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 1)).first()
    team_b = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 2)).first()
    assert team_a.hockey_type == team_b.hockey_type == "VE"
    assert team_a.category_group_name == team_b.category_group_name == "Junioren"


def test_reprocess_path_raw_via_parse_raw_club_produces_equivalent_state(session):
    """Zelfde pad als routers/capture.py's reprocess-endpoint voor
    capture_type='club_detail': raw dict (zoals gearchiveerd door
    upsert_club_detail) -> _parse_raw_club -> apply_club_detail."""
    raw = {
        "federation_reference_id": "HH11CCC", "name": "Test Club", "friendly_name": "Test",
        "city": "Amsterdam", "district": "Noord-Holland",
        "teams": [{"id": 3, "name": "Team A", "short_name": "JO16-1",
                   "hockey_type": "VE", "category_group_name": "Junioren"}],
    }
    body = _parse_raw_club(raw, {})
    result = apply_club_detail(session, body)
    session.commit()

    assert (result.teams_created, result.teams_updated) == (1, 0)
    club = session.exec(select(HockeyClub).where(HockeyClub.external_id == "HH11CCC")).first()
    assert club.name == "Test Club"
    assert club.detail_loaded is True
    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 3)).first()
    assert team.hockey_type == "VE"


def test_parse_raw_club_returns_none_for_malformed_team_entry(session):
    """_parse_raw_club vangt de hele payload af bij een kapotte team-entry
    (geen skip-en-verder zoals de oude _call_club_detail_raw deed) - de
    reprocess-endpoint meldt dit dan als 'parse mislukt' i.p.v. partieel te verwerken."""
    raw = {
        "federation_reference_id": "HH11DDD", "name": "Test Club", "friendly_name": "Test",
        "teams": [None, {"id": 4, "name": "Team A", "short_name": "JO16-1"}],
    }
    assert _parse_raw_club(raw, {}) is None
