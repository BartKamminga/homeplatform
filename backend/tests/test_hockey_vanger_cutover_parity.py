"""Pariteits-/equivalentietest voor de Fase C-cutover (item 1019).

Bewijst dat het OUDE pad (run_scan_plan_pass, schrijft VangerCmd direct) en
het NIEUWE pad (rebuild_schedule + promote_due_schedule_entries, via
ScanScheduleEntry) exact dezelfde VangerCmd-rijen opleveren voor eenzelfde
startsituatie - de concrete, herhaalbare invulling van "vertrouwen dat de
promotie-kant het filter betrouwbaar en volledig afhandelt" (item 1019,
deelvraag 4) voordat de _step_*-functies buiten dienst worden gesteld.

Bewust GEEN vaste verwachte reasons/aantallen - de vergelijking is puur
OUD-SET == NIEUW-SET, ongeacht welke dag/tijd de test toevallig draait
(bv. manual_weekly/club_scan hangen af van weekdag) - zolang beide paden
het MET ELKAAR eens zijn, is de pariteit bewezen."""

import json
from datetime import datetime, timedelta, timezone

from sqlmodel import select

from models.hockey import HockeyPublication, HockeyPublicationComp
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, VangerCmd
from services.hockey_vanger_scanplan import run_scan_plan_pass
from services.hockey_vanger_schedule import DEFAULT_HORIZON_DAYS, promote_due_schedule_entries, rebuild_schedule


def _cmd_signature(cmd: VangerCmd):
    params = json.loads(cmd.params)
    key_field = {"get_poule": "poule_id", "scan_club": "external_id", "get_competition_detail": "comp_id"}.get(cmd.cmd_type)
    dedup_key = params.get(key_field) if key_field else None
    return (cmd.cmd_type, dedup_key, cmd.reason)


