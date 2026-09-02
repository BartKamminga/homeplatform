"""Tests voor het Scanschema (Fase A, schaduw-modus) - services/
hockey_vanger_schedule.py. Elk event-type wordt getoetst tegen hetzelfde
scenario dat de bestaande _step_*-tests (test_hockey_vanger_scanplan_
matchday.py) als 'due' beoordelen, zodat de refactor de logica niet
stilzwijgend verandert."""

import json
from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey import HockeyPublication, HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, ScanScheduleEntry, VangerCmd,
)
from models.settings import AppSetting
from services.hockey_vanger_scanplan import SKIP_HEALTHY_DAILY_FALLBACK_KEY
from services.hockey_vanger_schedule import (
    build_schedule_events, promote_due_schedule_entries, rebuild_schedule, rebuild_schedule_for_target,
)


def _disable_skip_healthy_daily_fallback(session):
    """item 1018: veel bestaande daily_fallback-tests gebruiken bewust
    'schone' wedstrijddata (status=final, geen onbekende starttijd) om de
    burst-logica uit te schakelen - dat maakt de poule nu ook 'gezond', wat
    de nieuwe skip (default AAN) zou laten afgaan. Deze tests testen de
    cadans/het venster zelf, niet de gezond-skip (die heeft eigen tests) -
    hier expliciet uitzetten houdt ze bij hun oorspronkelijke scenario."""
    session.add(AppSetting(key=SKIP_HEALTHY_DAILY_FALLBACK_KEY, value="0"))


def _setup_active_competition(session, now, last_scanned_at, match_offset_hours=-3, status="finished"):
    comp = HockeyCompetition(
        external_id="test|schedule-comp", name="Schedule Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(
        poule_id=444, name="Poule Z", competition_id=comp.id, season="2026-2027",
        last_scanned_at=last_scanned_at,
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=9, club_external_id="HH11ZZ0", name="Schedule Team", short_name="H9",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=444,
    ))
    match_start = now + timedelta(hours=match_offset_hours)
    session.add(HockeyPouleMatch(
        poule_id=444, match_id=7001, home_team_id=9, away_team_id=10,
        status=status, round=1, match_date=match_start.isoformat(),
    ))
    # Altijd ook een wedstrijd verderop in het seizoen, binnen 7 dagen
    # (item 1016 + de latere 7-dagen-vooruitkijk-uitbreiding: een poule
    # zonder ENIGE toekomstige wedstrijd, of zonder wedstrijd binnen 7
    # dagen, krijgt geen daily_fallback meer) - deze helper test de
    # cadans-logica, niet het einde-van-seizoen-gedrag (dat heeft een eigen
    # test). status="final" zodat deze wedstrijd zelf geen eigen
    # match_end_check/burst-ticks genereert en de tests die daarop checken
    # niet per ongeluk raakt.
    session.add(HockeyPouleMatch(
        poule_id=444, match_id=79999, home_team_id=9, away_team_id=10,
        status="final", round=2, match_date=(now + timedelta(days=3)).isoformat(),
    ))
    session.commit()
    return poule


def test_matchday_burst_event_is_generated_for_an_ended_match(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    events = build_schedule_events(session, now, horizon_days=14)

    assert any(e["reason"] == "match_end_check" and e["target_id"] == 444 for e in events)


def test_match_end_check_shows_only_the_next_tick_not_the_whole_series(session):
    """Bart, 30-08-2026: 'de wedstrijd 3 keer te veel match_end_check - dat
    zou alleen gebeuren als de eerste geen resultaat geeft -> rebuild
    queue'. Het schema mag niet de hele resterende match_end_check-reeks
    tot burst_deadline in 1x tonen - alleen de eerstvolgende tick.
    post_cmd_result herbouwt het schema al meteen na elk echt resultaat
    (Wijziging 1); zonder resultaat schuift de eerstvolgende tick vanzelf
    door bij de volgende rebuild zodra hij verstrijkt."""
    now = datetime.utcnow()
    # Wedstrijd eindigde 10 min geleden -> burst-venster loopt, met de
    # standaardinstellingen (interval 45 min, stop 2u na de laatste
    # wedstrijd) zou een volledige reeks minstens 3 ticks opleveren.
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2), match_offset_hours=-1.667, status="scheduled")

    events = build_schedule_events(session, now, horizon_days=1)

    match_end_checks = [e for e in events if e["reason"] == "match_end_check" and e["target_id"] == 444]
    assert len(match_end_checks) == 1


