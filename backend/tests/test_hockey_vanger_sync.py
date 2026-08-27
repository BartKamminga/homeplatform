"""Tests voor de competitie-sync-fallback (roadmap-melding: 'team_id ontbreekt'
bij handmatige Sync op een publicatie zonder bekend hl_comp_id)."""

import json

from sqlmodel import select

from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyTeam, VangerCmd
from routers.hockey_vanger_sync import sync_competition


def test_sync_skips_poules_without_a_resolvable_team(session):
    comp = HockeyCompetition(
        external_id="test|sync-comp", name="Test Competitie", class_name="District",
        hockey_type="VE", season="2026-2027", hl_comp_id=None,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    poule_with_team = HockeyPoule(poule_id=111, name="Poule A", competition_id=comp.id, season="2026-2027")
    poule_without_team = HockeyPoule(poule_id=222, name="Poule B", competition_id=comp.id, season="2026-2027")
    session.add(poule_with_team)
    session.add(poule_without_team)
    session.add(HockeyTeam(
        team_id=1, club_external_id="HH11XX0", name="Test Team", short_name="H1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=111,
    ))
    session.commit()

    result = sync_competition(comp.id, session=session, _=None)

    assert result == {"added": 1, "skipped": 1}


def test_sync_queues_team_id_alongside_poule_id(session):
    comp = HockeyCompetition(
        external_id="test|sync-comp-2", name="Test Competitie 2", class_name="District",
        hockey_type="VE", season="2026-2027", hl_comp_id=None,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    poule = HockeyPoule(poule_id=333, name="Poule C", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=2, club_external_id="HH11YY0", name="Ander Team", short_name="H2",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=333,
    ))
    session.commit()

    result = sync_competition(comp.id, session=session, _=None)
    assert result == {"added": 1, "skipped": 0}

    cmd = session.exec(select(VangerCmd).where(VangerCmd.cmd_type == "get_poule")).first()
    params = json.loads(cmd.params)
    assert params["poule_id"] == 333
    assert params["team_id"] == 2


def test_sync_falls_back_to_competition_detail_when_hl_comp_id_known(session):
    comp = HockeyCompetition(
        external_id="test|sync-comp-3", name="Landelijke Test", class_name="Landelijk",
        hockey_type="VE", season="2026-2027", hl_comp_id=555,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    result = sync_competition(comp.id, session=session, _=None)
    assert result == {"added": 1, "skipped": 0}
