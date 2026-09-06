"""Tests voor wat er nog leeft in services/hockey_vanger_scanplan.py na het
verwijderen van de _step_*-functies (item 1085, Fase C-cutover is nu
volledig doorgevoerd): _reclaim_stale_in_progress/run_scan_plan_pass
(VangerCmd-hygiëne) en de scan_profile-classificatiehelpers die
hockey_vanger_schedule.py hergebruikt. Was voorheen (deels) in
test_hockey_vanger_scanplan_matchday.py getest, samen met de inmiddels
verwijderde _step_*-tests."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey import HockeyPublication, HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyTeam, VangerCmd
from services.hockey_vanger_scanplan import (
    _is_autoscan_eligible, _reclaim_stale_in_progress, _scan_profile_comp_ids, run_scan_plan_pass,
)


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
    from models.settings import AppSetting

    now = datetime.utcnow()
    session.add(AppSetting(key="stale_cmd_timeout_min", value="2"))
    session.add(VangerCmd(
        cmd_type="get_poule", params='{"poule_id": 1}', status="in_progress",
        started_at=now - timedelta(minutes=5),
    ))
    session.commit()

    reclaimed = _reclaim_stale_in_progress(session, now)

    assert reclaimed == 1


def test_run_scan_plan_pass_only_reclaims_stale_cmds(session):
    """item 1019/1085: regressiebewaker - run_scan_plan_pass doet sinds de
    Fase C-cutover alleen nog _reclaim_stale_in_progress, de rest loopt via
    rebuild_schedule + promote_due_schedule_entries (zie routers/hockey_
    vanger_smartscan_control.py::_maybe_run_scan_plan_pass)."""
    result = run_scan_plan_pass(session)

    assert set(result["steps"].keys()) == {"reclaimed_stale"}


# ── scan_profile-classificatie (item 1022, hergebruikt door schedule.py) ─

def _setup_active_competition_with_visibility(session, now, comp_id_hint, published, visible):
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
        poule_id=9500 + comp_id_hint, name="Poule V", competition_id=comp.id, season="2026-2027",
        last_scanned_at=now - timedelta(days=10),
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=9500 + comp_id_hint, club_external_id="HH11ZZ0", name="Visibility Team", short_name="H1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=poule.poule_id,
    ))
    session.commit()
    session.refresh(comp)
    session.refresh(poule)
    return comp, poule


def _setup_manual_competition(session, comp_id_hint, last_scanned_at):
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
    session.commit()
    session.refresh(comp)
    session.refresh(poule)
    return comp, poule


def test_scan_profile_comp_ids_classifies_manual_active_eligible_and_demoted(session):
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