def test_match_end_check_is_independent_per_match_with_no_scans_in_the_dead_zone(session):
    """Bart, 30-08-2026 (competition #21/#20, Sept 5; poule #180929): eerst
    liet een dag-brede aanpak (1 gedeelde cadans van de EERSTE tot de
    LAATSTE wedstrijd van de dag) de match_end_check-ticks voor latere
    wedstrijden helemaal wegvallen; de daaropvolgende fix loste dat op door
    de dag-brede cadans door te laten tikken zolang de dag nog niet 'af' kon
    zijn - maar dat bleek zelf ook fout: een poule met een wedstrijd om
    10:20 en een om 14:30 (poule #180929) kreeg dan om de 45 min een scan
    IN DE DODE PERIODE ERTUSSEN, terwijl er niets te ontdekken viel zolang
    wedstrijd B nog niet eens was begonnen. Bart: "per wedstrijd zijn er
    maximaal 2 geplande scans, een start en een end... als de match end scan
    het gewenste resultaat oplevert dan geen extra scan, anders schedulen en
    rebuild" - match_end_check is dus volledig PER WEDSTRIJD, losstaand van
    andere wedstrijden diezelfde dag: precies 1 tick per wedstrijd, op haar
    EIGEN voorspelde einde, en niks in de dode periode ertussen."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|schedule-comp-spread", name="Schedule Test Spread", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=555, name="Poule Spread", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=19, club_external_id="HH12ZZ0", name="Spread Team", short_name="H19",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=555,
    ))
    # Wedstrijd A eindigde 30 min geleden (duration_min default 90).
    session.add(HockeyPouleMatch(
        poule_id=555, match_id=8001, home_team_id=19, away_team_id=20,
        status="scheduled", round=1, match_date=(now - timedelta(hours=2)).isoformat(),
    ))
    # Wedstrijd B begint pas over 1 uur, dus eindigt over 2,5 uur.
    session.add(HockeyPouleMatch(
        poule_id=555, match_id=8002, home_team_id=19, away_team_id=20,
        status="scheduled", round=2, match_date=(now + timedelta(hours=1)).isoformat(),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    match_end_checks = sorted(
        e["planned_at"] for e in events if e["reason"] == "match_end_check" and e["target_id"] == 555
    )
    # Precies 2 ticks - 1 per wedstrijd, elk op haar EIGEN eerstvolgende
    # moment (wedstrijd A's retry vlak na nu, wedstrijd B's eigen einde over
    # 2,5u) - met een gat van ruim 2u ertussen waarin niets gepland staat,
    # want er valt in die dode periode niets te ontdekken.
    assert len(match_end_checks) == 2
    assert match_end_checks[0] < now + timedelta(hours=1)
    assert match_end_checks[1] >= now + timedelta(hours=2, minutes=25)
    assert match_end_checks[1] - match_end_checks[0] >= timedelta(hours=2)


def test_matchday_burst_stops_once_all_of_the_days_matches_are_final(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(minutes=50), status="final")

    events = build_schedule_events(session, now, horizon_days=14)

    assert not any(e["reason"] == "match_end_check" and e["target_id"] == 444 for e in events)


def test_match_start_check_event_is_generated_shortly_after_kickoff(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2), match_offset_hours=-0.25, status="scheduled")

    events = build_schedule_events(session, now, horizon_days=14)

    match_start_checks = [e for e in events if e["reason"] == "match_start_check" and e["target_id"] == 444]
    assert match_start_checks
    assert match_start_checks[0]["planned_at"] >= now


def test_match_live_fills_the_gap_between_match_start_check_and_the_predicted_end(session):
    """Bart, 30-08-2026: tussen het 1x match_start_check-moment en het
    voorspelde einde van de wedstrijd zat een dode zone in het schema -
    reason match_live (dynamisch, "blijkt live wedstrijd te zijn ->
    match_live events inplannen") dekt dat gat nu AL tijdens de wedstrijd
    (zolang die bevestigd live staat), niet pas na het voorspelde einde."""
    now = datetime.utcnow()
    # Gestart 60 min geleden (exact het einde van het match_start_check-
    # venster: 15 min delay + 10 min retry_match_end), standaardduur 90 min
    # -> nog 30 min te gaan tot het voorspelde einde.
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2), match_offset_hours=-1, status="live")

    events = build_schedule_events(session, now, horizon_days=1)

    match_live_ticks = sorted(e["planned_at"] for e in events if e["reason"] == "match_live" and e["target_id"] == 444)
    assert match_live_ticks
    assert all(t >= now for t in match_live_ticks)
    predicted_end = now + timedelta(minutes=30)
    assert any(t < predicted_end for t in match_live_ticks)  # vóór het voorspelde einde
    assert len(match_live_ticks) == len(set(match_live_ticks))  # geen dubbelen op hetzelfde moment


def test_match_end_check_is_not_planned_early_for_a_match_that_is_not_confirmed_live(session):
    """Bart, 30-08-2026: 'dit is toch pas een item, zodra we weten of er een
    livewedstrijd is' - de vroege (nog-lopende-wedstrijd) match_end_check-
    ticks mogen alleen gepland worden als een eerdere scan al bevestigd
    heeft dat de wedstrijd echt live staat (m.status == 'live'), niet
    louter op basis van de voorspelde starttijd/duur (status hier bewust
    'scheduled', niet 'live'). De REGULIERE match_end_check NA het
    voorspelde einde is wel gewoon verwacht, ongeacht live-status."""
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2), match_offset_hours=-1, status="scheduled")

    events = build_schedule_events(session, now, horizon_days=1)

    predicted_end = now + timedelta(minutes=30)  # gestart 60 min geleden, standaardduur 90 min
    early_checks = [
        e for e in events
        if e["reason"] == "match_end_check" and e["target_id"] == 444 and e["planned_at"] < predicted_end
    ]
    assert not early_checks


def test_match_end_check_and_match_start_check_do_not_duplicate_when_they_land_on_the_same_instant(session):
    """Bart, 30-08-2026: match_end_check (dag-breed, gebaseerd op de EERSTE
    wedstrijd die afloopt) en match_start_check (per wedstrijd) kunnen
    toevallig op exact hetzelfde moment uitkomen - dat mag geen 2 losse
    rijen opleveren, ze zouden bij promotie toch tot dezelfde VangerCmd
    samenvallen."""
    now = datetime(2026, 9, 5, 10, 0, 0)
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2), match_offset_hours=-0.5, status="scheduled")
    # 2e wedstrijd zo getimed dat haar match_start_check (start + 15 min)
    # exact samenvalt met het moment waarop de EERSTE wedstrijd afloopt
    # (burst_start = start1 + 90 min standaardduur = now + 60 min).
    second_start = now + timedelta(minutes=45)
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=7002, home_team_id=9, away_team_id=11,
        status="scheduled", round=1, match_date=second_start.isoformat(),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    collision_at = now + timedelta(minutes=60)
    at_collision = [e for e in events if e["target_id"] == 444 and e["planned_at"] == collision_at]
    assert len(at_collision) == 1


def test_daily_fallback_event_is_generated_within_horizon(session):
    now = datetime.utcnow()
    _disable_skip_healthy_daily_fallback(session)
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"  # burst uitgeschakeld, puur de dagelijkse fallback testen
    session.add(match)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=2)

    fallback = [e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == 444]
    assert fallback
    expected = poule.last_scanned_at + timedelta(hours=24)
    assert fallback[0]["planned_at"] == expected


def test_daily_fallback_does_not_land_inside_an_active_matchday_burst_window(session):
    """Bart, 30-08-2026: een naar last_scanned_at berekende daily_fallback-
    tick kwam soms midden in een actief burst-venster terecht (bv. een
    daily_fallback-rij tussen match_start_check/match_end_check-rijen op
    dezelfde dag) - in werkelijkheid zou de burst-scan last_scanned_at allang voorbij
    dat moment hebben geschoven, dus de fallback-cadans moet daar rekening
    mee houden i.p.v. onafhankelijk vanaf de oude last_scanned_at te tellen."""
    now = datetime(2026, 9, 5, 12, 0, 0)
    comp = HockeyCompetition(
        external_id="test|fallback-preempt", name="Fallback Preempt Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(
        poule_id=555, name="Poule Fallback", competition_id=comp.id, season="2026-2027",
        last_scanned_at=now - timedelta(hours=23, minutes=30),
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=50, club_external_id="HH50ZZ0", name="Fallback Team", short_name="H50",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=555,
    ))
    # Wedstrijd startte 2u geleden, standaardduur 90 min -> 30 min geleden
    # afgelopen -> burst-modus loopt nu (tot 2u na afloop, default).
    match_start = now - timedelta(hours=2)
    session.add(HockeyPouleMatch(
        poule_id=555, match_id=8001, home_team_id=50, away_team_id=51,
        status="live", round=1, match_date=match_start.isoformat(),
    ))
    # Wedstrijd verderop in het seizoen, binnen 7 dagen (item 1016 + de
    # 7-dagen-vooruitkijk-uitbreiding: zonder toekomstige wedstrijd binnen
    # 7 dagen krijgt de poule geen daily_fallback meer - deze test toetst
    # de cadans-logica, niet dat gedrag).
    session.add(HockeyPouleMatch(
        poule_id=555, match_id=89999, home_team_id=50, away_team_id=51,
        status="final", round=2, match_date=(now + timedelta(days=3)).isoformat(),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=2)

    burst_ticks = sorted(e["planned_at"] for e in events if e["target_id"] == 555 and e["reason"] == "match_end_check")
    fallback = [e for e in events if e["target_id"] == 555 and e["reason"] == "daily_fallback"]
    assert burst_ticks
    assert fallback
    assert fallback[0]["planned_at"] > burst_ticks[-1]
    assert fallback[0]["planned_at"] == burst_ticks[-1] + timedelta(hours=24)


def test_daily_fallback_is_skipped_when_a_matchday_scan_is_already_planned_that_same_day(session):
    """Bart, 30-08-2026: als er die dag al een matchday-scan gepland staat -
    ook als die pas later op de dag valt dan de berekende fallback-tick - is
    een aparte dagelijkse fallback voor diezelfde dag overbodig, de dag
    wordt toch al ververst."""
    now = datetime(2026, 9, 5, 7, 0, 0)
    # Naieve fallback-tick (last_scanned_at + 24u) valt op 2026-09-05 08:00 -
    # voor het wedstrijd-moment (12:00) diezelfde dag.
    _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=23),
        match_offset_hours=5, status="scheduled",
    )

    events = build_schedule_events(session, now, horizon_days=1)

    fallback_today = [
        e for e in events
        if e["target_id"] == 444 and e["reason"] == "daily_fallback" and e["planned_at"].date() == now.date()
    ]
    assert not fallback_today


def test_daily_fallback_is_not_generated_once_the_season_is_over(session):
    """Item 1016 (Bart, 30-08-2026): een poule met minstens 1 bekende
    wedstrijd, en ze zijn ALLEMAAL al geweest, heeft niets meer te
    ontdekken - het scanschema mag daar geen daily_fallback-rijen meer
    voor plannen."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|schedule-season-over", name="Schedule Season Over", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=666, name="Poule Klaar", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=25))
    session.add(poule)
    session.add(HockeyTeam(
        team_id=60, club_external_id="HH60ZZ0", name="Klaar Team", short_name="H60",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=666,
    ))
    session.add(HockeyPouleMatch(
        poule_id=666, match_id=9001, home_team_id=60, away_team_id=61,
        status="final", round=1, match_date=(now - timedelta(days=3)).isoformat(),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    assert not any(e["target_id"] == 666 for e in events)


def test_daily_fallback_event_is_not_generated_for_a_healthy_poule_by_default(session):
    # item 1018: mirror van de scanplan-kant - de Kalender-preview moet
    # hetzelfde tonen als wat _step_active_profiles echt zou doen.
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"
    session.add(match)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=2)

    assert not any(e["reason"] == "daily_fallback" and e["target_id"] == 444 for e in events)


def test_daily_fallback_is_not_generated_during_a_quiet_week(session):
    """Bart, 30-08-2026: 'als alles van een poule of comp bekend is ...
    kunnen de daily_fallback voor die poule/comp vervallen voor de komende
    week' - geen daily_fallback-ticks zolang de eerstvolgende wedstrijd nog
    meer dan 7 dagen weg is; de cadans hervat vanzelf zodra die wedstrijd
    dichterbij komt."""
    now = datetime.utcnow()
    _disable_skip_healthy_daily_fallback(session)
    comp = HockeyCompetition(
        external_id="test|schedule-quiet-week", name="Schedule Quiet Week", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=667, name="Poule Rustig", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=25))
    session.add(poule)
    session.add(HockeyTeam(
        team_id=61, club_external_id="HH61ZZ0", name="Rustig Team", short_name="H61",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=667,
    ))
    # Eerstvolgende wedstrijd pas over 10 dagen - de eerste ~3 dagen van het
    # 14-dagen-horizon vallen dus in een "rustige week" (buiten het
    # 7-dagen-lookahead-venster).
    session.add(HockeyPouleMatch(
        poule_id=667, match_id=9101, home_team_id=61, away_team_id=62,
        status="scheduled", round=1, match_date=(now + timedelta(days=10)).isoformat(),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    fallback = sorted(e["planned_at"] for e in events if e["target_id"] == 667 and e["reason"] == "daily_fallback")
    assert fallback
    # De eerste fallback-tick mag pas verschijnen zodra de wedstrijd (dag
    # 10) binnen het 7-dagen-lookahead-venster valt, dus niet eerder dan
    # rond dag 3.
    assert fallback[0] >= now + timedelta(days=2, hours=12)


def test_daily_fallback_is_absorbed_when_the_clamped_display_date_lands_on_a_matchday(session):
    """Bart, 30-08-2026, echte acc-observatie: een late-avond fallback-tick
    (bv. 20:13) klemt (_clamp_to_window) door naar de volgende ochtend
    (09:00) voor weergave - de same_day_preempt-vergelijking moet tegen die
    GEKLEMDE datum checken, niet de ruwe tick-datum, anders lijkt de dag
    ervoor (zonder wedstrijd) geen conflict te hebben terwijl de klem 'm
    alsnog op de matchday laat landen."""
    now = datetime(2026, 9, 1, 10, 0, 0)
    # Naive eerste fallback-tick: last_scanned_at + 24u = 2026-09-01 20:00
    # (avond, geen wedstrijd die dag) -> klemt door naar 2026-09-02 09:00,
    # de dag met de wedstrijd hieronder.
    _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=14),
        match_offset_hours=22, status="scheduled",  # wedstrijd op 2026-09-02 08:00
    )

    events = build_schedule_events(session, now, horizon_days=3)

    fallback_on_matchday = [
        e for e in events
        if e["target_id"] == 444 and e["reason"] == "daily_fallback" and e["planned_at"].date() == datetime(2026, 9, 2).date()
    ]
    assert not fallback_on_matchday


