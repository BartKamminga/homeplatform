"""Test voor item (Bart, 30-08-2026): een gewijzigde vanger-instelling moet
het scanschema meteen bijwerken - anders blijft de Debug-tab/Kalender een
oude cadans tonen totdat er toevallig een scan-plan-pass draait (die
uitstaat zolang scan_plan_enabled=0, dus in de praktijk nooit vanzelf)."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, ScanScheduleEntry
from routers.hockey_vanger_heartbeat import VangerSettingsIn, update_vanger_settings


def _setup_active_competition(session, now):
    comp = HockeyCompetition(
        external_id="test|settings-rebuild", name="Settings Rebuild Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=444, name="Poule Z", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=2))
    session.add(poule)
    session.add(HockeyTeam(
        team_id=9, club_external_id="HH11ZZ0", name="Settings Team", short_name="H9",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=444,
    ))
    # Gestart 103 min geleden, standaardduur 90 min -> 13 min geleden
    # afgelopen. 13 is bewust geen mooi veelvoud van de geteste intervallen
    # (45/10 min) - anders zou de eerstvolgende tick toevallig exact op
    # "now" kunnen uitkomen, een randgeval qua timing tussen het moment dat
    # de test "now" vastlegt en het moment dat de rebuild zijn eigen verse
    # "now" opvraagt.
    session.add(HockeyPouleMatch(
        poule_id=444, match_id=7001, home_team_id=9, away_team_id=10,
        status="scheduled", round=1, match_date=(now - timedelta(minutes=103)).isoformat(),
    ))
    session.commit()
    return poule


def test_updating_settings_rebuilds_the_schedule_with_the_new_interval(session):
    """match_end_check toont bewust maar 1 (de eerstvolgende) tick per
    rebuild, niet de hele reeks (Bart, 30-08-2026) - deze test verifieert
    daarom dat DIE ENE tick verschuift zodra active_matchday_interval_min
    wijzigt, niet de tussenruimte tussen 2 tonen (die zijn er niet meer)."""
    now = datetime.utcnow()
    _setup_active_competition(session, now)

    update_vanger_settings(VangerSettingsIn(active_matchday_interval_min=45), session=session, _=None)
    ticks_45 = sorted(
        e.planned_at for e in session.exec(
            select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 444, ScanScheduleEntry.reason == "match_end_check")
        ).all()
    )
    assert len(ticks_45) == 1

    update_vanger_settings(VangerSettingsIn(active_matchday_interval_min=10), session=session, _=None)
    ticks_10 = sorted(
        e.planned_at for e in session.exec(
            select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 444, ScanScheduleEntry.reason == "match_end_check")
        ).all()
    )
    assert len(ticks_10) == 1
    assert ticks_10[0] != ticks_45[0]  # instelling is echt doorgevoerd
    assert ticks_10[0] < ticks_45[0]  # kortere interval -> eerdere eerstvolgende tick
