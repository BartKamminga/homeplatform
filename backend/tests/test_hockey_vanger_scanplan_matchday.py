"""Tests voor de matchday-interval-toggle in _step_active_profiles (item 968)."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, VangerCmd
from models.settings import AppSetting
from services.hockey_vanger_scanplan import (
    ACTIVE_MATCHDAY_ENABLED_KEY, SKIP_HEALTHY_DAILY_FALLBACK_KEY, _is_autoscan_eligible, _manual_scan_weekday,
    _reclaim_stale_in_progress, _scan_profile_comp_ids, _step_active_profiles, _step_manual_profiles_weekly,
    _step_new_or_empty_poules,
)


def _disable_skip_healthy_daily_fallback(session):
    """item 1018: veel bestaande daily_fallback-cadans-tests gebruiken bewust
    'schone' wedstrijddata (status=final, geen onbekende starttijd) om de
    burst-logica uit te schakelen - dat maakt de poule nu ook 'gezond',
    wat de nieuwe skip (default AAN) zou laten afgaan. Deze tests testen de
    cadans zelf, niet de gezond-skip (die heeft eigen tests) - hier expliciet
    uitzetten houdt ze bij hun oorspronkelijke scenario."""
    session.add(AppSetting(key=SKIP_HEALTHY_DAILY_FALLBACK_KEY, value="0"))


def _next_weekday(base, weekday):
    """Eerstvolgende datum (op of na base) die op de gevraagde ISO-weekday valt
    (maandag=0 .. zondag=6) - zodat de maandag/vrijdag-tests niet afhangen van
    de dag waarop ze toevallig draaien."""
    days_ahead = (weekday - base.weekday()) % 7
    return base + timedelta(days=days_ahead)


def _setup_active_competition(session, now, last_scanned_at):
    comp = HockeyCompetition(
        external_id="test|matchday-comp", name="Matchday Test", class_name="District",
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
        team_id=9, club_external_id="HH11ZZ0", name="Matchday Team", short_name="H9",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=444,
    ))
    # Wedstrijd van vandaag, ruim afgelopen (dus in principe "matchday due").
    match_start = now - timedelta(hours=3)
    session.add(HockeyPouleMatch(
        poule_id=444, match_id=7001, home_team_id=9, away_team_id=10,
        status="finished", round=1, match_date=match_start.isoformat(),
    ))
    # Altijd ook een wedstrijd verderop in het seizoen, binnen 7 dagen
    # (item 1016 + de latere 7-dagen-vooruitkijk-uitbreiding: een poule
    # zonder ENIGE toekomstige wedstrijd, of zonder wedstrijd binnen 7
    # dagen, krijgt geen daily_fallback meer) - deze helper test de
    # cadans-logica, niet het einde-van-seizoen-gedrag (dat heeft een eigen
    # test).
    session.add(HockeyPouleMatch(
        poule_id=444, match_id=79999, home_team_id=9, away_team_id=10,
        status="scheduled", round=2, match_date=(now + timedelta(days=3)).isoformat(),
    ))
    session.commit()
    return poule


def test_matchday_boost_triggers_early_rescan_when_enabled(session):
    now = datetime.utcnow()
    # 2 uur geleden gescand - binnen de dagelijkse fallback (24u), dus dat
    # alleen zou "niet due" opleveren; de matchday-boost (45 min) moet 'm alsnog
    # oppikken omdat de wedstrijd van vandaag al voorbij is.
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    added = _step_active_profiles(session, now, cap=10)
    assert added == 1


def test_matchday_boost_disabled_falls_back_to_daily_interval(session):
    now = datetime.utcnow()
    session.add(AppSetting(key=ACTIVE_MATCHDAY_ENABLED_KEY, value="0"))
    session.commit()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    added = _step_active_profiles(session, now, cap=10)
    assert added == 0  # 2u geleden gescand, binnen de 24u-fallback -> niet due


def test_matchday_boost_disabled_still_uses_daily_fallback_when_stale(session):
    now = datetime.utcnow()
    session.add(AppSetting(key=ACTIVE_MATCHDAY_ENABLED_KEY, value="0"))
    session.commit()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))

    added = _step_active_profiles(session, now, cap=10)
    assert added == 1  # ouder dan de dagelijkse fallback -> alsnog due


# ── stale in_progress reclaim (roadmap-melding 29-08-2026) ──────────────

def test_reclaim_resets_a_cmd_stuck_in_progress_past_the_timeout(session):
    now = datetime.utcnow()
    session.add(VangerCmd(
        cmd_type="get_poule", params='{"poule_id": 1}', status="in_progress",
        started_at=now - timedelta(minutes=20),
    ))
    session.commit()

    reclaimed = _reclaim_stale_in_progress(session, now)

    assert reclaimed == 1
    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.status == "failed"
    assert cmd.finished_at == now
    assert "Timeout" in cmd.error


def test_reclaim_leaves_a_recently_started_cmd_alone(session):
    now = datetime.utcnow()
    session.add(VangerCmd(
        cmd_type="get_poule", params='{"poule_id": 1}', status="in_progress",
        started_at=now - timedelta(minutes=2),
    ))
    session.commit()

    reclaimed = _reclaim_stale_in_progress(session, now)

    assert reclaimed == 0
    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.status == "in_progress"


def test_reclaim_timeout_is_configurable(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="stale_cmd_timeout_min", value="2"))
    session.add(VangerCmd(
        cmd_type="get_poule", params='{"poule_id": 1}', status="in_progress",
        started_at=now - timedelta(minutes=5),
    ))
    session.commit()

    reclaimed = _reclaim_stale_in_progress(session, now)

    assert reclaimed == 1


# ── item 1013: landelijke competities niet los per poule scannen ────────

def test_step_active_profiles_skips_a_poule_from_an_hl_comp_id_competition(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    comp = session.get(HockeyCompetition, poule.competition_id)
    comp.hl_comp_id = 21
    session.add(comp)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0  # zou zonder de guard due zijn (25u > 24u fallback)


def test_step_new_or_empty_poules_skips_a_poule_from_an_hl_comp_id_competition(session):
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|hl-comp", name="Landelijk Test", class_name="Topklasse",
        hockey_type="VE", season="2026-2027", hl_comp_id=99,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    poule = HockeyPoule(poule_id=555, name="Poule Z", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=42, club_external_id="HH11ZZ0", name="Test Team", short_name="H1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=555,
    ))
    session.commit()

    added = _step_new_or_empty_poules(session, "2026-2027", cap=10)

    assert added == 0  # poule heeft geen matches, zou anders opgepakt worden


def test_step_new_or_empty_poules_skips_a_team_outside_the_queue_filter(session):
    """Bart, 30-08-2026: 'dit zijn allemaal senioren poules' - new_or_empty
    moet het actieve queue-filter (default Junioren-only) al bij het
    AANMAKEN respecteren, niet pas bij promotie/pickup - anders vullen
    buiten-filter-ontdekkingen dezelfde cap als de echte ontdekkingen en
    blijven ze als nutteloze clutter in de queue staan."""
    session.add(HockeyTeam(
        team_id=77, club_external_id="HH77ZZ0", name="Senior Team", short_name="H1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=999999,
    ))
    session.commit()

    added = _step_new_or_empty_poules(session, "2026-2027", cap=10)

    assert added == 0


# ── item 970: live-check kort na aanvang van de wedstrijd ────────────────

def test_step_active_profiles_triggers_a_one_time_live_check_shortly_after_kickoff(session):
    now = datetime.utcnow()
    # Wedstrijd 20 minuten geleden begonnen, nog lang niet afgelopen (90 min
    # duur) - buiten de matchday-boost (die pas na afloop reageert) en
    # buiten de dagelijkse fallback (recent gescand). Default
    # live_check_delay_min=15 -> we zitten nu in het live-check-venster.
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = (now - timedelta(minutes=20)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1


def test_live_check_does_not_fire_again_after_it_already_ran(session):
    now = datetime.utcnow()
    match_start = now - timedelta(minutes=20)
    # last_scanned_at ligt NA de wedstrijdstart - de live-check is dus al
    # eerder deze wedstrijd gedaan, mag niet nogmaals vuren.
    poule = _setup_active_competition(session, now, last_scanned_at=match_start + timedelta(minutes=1))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = match_start.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


# ── burst-modus stopt zodra alles bekend is of de deadline voorbij is ────

def test_burst_mode_stops_once_all_of_todays_matches_are_final(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(minutes=50))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0  # zonder de all-final-check zou de matchday-boost 'm alsnog due maken


def test_burst_mode_stops_after_the_configured_hours_past_the_last_match(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(minutes=50))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    # Wedstrijd 4u geleden begonnen (dus 2.5u geleden geeindigd bij 90 min
    # duur) - bewust NIET op "final" gezet, om puur de tijd-gebaseerde
    # stopregel te testen (standaard burst_stop_hours_after_last_match=2u
    # is dan al gepasseerd).
    match.match_date = (now - timedelta(hours=4)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


def test_burst_stop_hours_after_last_match_is_configurable(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="burst_stop_hours_after_last_match", value="5"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(minutes=50))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = (now - timedelta(hours=4)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1  # met een ruimere deadline (5u) valt de wedstrijd nog binnen burst-bereik


def test_burst_mode_does_not_fire_in_the_dead_zone_between_2_unrelated_matches(session):
    """Bart, 30-08-2026 (poule #180929): een poule met een wedstrijd om 10:20
    en een om 14:30 werd tussen die 2 in nog steeds elke
    active_matchday_interval_min opnieuw gescand, puur omdat de wedstrijd
    van 14:30 de dag als geheel nog niet "af" liet zijn - terwijl wedstrijd
    A's eigen burst_stop_h-deadline allang was verstreken en wedstrijd B nog
    niet eens was afgelopen. match_end_check is per wedstrijd: geen van
    beide is op dit moment individueel due, dus hoort er hier GEEN scan te
    zijn."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|matchday-deadzone", name="Matchday Deadzone Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(
        poule_id=777, name="Poule Deadzone", competition_id=comp.id, season="2026-2027",
        last_scanned_at=now - timedelta(hours=6),
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=29, club_external_id="HH13ZZ0", name="Deadzone Team", short_name="H29",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=777,
    ))
    # Wedstrijd A eindigde ruim voorbij haar eigen burst_stop_h-deadline
    # (standaard 2u): einde over 3.5u geleden (duration 90 min), dus
    # deadline lag al 1.5u geleden.
    session.add(HockeyPouleMatch(
        poule_id=777, match_id=9001, home_team_id=29, away_team_id=30,
        status="scheduled", round=1, match_date=(now - timedelta(hours=5)).isoformat(),
    ))
    # Wedstrijd B begint pas over 2u, dus is nog lang niet afgelopen.
    session.add(HockeyPouleMatch(
        poule_id=777, match_id=9002, home_team_id=29, away_team_id=30,
        status="scheduled", round=2, match_date=(now + timedelta(hours=2)).isoformat(),
    ))
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