def test_hl_linked_poule_is_excluded_from_poule_events(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    comp = session.get(HockeyCompetition, poule.competition_id)
    comp.hl_comp_id = 21
    session.add(comp)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    assert not any(e["target_type"] == "poule" and e["target_id"] == 444 for e in events)


def test_landelijke_competitions_are_scheduled_like_a_poule(session):
    """Sinds 30-08-2026 wordt een landelijke competitie ook in het scanschema
    behandeld als 1 grote poule (unie van alle wedstrijden in haar poules) -
    dezelfde matchday-burst/live-check/dagelijkse-fallback-regels, met
    cmd_type get_competition_detail i.p.v. get_poule, target_type
    'competition'."""
    now = datetime(2026, 9, 1, 10, 0, 0)
    comp = HockeyCompetition(
        external_id="test|hl-schedule", name="Landelijk Test", class_name="Topklasse",
        hockey_type="VE", season="2026-2027", hl_comp_id=77,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    poule = HockeyPoule(poule_id=888, name="Poule Y", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=13))
    session.add(poule)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=2)

    hl_events = [e for e in events if e["target_type"] == "competition" and e["target_id"] == 77]
    assert hl_events
    assert all(e["cmd_type"] == "get_competition_detail" for e in hl_events)
    assert any(e["reason"] == "daily_fallback" for e in hl_events)


