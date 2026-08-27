"""Tests voor gap_fill_queue (routers/hockey_vanger_gap_analysis.py) - nul
dekking vóór item 990. Dekt met name de bijvangst-bug die item 990 blootlegde:
een stale poule die uitsluitend als extra (niet-primaire) team-poule-koppeling
bekend is, werd wel gevonden als stale maar zonder team_id stilletjes
overgeslagen."""

from datetime import datetime, timedelta

from models.hockey_discovery import HockeyPoule, HockeyTeam, HockeyTeamPoule
from routers.hockey_vanger_gap_analysis import gap_fill_queue


def _team(**kw):
    defaults = dict(
        club_external_id="HH11XX0", hockey_type="VE", category_group_name="Junioren",
        no_new_poule_confirmed=False, season_pending=False,
    )
    defaults.update(kw)
    return HockeyTeam(**defaults)


def test_gap_fill_queues_a_stale_poule_via_the_primary_team_link(session):
    now = datetime.utcnow()
    session.add(HockeyPoule(poule_id=100, name="Poule A", competition_id=1, season="2026-2027",
                             last_scanned_at=now - timedelta(days=10)))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = gap_fill_queue(season=None, stale_days=7, session=session, _=None)
    assert result["added_poules"] == 1


def test_gap_fill_queues_a_stale_poule_via_an_extra_team_link(session):
    # item 990: de poule is niemands recent_poule_id (primair), maar wel een
    # extra koppeling - moet nu via de fallback alsnog een team_id vinden.
    now = datetime.utcnow()
    session.add(HockeyPoule(poule_id=200, name="Poule Beker", competition_id=2, season="2026-2027",
                             last_scanned_at=now - timedelta(days=10)))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.add(HockeyTeamPoule(team_id=1, poule_id=200, season="2026-2027"))
    session.commit()

    result = gap_fill_queue(season=None, stale_days=7, session=session, _=None)
    assert result["added_poules"] == 1