def test_live_check_delay_is_configurable(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="live_check_delay_min", value="5"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = (now - timedelta(minutes=6)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1


# ── onbekende starttijd binnen X dagen vaker checken ─────────────────────

def test_unknown_start_time_within_lookahead_triggers_a_more_frequent_rescan(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    # Wedstrijd over 3 dagen, datum al bekend maar starttijd nog niet
    # (middernacht-placeholder) - binnen de standaard lookahead van 5 dagen.
    future_date = (now + timedelta(days=3)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1  # 10u geleden gescand > unknown_start_fallback_hours (8u default) -> due


def test_unknown_start_time_beyond_lookahead_does_not_trigger_extra_rescan(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    future_date = (now + timedelta(days=20)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0  # 20 dagen vooruit valt buiten de standaard 5-dagen-lookahead


def test_unknown_start_lookahead_days_is_configurable(session):
    now = datetime.utcnow()
    session.add(AppSetting(key="unknown_start_lookahead_days", value="30"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    future_date = (now + timedelta(days=20)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1


# ── item: niet-autoscan (scan_profile='manual') publicaties 1x per week,
# verdeeld over maandag/vrijdag ───────────────────────────────────────────

def _setup_manual_competition(session, comp_id_hint, last_scanned_at, healthy=False):
    comp = HockeyCompetition(
        external_id=f"test|manual-{comp_id_hint}", name=f"Manual Test {comp_id_hint}", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    poule = HockeyPoule(
        poule_id=9000 + comp_id_hint, name="Poule M", competition_id=comp.id, season="2026-2027",
        last_scanned_at=last_scanned_at,
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=9000 + comp_id_hint, club_external_id="HH11ZZ0", name="Manual Team", short_name="M1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=poule.poule_id,
    ))
    if not healthy:
        # item 1018: "ongezond" (overdue_result) - een gespeelde wedstrijd
        # zonder eindstand - zodat de cadence-tests in dit bestand blijven
        # testen wat ze bedoelen (de weekday/cutoff-regels), los van de nieuwe
        # gezond-skip. De losse "healthy=True"-tests hieronder testen die skip.
        session.add(HockeyPouleMatch(
            poule_id=poule.poule_id, match_id=1000 + comp_id_hint, home_team_id=1, away_team_id=2,
            status="scheduled", round=1, match_date=(datetime.utcnow() - timedelta(hours=4)).isoformat(),
        ))
    else:
        # "bewezen gezond" heeft minstens 1 bekende, niet-problematische match
        # nodig - geen enkele match (dus geen entry in _poule_health) betekent
        # "nog niets bekend", niet "gezond", en zou dan juist NIET geskipt
        # moeten worden.
        session.add(HockeyPouleMatch(
            poule_id=poule.poule_id, match_id=1000 + comp_id_hint, home_team_id=1, away_team_id=2,
            status="final", round=1, match_date=(datetime.utcnow() - timedelta(hours=4)).isoformat(),
        ))
    session.commit()
    session.refresh(comp)
    session.refresh(poule)
    return comp, poule


def test_manual_profile_scans_on_its_assigned_weekday(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=1, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 1


def test_manual_profile_does_not_scan_on_the_other_weekday(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=2, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    target_weekday = _manual_scan_weekday(comp.id)
    other_weekday = (target_weekday + 1) % 5
    now = _next_weekday(datetime.utcnow(), other_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 0


def test_manual_profile_skips_if_recently_scanned(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=3, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)
    poule.last_scanned_at = now - timedelta(days=1)
    session.add(poule)
    session.commit()

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 0


def test_manual_profiles_weekly_ignores_active_scan_profile_competitions(session):
    now_monday = _next_weekday(datetime.utcnow(), 0).replace(hour=10, minute=0, second=0, microsecond=0)
    _setup_active_competition(session, now_monday, last_scanned_at=now_monday - timedelta(days=10))

    added = _step_manual_profiles_weekly(session, now_monday, cap=10)

    assert added == 0


def test_manual_profiles_weekly_skips_a_landelijke_competition(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=4, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    comp.hl_comp_id = 55
    session.add(comp)
    session.commit()
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 0  # al gedekt door _step_landelijke_competitions


def test_manual_profiles_weekly_skips_a_healthy_poule(session):
    # item 1018: geen onbekende starttijd binnen 7 dagen, geen gespeelde-maar-
    # niet-finale wedstrijd - "gezond" is de wekelijkse ronde niet waard.
    comp, poule = _setup_manual_competition(
        session, comp_id_hint=5, last_scanned_at=datetime.utcnow() - timedelta(days=10), healthy=True,
    )
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 0


# ── reason wordt getagd op de aangemaakte VangerCmd (scan-historie) ──────

def test_match_end_check_cmd_is_tagged_with_its_reason(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    _step_active_profiles(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "match_end_check"


def test_match_start_check_cmd_is_tagged_with_its_reason(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.match_date = (now - timedelta(minutes=20)).isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    _step_active_profiles(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "match_start_check"


def test_match_live_during_play_cmd_is_tagged_with_its_reason(session):
    """Bart, 30-08-2026: tussen het 1x match_start_check-moment en het einde
    van de wedstrijd zat een dode zone - een wedstrijd die al langer bezig
    is dan het match_start_check-venster, maar nog niet is afgelopen, moet
    periodiek doorscannen met reason match_live (dynamisch, "net als bij
    match_start_scan -> blijkt live wedstrijd te zijn -> match_live events
    inplannen"), ook al vóór het voorspelde einde, zolang de wedstrijd
    bevestigd live staat."""
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    # Gestart 70 min geleden, standaardduur 90 min -> nog 20 min te gaan, en
    # het match_start_check-venster (15 min delay + 10 min retry_match_end
    # = 25 min) is al voorbij.
    match.match_date = (now - timedelta(minutes=70)).isoformat()
    match.status = "live"
    session.add(match)
    session.commit()

    _step_active_profiles(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "match_live"


def test_daily_fallback_cmd_is_tagged_with_its_reason(session):
    now = datetime.utcnow()
    _disable_skip_healthy_daily_fallback(session)
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"  # burst uitgeschakeld, puur de dagelijkse fallback testen
    session.add(match)
    session.commit()

    _step_active_profiles(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "daily_fallback"


def test_daily_fallback_skips_a_healthy_poule_by_default(session):
    # item 1018: default AAN - geen onbekende starttijd binnen 7 dagen, geen
    # gespeelde-maar-niet-finale wedstrijd -> "gezond", dagelijkse fallback
    # niet nodig.
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"  # geen overdue_result meer
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


def test_daily_fallback_still_fires_for_a_healthy_poule_when_the_toggle_is_off(session):
    now = datetime.utcnow()
    session.add(AppSetting(key=SKIP_HEALTHY_DAILY_FALLBACK_KEY, value="0"))
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"
    session.add(match)
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1


def test_daily_fallback_is_skipped_once_the_season_is_over(session):
    """Item 1016 (Bart, 30-08-2026): een poule met minstens 1 bekende
    wedstrijd, en ze zijn ALLEMAAL al geweest, heeft niets meer te
    ontdekken - een dagelijkse heartbeat-scan is dan verspilde moeite."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|season-over", name="Season Over Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=555, name="Poule Klaar", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=25))
    session.add(poule)
    session.add(HockeyTeam(
        team_id=20, club_external_id="HH20ZZ0", name="Klaar Team", short_name="H20",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=555,
    ))
    session.add(HockeyPouleMatch(
        poule_id=555, match_id=8001, home_team_id=20, away_team_id=21,
        status="final", round=1, match_date=(now - timedelta(days=3)).isoformat(),
    ))
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


def test_daily_fallback_is_skipped_during_a_quiet_week(session):
    """Bart, 30-08-2026: 'als alles van een poule of comp bekend is ...
    kunnen de daily_fallback voor die poule/comp vervallen voor de komende
    week' - een poule die stale genoeg is voor de dagelijkse fallback, maar
    waarvan de eerstvolgende wedstrijd nog meer dan 7 dagen weg is, heeft
    niets te ontdekken tot die dichterbij komt."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|quiet-week", name="Quiet Week Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=777, name="Poule Rustig", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=25))
    session.add(poule)
    session.add(HockeyTeam(
        team_id=30, club_external_id="HH30ZZ0", name="Rustig Team", short_name="H30",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=777,
    ))
    session.add(HockeyPouleMatch(
        poule_id=777, match_id=8501, home_team_id=30, away_team_id=31,
        status="scheduled", round=1, match_date=(now + timedelta(days=10)).isoformat(),
    ))
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0  # 10 dagen weg -> buiten het 7-dagen-lookahead-venster


def test_daily_fallback_resumes_once_the_quiet_week_is_over(session):
    """Zelfde scenario als hierboven, maar nu 5 dagen tot de eerstvolgende
    wedstrijd (binnen het 7-dagen-venster) - de dagelijkse fallback moet
    dan gewoon weer aanslaan."""
    now = datetime.utcnow()
    _disable_skip_healthy_daily_fallback(session)
    comp = HockeyCompetition(
        external_id="test|quiet-week-resume", name="Quiet Week Resume Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=778, name="Poule Bijna", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=25))
    session.add(poule)
    session.add(HockeyTeam(
        team_id=31, club_external_id="HH31ZZ0", name="Bijna Team", short_name="H31",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=778,
    ))
    session.add(HockeyPouleMatch(
        poule_id=778, match_id=8502, home_team_id=31, away_team_id=32,
        status="scheduled", round=1, match_date=(now + timedelta(days=5)).isoformat(),
    ))
    session.commit()

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1
    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "daily_fallback"


def test_manual_weekly_cmd_is_tagged_with_its_reason(session):
    comp, poule = _setup_manual_competition(session, comp_id_hint=10, last_scanned_at=datetime.utcnow() - timedelta(days=10))
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(datetime.utcnow(), target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    _step_manual_profiles_weekly(session, now, cap=10)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "manual_weekly"


# ── item 1022: active-competitie zonder publieke zichtbaarheid valt terug op manual_weekly ──

def _setup_active_competition_with_visibility(session, now, comp_id_hint, published, visible):
    from models.hockey import HockeyPublication

    comp = HockeyCompetition(
        external_id=f"test|visibility-{comp_id_hint}", name=f"Visibility Test {comp_id_hint}", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    pub_id = f"pub-visibility-{comp_id_hint}"
    session.add(HockeyPublication(id=pub_id, name="Visibility Publication", published=published))
    session.add(HockeyPublicationComp(
        publication_id=pub_id, competition_id=comp.id, scan_profile="active", visible=visible,
    ))
    poule = HockeyPoule(
        # 10 dagen geleden - ruim voorbij zowel de daily_fallback- (24u) als
        # de manual_weekly-cutoff (6 dagen), ongeacht hoever _next_weekday
        # 'now' in de aanroepende test naar voren schuift.
        poule_id=9500 + comp_id_hint, name="Poule V", competition_id=comp.id, season="2026-2027",
        last_scanned_at=now - timedelta(days=10),
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=9500 + comp_id_hint, club_external_id="HH11ZZ0", name="Visibility Team", short_name="H1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=poule.poule_id,
    ))
    # Ongezond (overdue_result) zodat de test onafhankelijk is van skip_healthy_daily_fallback.
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=9000 + comp_id_hint, home_team_id=1, away_team_id=2,
        status="scheduled", round=1, match_date=(now - timedelta(hours=4)).isoformat(),
    ))
    # Altijd ook een wedstrijd verderop in het seizoen (item 1016/1018: zonder
    # ENIGE toekomstige wedstrijd binnen 7 dagen is de poule "seizoen voorbij/
    # rustige week" en krijgt sowieso geen daily_fallback, los van gezondheid).
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=9100 + comp_id_hint, home_team_id=1, away_team_id=2,
        status="scheduled", round=2, match_date=(now + timedelta(days=3)).isoformat(),
    ))
    session.commit()
    session.refresh(comp)
    session.refresh(poule)
    return comp, poule


def test_step_active_profiles_skips_an_unpublished_competition(session):
    now = datetime.utcnow()
    _setup_active_competition_with_visibility(session, now, comp_id_hint=1, published=False, visible=True)

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


def test_step_active_profiles_skips_a_hidden_competition_link(session):
    now = datetime.utcnow()
    _setup_active_competition_with_visibility(session, now, comp_id_hint=2, published=True, visible=False)

    added = _step_active_profiles(session, now, cap=10)

    assert added == 0


def test_step_active_profiles_still_scans_a_published_visible_competition(session):
    now = datetime.utcnow()
    _setup_active_competition_with_visibility(session, now, comp_id_hint=3, published=True, visible=True)

    added = _step_active_profiles(session, now, cap=10)

    assert added == 1


def test_step_manual_profiles_weekly_picks_up_an_unpublished_active_competition(session):
    """item 1022: een active-competitie die niet publiek zichtbaar is valt
    terug op DEZELFDE wekelijkse cadans als manual - geen aparte 3e cadans,
    en niet voor altijd stilvallen."""
    now_utc = datetime.utcnow()
    comp, poule = _setup_active_competition_with_visibility(session, now_utc, comp_id_hint=4, published=False, visible=True)
    target_weekday = _manual_scan_weekday(comp.id)
    now = _next_weekday(now_utc, target_weekday).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_manual_profiles_weekly(session, now, cap=10)

    assert added == 1
    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "manual_weekly"


def test_scan_profile_comp_ids_classifies_manual_active_eligible_and_demoted(session):
    from models.hockey import HockeyPublication

    now = datetime.utcnow()
    _, manual_poule = _setup_manual_competition(session, comp_id_hint=20, last_scanned_at=now)
    manual_comp_id = manual_poule.competition_id

    eligible_comp, _ = _setup_active_competition_with_visibility(session, now, comp_id_hint=21, published=True, visible=True)
    demoted_comp, _ = _setup_active_competition_with_visibility(session, now, comp_id_hint=22, published=False, visible=True)

    active_eligible_ids, weekly_fallback_ids = _scan_profile_comp_ids(session)

    assert eligible_comp.id in active_eligible_ids
    assert demoted_comp.id not in active_eligible_ids
    assert demoted_comp.id in weekly_fallback_ids
    assert manual_comp_id in weekly_fallback_ids


def test_scan_profile_comp_ids_treats_a_missing_publication_row_as_published(session):
    """Bewust geen join (die zou een niet-resolvende publication_id
    stilzwijgend laten vallen) - een ontbrekende publicatie telt als
    published=True, geen aanname van onzichtbaarheid bij een kapotte/
    ontbrekende referentie (die normaal niet zou moeten voorkomen)."""
    comp = HockeyCompetition(
        external_id="test|orphaned-pub", name="Orphaned Pub Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="does-not-exist", competition_id=comp.id, scan_profile="active"))
    session.commit()

    active_eligible_ids, _weekly_fallback_ids = _scan_profile_comp_ids(session)

    assert comp.id in active_eligible_ids


def test_is_autoscan_eligible_matches_scan_profile_comp_ids(session):
    now = datetime.utcnow()
    eligible_comp, _ = _setup_active_competition_with_visibility(session, now, comp_id_hint=23, published=True, visible=True)
    demoted_comp, _ = _setup_active_competition_with_visibility(session, now, comp_id_hint=24, published=True, visible=False)

    assert _is_autoscan_eligible(session, eligible_comp.id) is True
    assert _is_autoscan_eligible(session, demoted_comp.id) is False
    assert _is_autoscan_eligible(session, 999999) is False  # geen koppeling