def test_landelijke_match_start_check_is_deduplicated_across_simultaneous_matches(session):
    """Meerdere poules van dezelfde landelijke competitie kunnen op exact
    hetzelfde moment een wedstrijd laten starten (Bart, 30-08-2026: bv.
    Landelijk Jongens O18, 6 van de 8 poules om 14:00) - dat mag geen 6
    losse match_start_check-rijen op hetzelfde tijdstip opleveren, 1
    get_competition_detail-call ververst ze toch in 1x."""
    now = datetime(2026, 9, 1, 10, 0, 0)
    comp = HockeyCompetition(
        external_id="test|hl-dedup", name="Landelijk Dedup Test", class_name="Topklasse",
        hockey_type="VE", season="2026-2027", hl_comp_id=99,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    same_start = now + timedelta(hours=2)
    for i, poule_id in enumerate((901, 902, 903)):
        session.add(HockeyPoule(poule_id=poule_id, name=f"Poule {i}", competition_id=comp.id,
                                 season="2026-2027", last_scanned_at=now - timedelta(hours=1)))
        session.add(HockeyPouleMatch(
            poule_id=poule_id, match_id=1000 + i, home_team_id=1, away_team_id=2,
            status="scheduled", round=1, match_date=same_start.isoformat(),
        ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    match_start_checks = [e for e in events if e["target_type"] == "competition" and e["target_id"] == 99 and e["reason"] == "match_start_check"]
    assert len(match_start_checks) == 1


def test_landelijke_competition_without_poules_yet_gets_an_immediate_event(session):
    now = datetime(2026, 9, 1, 10, 0, 0)
    comp = HockeyCompetition(
        external_id="test|hl-empty", name="Landelijk Leeg", class_name="Topklasse",
        hockey_type="VE", season="2026-2027", hl_comp_id=88,
    )
    session.add(comp)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    matching = [e for e in events if e["target_type"] == "competition" and e["target_id"] == 88]
    assert len(matching) == 1
    assert matching[0]["reason"] == "new_or_empty"
    assert matching[0]["planned_at"] == now


def test_manual_weekly_event_is_generated_on_the_assigned_weekday(session):
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|manual-schedule", name="Manual Schedule Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    poule = HockeyPoule(poule_id=999, name="Poule M", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=99, club_external_id="HH11ZZ0", name="Manual Team", short_name="M1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=999,
    ))
    # item 1018: "ongezond" (overdue_result) - anders wordt dit event nu geskipt.
    session.add(HockeyPouleMatch(
        poule_id=999, match_id=1, home_team_id=1, away_team_id=2,
        status="scheduled", round=1, match_date=(now - timedelta(hours=4)).isoformat(),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=7)

    assert any(e["reason"] == "manual_weekly" and e["target_id"] == 999 for e in events)


def test_unpublished_active_competition_falls_back_to_manual_weekly_event(session):
    """item 1022: een scan_profile='active'-competitie die niet publiek
    zichtbaar is (HockeyPublication.published=False) krijgt in de preview
    GEEN matchday-events meer, maar wel dezelfde manual_weekly-events als
    een echte manual-competitie - anders loopt de Kalender-preview uit de
    pas met wat _step_manual_profiles_weekly/_step_active_profiles echt doen."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|unpublished-active-schedule", name="Unpublished Active Schedule Test",
        class_name="District", hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublication(id="pub-unpublished", name="Unpublished Pub", published=False))
    session.add(HockeyPublicationComp(publication_id="pub-unpublished", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=1000, name="Poule U", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=100, club_external_id="HH11ZZ0", name="Unpublished Team", short_name="H1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=1000,
    ))
    # Ongezond (overdue_result), net als de manual_weekly-tests.
    session.add(HockeyPouleMatch(
        poule_id=1000, match_id=1, home_team_id=1, away_team_id=2,
        status="scheduled", round=1, match_date=(now - timedelta(hours=4)).isoformat(),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=7)

    assert any(e["reason"] == "manual_weekly" and e["target_id"] == 1000 for e in events)
    matchday_reasons = {"match_start_check", "match_end_check", "retry_match_end", "match_live", "daily_fallback"}
    assert not any(e["target_id"] == 1000 and e["reason"] in matchday_reasons for e in events)


def test_unknown_start_recheck_event_is_generated_within_lookahead(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    future_date = (now + timedelta(days=3)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    assert any(e["reason"] == "unknown_start_recheck" and e["target_id"] == 444 for e in events)


def test_unknown_start_recheck_never_emits_the_same_clamped_moment_twice(session):
    """Bart, 30-08-2026 (poule #180923): 2x unknown_start_recheck om exact
    hetzelfde moment op dezelfde dag. Root cause: met de standaardinstellingen
    (unknown_start_fallback_hours=8, scanvenster 09:00-18:00) klemt een
    avondtick (bv. 20:11) vooruit naar de volgende dag 09:00, en de
    daaropvolgende vroege-ochtendtick (04:11, +8u later) klemt terug naar
    DIEZELFDE dag 09:00 - 2 verschillende ruwe ticks, dezelfde geklemde
    weergavetijd, zonder dedup op basis van de ruwe tick allebei getoond."""
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    future_date = (now + timedelta(days=3)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    moments = [e["planned_at"] for e in events if e["reason"] == "unknown_start_recheck" and e["target_id"] == 444]
    assert moments
    assert len(moments) == len(set(moments))


def test_rebuild_schedule_persists_planned_entries_and_replaces_stale_ones(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    added_first = rebuild_schedule(session, now, horizon_days=14)
    assert added_first > 0
    first_count = len(session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")).all())
    assert first_count == added_first

    # Nogmaals herbouwen (bv. na een instellingswijziging) mag niet stapelen -
    # de oude 'planned'-rijen worden vervangen, niet aangevuld.
    added_second = rebuild_schedule(session, now, horizon_days=14)
    second_count = len(session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")).all())
    assert second_count == added_second


def test_rebuild_schedule_for_target_does_not_touch_other_poules(session):
    """Bart, 30-08-2026: 'ik neem aan dat je alleen de relevante delen
    herbouwt?' - de reactieve rebuild na een enkel scanresultaat mag NIET
    de hele dataset herberekenen, alleen het doel waar het resultaat
    daadwerkelijk over ging."""
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=999999, cmd_type="get_poule",
        params=json.dumps({"poule_id": 999999, "team_id": 1, "label": "Untouched"}),
        planned_at=now + timedelta(hours=1), reason="daily_fallback",
    ))
    session.commit()
    untouched_id = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 999999)).first().id

    rebuild_schedule_for_target(session, now, 14, "poule", 444)

    still_there = session.get(ScanScheduleEntry, untouched_id)
    assert still_there is not None
    assert still_there.status == "planned"


def test_rebuild_schedule_for_target_refreshes_that_poules_own_entries(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    stale_at = now + timedelta(days=5)
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9, "label": "Stale"}),
        planned_at=stale_at, reason="daily_fallback",
    ))
    session.commit()

    n = rebuild_schedule_for_target(session, now, 14, "poule", 444)

    assert n > 0
    entries = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 444)).all()
    assert entries
    assert all(e.planned_at != stale_at for e in entries)  # de verouderde rij is vervangen


def test_rebuild_schedule_for_target_skips_a_manual_profile_poule(session):
    """Alleen scan_profile='active'-poules krijgen matchday-gebaseerde
    events - een 'manual'-poule heeft niets om reactief te verversen (haar
    manual_weekly-timing hangt niet af van een scanresultaat)."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|target-manual", name="Target Manual", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="manual"))
    poule = HockeyPoule(poule_id=888, name="Manual Poule", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(days=10))
    session.add(poule)
    session.add(HockeyTeam(
        team_id=80, club_external_id="HH80ZZ0", name="Manual Team", short_name="H80",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=888,
    ))
    session.commit()

    n = rebuild_schedule_for_target(session, now, 14, "poule", 888)

    assert n == 0


def test_rebuild_schedule_for_target_handles_a_landelijke_competition(session):
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|target-hl", name="Target HL Test", class_name="Topklasse",
        hockey_type="VE", season="2026-2027", hl_comp_id=42,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    poule = HockeyPoule(poule_id=889, name="HL Poule", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=30))
    session.add(poule)
    session.commit()

    n = rebuild_schedule_for_target(session, now, 14, "competition", 42)

    assert n > 0
    entries = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 42)).all()
    assert all(e.target_type == "competition" for e in entries)