def _build_fixture(session, now):
    # 1. Eligible active-profiel poule met een niet-finale wedstrijd van
    #    vandaag, ruim afgelopen -> matchday-due (match_end_check/retry_match_end).
    comp_active = HockeyCompetition(
        external_id="parity|active", name="Parity Active", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp_active)
    session.commit()
    session.refresh(comp_active)
    session.add(HockeyPublication(id="parity-pub-active", name="Parity Pub Active", published=True))
    session.add(HockeyPublicationComp(publication_id="parity-pub-active", competition_id=comp_active.id, scan_profile="active", visible=True))
    poule_active = HockeyPoule(poule_id=90001, name="Poule Active", competition_id=comp_active.id, season="2026-2027",
                                last_scanned_at=now - timedelta(hours=2))
    session.add(poule_active)
    session.add(HockeyTeam(
        team_id=90001, club_external_id="HH90ZZ0", name="Parity Active Team", short_name="H1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=90001,
    ))
    session.add(HockeyPouleMatch(
        poule_id=90001, match_id=90001, home_team_id=90001, away_team_id=90002,
        status="scheduled", round=1, match_date=(now - timedelta(hours=3)).isoformat(),
    ))
    # Wedstrijd verderop (item 1016/1018): zonder toekomstige wedstrijd binnen
    # 7 dagen is de poule "seizoen voorbij" en levert geen event op.
    session.add(HockeyPouleMatch(
        poule_id=90001, match_id=90002, home_team_id=90001, away_team_id=90002,
        status="scheduled", round=2, match_date=(now + timedelta(days=3)).isoformat(),
    ))

    # 2. Demoted active-profiel (niet gepubliceerd) - valt terug op manual_weekly.
    comp_demoted = HockeyCompetition(
        external_id="parity|demoted", name="Parity Demoted", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp_demoted)
    session.commit()
    session.refresh(comp_demoted)
    session.add(HockeyPublication(id="parity-pub-demoted", name="Parity Pub Demoted", published=False))
    session.add(HockeyPublicationComp(publication_id="parity-pub-demoted", competition_id=comp_demoted.id, scan_profile="active", visible=True))
    poule_demoted = HockeyPoule(poule_id=90010, name="Poule Demoted", competition_id=comp_demoted.id, season="2026-2027",
                                 last_scanned_at=now - timedelta(days=10))
    session.add(poule_demoted)
    session.add(HockeyTeam(
        team_id=90010, club_external_id="HH90ZZ1", name="Parity Demoted Team", short_name="H1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=90010,
    ))
    session.add(HockeyPouleMatch(
        poule_id=90010, match_id=90010, home_team_id=90010, away_team_id=90011,
        status="scheduled", round=1, match_date=(now - timedelta(hours=4)).isoformat(),
    ))

    # 3. Manual-profiel poule (stale, ongezond).
    comp_manual = HockeyCompetition(
        external_id="parity|manual", name="Parity Manual", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp_manual)
    session.commit()
    session.refresh(comp_manual)
    session.add(HockeyPublication(id="parity-pub-manual", name="Parity Pub Manual", published=True))
    session.add(HockeyPublicationComp(publication_id="parity-pub-manual", competition_id=comp_manual.id, scan_profile="manual"))
    poule_manual = HockeyPoule(poule_id=90020, name="Poule Manual", competition_id=comp_manual.id, season="2026-2027",
                                last_scanned_at=now - timedelta(days=10))
    session.add(poule_manual)
    session.add(HockeyTeam(
        team_id=90020, club_external_id="HH90ZZ2", name="Parity Manual Team", short_name="H1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=90020,
    ))
    session.add(HockeyPouleMatch(
        poule_id=90020, match_id=90020, home_team_id=90020, away_team_id=90021,
        status="scheduled", round=1, match_date=(now - timedelta(hours=4)).isoformat(),
    ))

    # 4. Landelijke competitie (hl_comp_id) met een niet-finale wedstrijd.
    # Naam moet door _derive_competition_category als "Junioren" herkend
    # worden (zelfde reden als de category_group_name="Junioren"-teams
    # hierboven) - anders raakt het item-1015-promotiefilter (dat
    # _step_landelijke_competitions zelf nooit toepast) 'm onterecht.
    comp_hl = HockeyCompetition(
        external_id="parity|landelijk", name="Parity Landelijk Jongens O16", class_name="Topklasse",
        hockey_type="VE", season="2026-2027", hl_comp_id=90030,
    )
    session.add(comp_hl)
    session.commit()
    session.refresh(comp_hl)
    poule_hl = HockeyPoule(poule_id=90031, name="Poule HL", competition_id=comp_hl.id, season="2026-2027",
                            last_scanned_at=now - timedelta(hours=2))
    session.add(poule_hl)
    session.add(HockeyPouleMatch(
        poule_id=90031, match_id=90031, home_team_id=90040, away_team_id=90041,
        status="scheduled", round=1, match_date=(now - timedelta(hours=3)).isoformat(),
    ))
    session.add(HockeyPouleMatch(
        poule_id=90031, match_id=90032, home_team_id=90040, away_team_id=90041,
        status="scheduled", round=2, match_date=(now + timedelta(days=3)).isoformat(),
    ))

    # 5. Nieuw team -> nog niet ontdekte poule (new_or_empty fase 1).
    session.add(HockeyTeam(
        team_id=90050, club_external_id="HH90ZZ3", name="Parity New Team", short_name="H1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=90051,
    ))

    # 6. Al gecapturede, lege poule met team-link (new_or_empty fase 2).
    poule_empty = HockeyPoule(poule_id=90060, name="Poule Empty", competition_id=comp_manual.id, season="2026-2027")
    session.add(poule_empty)
    session.add(HockeyTeam(
        team_id=90060, club_external_id="HH90ZZ4", name="Parity Empty Team", short_name="H1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=90060,
    ))

    # 7. Club die scan_club nodig heeft.
    session.add(HockeyClub(
        external_id="PARITY_CLUB", name="Parity Club", friendly_name="Parity Club",
        detail_loaded=False,
    ))

    session.commit()


def test_old_and_new_path_produce_the_same_vanger_cmds(session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    _build_fixture(session, now)

    # ── OUDE PAD ──
    run_scan_plan_pass(session)
    old_cmds = session.exec(select(VangerCmd)).all()
    old_signatures = {_cmd_signature(c) for c in old_cmds}
    assert old_signatures, "fixture leverde niets op in het oude pad - test zelf is dan zinloos"

    # Alleen de zojuist aangemaakte VangerCmd-rijen weg - de onderliggende
    # discovery-data (poules/teams/matches/clubs) blijft ongewijzigd, zodat
    # het nieuwe pad exact dezelfde startsituatie ziet.
    for cmd in old_cmds:
        session.delete(cmd)
    session.commit()

    # ── NIEUWE PAD ──
    rebuild_schedule(session, now, DEFAULT_HORIZON_DAYS)
    promote_due_schedule_entries(session, now, cap=100)
    new_cmds = session.exec(select(VangerCmd)).all()
    new_signatures = {_cmd_signature(c) for c in new_cmds}

    assert new_signatures == old_signatures
