"""Karakteriseringstests voor de 3 club-detail-upsert-implementaties
(refactor-plan hockey-inside Fase 1, RFTR-B1) - vastleggen dat ze momenteel
dezelfde HockeyClub/HockeyTeam-state opleveren, VOORDAT Fase 2 (RFTR-B2) ze
tot een gedeelde kern samenvoegt."""

from sqlmodel import select

from models.hockey_discovery import HockeyClub, HockeyTeam
from routers.hockey_clubs import ClubDetailIn, TeamIn, upsert_club_detail
from services.hockey_vanger_ingest import _call_club_detail, _call_club_detail_raw


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


def test_raw_dict_variant_produces_equivalent_state_to_typed_variant(session):
    raw = {
        "federation_reference_id": "HH11CCC", "name": "Test Club", "friendly_name": "Test",
        "city": "Amsterdam", "district": "Noord-Holland",
        "teams": [{"id": 3, "name": "Team A", "short_name": "JO16-1",
                   "hockey_type": "VE", "category_group_name": "Junioren"}],
    }
    result = _call_club_detail_raw(raw, session)
    session.commit()

    assert result == {"club": "HH11CCC", "teams_created": 1, "teams_updated": 0}
    club = session.exec(select(HockeyClub).where(HockeyClub.external_id == "HH11CCC")).first()
    assert club.name == "Test Club"
    assert club.detail_loaded is True
    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 3)).first()
    assert team.hockey_type == "VE"


def test_raw_variant_skips_non_dict_team_entries_instead_of_crashing(session):
    raw = {
        "federation_reference_id": "HH11DDD", "name": "Test Club", "friendly_name": "Test",
        "teams": [None, {"id": 4, "name": "Team A", "short_name": "JO16-1"}],
    }
    result = _call_club_detail_raw(raw, session)
    assert result == {"club": "HH11DDD", "teams_created": 1, "teams_updated": 0}