def _allow_all_categories(session):
    """De queue-filter valt standaard terug op cats=['Junioren'] als er geen
    AppSetting-override is (_get_queue_filter) - sinds de Fase C-migratie
    (item 1015) wordt dat ook toegepast bij promotie, niet meer alleen bij
    het oppakken. De meeste promote-tests testen dedup/cap/due-logica, niet
    het filter zelf, dus die zetten dit expliciet open zodat hun (meestal
    'Senioren') testfixtures niet per ongeluk als 'buiten filter' worden
    gecanceld."""
    session.add(AppSetting(key="disc_queue_category", value=""))
    session.commit()


def test_promote_due_schedule_entries_creates_a_vanger_cmd(session):
    now = datetime.utcnow()
    _allow_all_categories(session)
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=30))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9, "label": "Test"}),
        planned_at=now - timedelta(minutes=1), reason="daily_fallback",
    ))
    session.commit()

    promoted = promote_due_schedule_entries(session, now)

    assert promoted == 1
    entry = session.exec(select(ScanScheduleEntry)).first()
    assert entry.status == "promoted"
    assert entry.vanger_cmd_id is not None
    cmd = session.exec(select(VangerCmd).where(VangerCmd.id == entry.vanger_cmd_id)).first()
    assert cmd is not None
    assert cmd.cmd_type == "get_poule"
    # item 1019: reason moet worden doorgegeven, anders is een gepromoveerde
    # cmd niet te onderscheiden van een handmatige/ad-hoc toevoeging (reason=
    # None) en zou GET /vanger/cmd-queue/next 'm per ongeluk laten bypassen.
    assert cmd.reason == "daily_fallback"


def test_promote_due_schedule_entries_does_not_duplicate_an_already_queued_cmd(session):
    now = datetime.utcnow()
    _allow_all_categories(session)
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=30))
    session.add(VangerCmd(
        cmd_type="get_poule", params=json.dumps({"poule_id": 444, "team_id": 9}), status="pending",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9, "label": "Test"}),
        planned_at=now - timedelta(minutes=1), reason="daily_fallback",
    ))
    session.commit()

    promote_due_schedule_entries(session, now)

    all_cmds = session.exec(select(VangerCmd)).all()
    assert len(all_cmds) == 1  # geen dubbele rij - add_vanger_cmd's dedup blijft van kracht
    entry = session.exec(select(ScanScheduleEntry)).first()
    assert entry.status == "promoted"


def test_promote_due_schedule_entries_cancels_an_entry_outside_the_queue_filter(session):
    """Fase C, item 1015 (Bart, 30-08-2026, akkoord): het queue-filter wordt
    nu ook toegepast bij PROMOTIE, niet meer alleen bij het oppakken - een
    entry die niet past wordt gecanceld i.p.v. gepromoveerd tot VangerCmd."""
    now = datetime.utcnow()
    session.add(AppSetting(key="disc_queue_category", value="Junioren"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=30))
    team = session.exec(select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule.poule_id)).first()
    assert team.category_group_name == "Senioren"  # buiten het Junioren-only filter
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": team.team_id, "label": "Test"}),
        planned_at=now - timedelta(minutes=1), reason="daily_fallback",
    ))
    session.commit()

    promoted = promote_due_schedule_entries(session, now)

    assert promoted == 0
    entry = session.exec(select(ScanScheduleEntry)).first()
    assert entry.status == "cancelled"
    assert session.exec(select(VangerCmd)).first() is None


def test_promote_due_schedule_entries_promotes_an_entry_matching_the_queue_filter(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="disc_queue_category", value="Senioren"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=30))
    team = session.exec(select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule.poule_id)).first()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": team.team_id, "label": "Test"}),
        planned_at=now - timedelta(minutes=1), reason="daily_fallback",
    ))
    session.commit()

    promoted = promote_due_schedule_entries(session, now)

    assert promoted == 1
    entry = session.exec(select(ScanScheduleEntry)).first()
    assert entry.status == "promoted"
    assert session.exec(select(VangerCmd)).first() is not None


def test_immediate_events_are_capped_like_the_real_steps(session):
    """Roadmap-melding (30-08-2026): op acc leverde een eerste rebuild+promote
    in 1x 900 nieuwe VangerCmd-rijen op omdat new_or_empty/club_scan geen cap
    hadden (in tegenstelling tot de echte _step_new_or_empty_poules/
    _step_club_scan, die altijd STEP_MAX_CMDS hanteren)."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|cap-comp", name="Cap Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    # category_group_name="Junioren" (i.p.v. Senioren): valt binnen het
    # default queue-filter (item: new_or_empty respecteert het filter al bij
    # het aanmaken) - anders test dit sinds die fix per ongeluk alleen nog
    # de filter-uitsluiting (altijd 0) i.p.v. de cap zelf.
    for i in range(20):
        poule_id = 5000 + i
        session.add(HockeyTeam(
            team_id=6000 + i, club_external_id="HH11ZZ0", name=f"Cap Team {i}", short_name=f"H{i}",
            hockey_type="VE", category_group_name="Junioren", recent_poule_id=poule_id,
        ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    new_or_empty = [e for e in events if e["reason"] == "new_or_empty"]
    assert 0 < len(new_or_empty) <= 10


# ── item 1019 (Fase C-pariteitsfixes): _immediate_events moet exact hetzelfde
# gedrag vertonen als _step_club_list/_step_club_scan/_step_new_or_empty_poules ──

def test_immediate_events_skips_club_list_when_recently_done(session):
    now = datetime.utcnow()
    session.add(VangerCmd(
        cmd_type="get_clubs", params=json.dumps({"label": "Alle clubs"}),
        status="done", finished_at=now - timedelta(days=1),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    assert not any(e["reason"] == "club_list" for e in events)


def test_immediate_events_includes_club_list_once_the_interval_has_passed(session):
    now = datetime.utcnow()
    session.add(VangerCmd(
        cmd_type="get_clubs", params=json.dumps({"label": "Alle clubs"}),
        status="done", finished_at=now - timedelta(days=8),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    assert any(e["reason"] == "club_list" for e in events)


def test_immediate_events_skips_a_recently_scanned_club(session):
    now = datetime(2026, 9, 1, 10, 0, 0)  # dinsdag, geen weekend-uitsluiting
    session.add(HockeyClub(
        external_id="CLUB_RECENT", name="Club Recent", friendly_name="Club Recent",
        detail_loaded=False, last_scanned_at=now - timedelta(hours=12),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    assert not any(
        e["reason"] == "club_scan" and json.loads(e["params"]).get("external_id") == "CLUB_RECENT" for e in events
    )


def test_immediate_events_includes_a_club_once_the_scan_interval_has_passed(session):
    now = datetime(2026, 9, 1, 10, 0, 0)  # dinsdag
    session.add(HockeyClub(
        external_id="CLUB_STALE", name="Club Stale", friendly_name="Club Stale",
        detail_loaded=False, last_scanned_at=now - timedelta(days=3),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    assert any(
        e["reason"] == "club_scan" and json.loads(e["params"]).get("external_id") == "CLUB_STALE" for e in events
    )


def test_immediate_events_includes_an_already_captured_poule_with_no_matches_yet(session):
    """item 1019: fase 2 van _step_new_or_empty_poules (lege poule IN
    target_season zonder wedstrijden) ontbrak hier - een poule die al wel
    als HockeyPoule bestaat (dus fase 1 slaat 'm over via captured_ids) maar
    nog geen enkele wedstrijd heeft, moet via fase 2 alsnog een
    new_or_empty-event krijgen."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|empty-poule-phase2", name="Empty Poule Phase2", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    poule = HockeyPoule(poule_id=7000, name="Poule Leeg", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    # category_group_name="Junioren": valt binnen het default queue-filter
    # (cats=["Junioren"] zonder AppSetting) - zelfde reden als de cap-test
    # hierboven, anders test dit alleen de filter-uitsluiting i.p.v. fase 2.
    session.add(HockeyTeam(
        team_id=7000, club_external_id="HH11ZZ0", name="Empty Poule Team", short_name="JO16-1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=7000,
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    matches = [e for e in events if e["reason"] == "new_or_empty" and e["target_id"] == 7000]
    assert matches
    assert matches[0]["cmd_type"] == "get_poule"


def test_promote_due_schedule_entries_is_capped_per_call(session):
    now = datetime.utcnow()
    for i in range(20):
        session.add(ScanScheduleEntry(
            target_type="poule", target_id=5000 + i, cmd_type="get_poule",
            params=json.dumps({"poule_id": 5000 + i, "team_id": 6000 + i, "label": "Test"}),
            planned_at=now - timedelta(minutes=1), reason="daily_fallback",
        ))
    session.commit()

    promoted = promote_due_schedule_entries(session, now)

    assert promoted <= 10
    remaining_planned = session.exec(
        select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")
    ).all()
    assert len(remaining_planned) >= 10


def test_promote_ignores_entries_not_yet_due(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=30))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9, "label": "Test"}),
        planned_at=now + timedelta(hours=1), reason="daily_fallback",
    ))
    session.commit()

    promoted = promote_due_schedule_entries(session, now)

    assert promoted == 0
    entry = session.exec(select(ScanScheduleEntry)).first()
    assert entry.status == "planned"


# ── scan-venster (niet-wedstrijd-gebonden momenten binnen 09:00-18:00) ────

def test_daily_fallback_is_clamped_into_the_scan_window(session):
    # now = 03:00 zodat de fallback-tick (24u na last_scanned_at, dus ook
    # 03:00) ruim buiten het standaard venster (09:00-18:00) valt.
    now = datetime(2026, 9, 1, 3, 0, 0)
    _disable_skip_healthy_daily_fallback(session)
    poule = _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=24), match_offset_hours=-28, status="final",
    )

    events = build_schedule_events(session, now, horizon_days=2)

    fallback = next(e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == poule.poule_id)
    assert fallback["planned_at"].hour == 9
    assert fallback["planned_at"].date() == now.date()


def test_daily_fallback_within_the_window_is_unchanged(session):
    now = datetime(2026, 9, 1, 3, 0, 0)
    _disable_skip_healthy_daily_fallback(session)
    poule = _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=17), match_offset_hours=-28, status="final",
    )  # tick = now - 17u + 24u = 10:00, al binnen het venster

    events = build_schedule_events(session, now, horizon_days=2)

    fallback = next(e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == poule.poule_id)
    assert fallback["planned_at"].hour == 10


def test_daily_fallback_past_the_window_rolls_to_the_next_day(session):
    now = datetime(2026, 9, 1, 3, 0, 0)
    _disable_skip_healthy_daily_fallback(session)
    poule = _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=3), match_offset_hours=-28, status="final",
    )  # tick = now - 3u + 24u = 2026-09-02 00:00 -> na 18:00 het venster ervoor

    events = build_schedule_events(session, now, horizon_days=3)

    fallback = next(e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == poule.poule_id)
    assert fallback["planned_at"].hour == 9
    assert fallback["planned_at"].date() == (now + timedelta(days=1)).date()


def test_scan_window_is_configurable(session):
    now = datetime(2026, 9, 1, 3, 0, 0)
    _disable_skip_healthy_daily_fallback(session)
    session.add(AppSetting(key="scan_window_start_hour", value="7"))
    session.add(AppSetting(key="scan_window_end_hour", value="20"))
    poule = _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=24), match_offset_hours=-28, status="final",
    )
    session.commit()

    events = build_schedule_events(session, now, horizon_days=2)

    fallback = next(e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == poule.poule_id)
    assert fallback["planned_at"].hour == 7


def test_match_end_check_and_match_start_check_are_not_clamped_to_the_scan_window(session):
    """Wedstrijd-gebonden momenten (match_end_check/match_start_check) hangen
    aan de echte wedstrijdtijd (kan 's avonds zijn) en mogen NIET verschoven
    worden naar het scan-venster - alleen niet-wedstrijd-gebonden momenten
    wel."""
    now = datetime(2026, 9, 1, 20, 30, 0)  # ruim buiten het standaard venster
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2), match_offset_hours=-0.5, status="scheduled")

    events = build_schedule_events(session, now, horizon_days=1)

    burst = [e for e in events if e["reason"] == "match_end_check" and e["target_id"] == 444]
    assert burst
    assert burst[0]["planned_at"].hour >= 20  # niet verplaatst naar 09:00-18:00


def test_manual_weekly_uses_the_configurable_window_start_hour(session):
    now = datetime(2026, 9, 1, 3, 0, 0)  # dinsdag
    session.add(AppSetting(key="scan_window_start_hour", value="11"))
    comp = HockeyCompetition(
        external_id="test|manual-window", name="Manual Window Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    poule = HockeyPoule(poule_id=999, name="Poule M", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=99, club_external_id="HH11ZZ0", name="Manual Team", short_name="M1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=999,
    ))
    # item 1018: "ongezond" (overdue_result) - anders wordt dit event nu geskipt.
    session.add(HockeyPouleMatch(
        poule_id=999, match_id=1, home_team_id=1, away_team_id=2,
        status="scheduled", round=1, match_date=(now - timedelta(hours=4)).isoformat(),
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=7)

    manual = next(e for e in events if e["reason"] == "manual_weekly" and e["target_id"] == 999)
    assert manual["planned_at"].hour == 11


def test_rebuild_does_not_drop_an_overdue_daily_fallback_tick(session):
    """item 1031 (Bart, 1-09-2026, gevonden tijdens het testen van de
    vooruitkijk-optie op 'Queue nu versnellen'): een rebuild wiste voorheen
    OOK cadans-rijen die al due waren (planned_at <= now) maar nog niet
    gepromoveerd - de herberekening zag alleen dat de tick al voorbij was en
    sloeg 'm over, sprong door naar de eerstvolgende cyclus (24u verder). Zo'n
    dag werd stilzwijgend overgeslagen, ongeacht of dat kwam door Ghost-
    downtime of gewoon een reguliere pass die net na het due-moment viel."""
    _disable_skip_healthy_daily_fallback(session)
    now0 = datetime(2026, 8, 30, 8, 0, 0)
    comp = HockeyCompetition(
        external_id="test|rebuild-drop", name="Rebuild Drop Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub-drop", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=999101, name="Poule Drop", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now0 - timedelta(hours=23, minutes=45))
    session.add(poule)
    session.add(HockeyTeam(
        team_id=999101, club_external_id="DROP_CLUB", name="Drop Team", short_name="H1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=999101,
    ))
    # Wedstrijd 1: al afgelopen zonder finale uitslag -> "ongezond" (item 1018).
    session.add(HockeyPouleMatch(
        poule_id=999101, match_id=1, home_team_id=999101, away_team_id=999102,
        status="scheduled", round=1, match_date=(now0 - timedelta(days=1)).isoformat(),
    ))
    # Wedstrijd 2: nog te spelen, binnen de lookahead, ver genoeg weg om geen
    # matchday-preempt op vandaag te triggeren.
    session.add(HockeyPouleMatch(
        poule_id=999101, match_id=2, home_team_id=999101, away_team_id=999102,
        status="scheduled", round=2, match_date=(now0 + timedelta(days=5)).isoformat(),
    ))
    session.commit()

    rebuild_schedule(session, now0, 14)
    promote_due_schedule_entries(session, now0, cap=100)
    # De daily_fallback-tick klemt naar 09:00 (scan_window_start_hour) - om
    # 08:00 nog niet due. Andere reasons (bv. club_list) kunnen wel al
    # gepromoveerd zijn, dat is niet waar deze test op let.
    cmds_before = session.exec(select(VangerCmd)).all()
    assert not any(c.cmd_type == "get_poule" and c.reason == "daily_fallback" for c in cmds_before)

    # Ghost was niet gestart / de volgende pass viel pas 90 min later - NA het
    # geplande tijdstip (09:00).
    now1 = now0 + timedelta(hours=1, minutes=30)
    rebuild_schedule(session, now1, 14)
    promote_due_schedule_entries(session, now1, cap=100)

    cmds = session.exec(select(VangerCmd)).all()
    assert any(c.cmd_type == "get_poule" and c.reason == "daily_fallback" for c in cmds), (
        "daily_fallback mag niet stilzwijgend een cyclus overslaan als een rebuild na het due-moment valt"
    )


def test_rebuild_does_not_drop_an_overdue_match_start_check(session):
    """item 1031, 2e bevinding: match_start_check gebruikt (als enige
    matchday-reason) GEEN 'tick=max(tick,now)'-vangnet - zonder bescherming
    verdween een gemist check-moment PERMANENT (geen catch-up zoals bij
    daily_fallback, gewoon voorgoed weg voor die wedstrijd)."""
    now0 = datetime(2026, 9, 1, 10, 0, 0)
    comp = HockeyCompetition(
        external_id="test|start-check-drop", name="Start Check Drop Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub-sc-drop", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=999102, name="Poule SC Drop", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=999102, club_external_id="SC_DROP_CLUB", name="Start Check Drop Team", short_name="H1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=999102,
    ))
    # Wedstrijd begint om 10:00 -> match_start_check zou op 10:15 moeten liggen
    # (live_check_delay_min default 15).
    session.add(HockeyPouleMatch(
        poule_id=999102, match_id=1, home_team_id=999102, away_team_id=999103,
        status="scheduled", round=1, match_date=now0.isoformat(),
    ))
    session.commit()

    rebuild_schedule(session, now0, 14)
    rows = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 999102)).all()
    assert any(r.reason == "match_start_check" for r in rows)

    # Ghost was niet gestart tussen 10:00 en 10:30 - het check-moment (10:15)
    # is dus al gepasseerd voor de volgende rebuild draait.
    now1 = now0 + timedelta(minutes=30)
    rebuild_schedule(session, now1, 14)
    promoted = promote_due_schedule_entries(session, now1, cap=100)

    rows_after = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 999102)).all()
    assert any(r.reason == "match_start_check" for r in rows_after), (
        "match_start_check mag niet stilzwijgend verdwijnen als een rebuild na het check-moment valt"
    )
    assert promoted >= 1
    cmds = session.exec(select(VangerCmd)).all()
    assert any(c.cmd_type == "get_poule" and c.reason == "match_start_check" for c in cmds)
