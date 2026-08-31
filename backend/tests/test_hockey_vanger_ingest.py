"""Tests voor twee seizoen-labeling-bugs in de poule-capture-ingest (roadmap-melding:
'Jongens O14 Lente' bleef als 2026-2027 rondhangen terwijl het 2025-2026-data was)."""

import json

from sqlmodel import select

from models.hockey_discovery import HockeyCompetition, HockeyPoule, VangerCmd
from routers.hockey_capture import PouleCaptureIn
from services.hockey_vanger_ingest import (
    _call_competition_detail, _call_competitions_list, _call_poule_capture, _parse_raw_poule,
)


def test_poule_capture_does_not_reuse_a_competition_that_still_has_poules(session):
    old_comp = HockeyCompetition(
        external_id="Jongens O14 Lente|2e klasse|Noord-Holland|2025-2026",
        name="Jongens O14 Lente", class_name="2e klasse", district="Noord-Holland",
        hockey_type="VE", season="2025-2026",
    )
    session.add(old_comp)
    session.commit()
    session.refresh(old_comp)
    old_poule = HockeyPoule(poule_id=1, name="Poule A", competition_id=old_comp.id, season="2025-2026")
    session.add(old_poule)
    session.commit()

    body = PouleCaptureIn(
        poule_id=2, poule_name="Poule A", competition_name="Jongens O14 Lente",
        class_name="2e klasse", district="Noord-Holland", hockey_type="VE", season="2026-2027",
    )
    _call_poule_capture(body, session)
    session.commit()

    session.refresh(old_comp)
    assert old_comp.season == "2025-2026"
    assert old_poule.competition_id == old_comp.id

    new_comp = session.exec(
        select(HockeyCompetition).where(HockeyCompetition.season == "2026-2027")
    ).first()
    assert new_comp is not None
    assert new_comp.id != old_comp.id


def test_poule_capture_still_reuses_an_empty_stale_competition(session):
    old_comp = HockeyCompetition(
        external_id="Meisjes O12 Lente|6e klasse|Noord-Holland|2025-2026",
        name="Meisjes O12 Lente", class_name="6e klasse", district="Noord-Holland",
        hockey_type="VE", season="2025-2026",
    )
    session.add(old_comp)
    session.commit()
    session.refresh(old_comp)
    old_comp_id = old_comp.id

    body = PouleCaptureIn(
        poule_id=3, poule_name="Poule A", competition_name="Meisjes O12 Lente",
        class_name="6e klasse", district="Noord-Holland", hockey_type="VE", season="2026-2027",
    )
    _call_poule_capture(body, session)
    session.commit()
    session.refresh(old_comp)

    assert old_comp.season == "2026-2027"
    assert session.exec(select(HockeyCompetition)).all() == [old_comp]
    assert old_comp.id == old_comp_id


def test_parse_raw_poule_prefers_match_dates_over_raw_seizoen_field():
    raw = {
        "seizoen": "2026-2027",
        "data": {"data": {"poule": {
            "id": 42, "name": "Poule A",
            "competition": {"name": "Meisjes O12 Lente", "subcompetition": {"class": "6e klasse"}},
            "standings": [],
            "matches": [{"id": 1, "date": "2026-03-07T09:00:00+01:00", "status": "final"}],
        }}},
    }
    result = _parse_raw_poule(raw, params={"poule_id": 42})
    assert result.season == "2025-2026"


def test_call_competitions_list_releases_hl_comp_id_from_a_different_competition(session):
    stale = HockeyCompetition(
        external_id="Landelijk Jongens O16|2026-2027", name="Landelijk Jongens O16",
        class_name="Landelijke Topklasse", hockey_type="VE", season="2026-2027", hl_comp_id=24,
    )
    session.add(stale)
    session.commit()

    _call_competitions_list(
        {"competitions": [{"team": None, "club": None, "competition": {"id": 24, "name": "Gold Cup Dames"}}]},
        session,
    )

    session.refresh(stale)
    assert stale.hl_comp_id is None
    real = session.exec(select(HockeyCompetition).where(HockeyCompetition.name == "Gold Cup Dames")).first()
    assert real.hl_comp_id == 24


def test_call_competitions_list_skips_team_and_club_search_hits(session):
    raw = {"data": [
        {"team": {"id": 1, "name": "Victoria JO18-2", "recent_poule_id": 111}, "competition": None, "club": None},
        {"team": None, "competition": None, "club": {"federation_reference_id": "HH11QW6", "name": "HV Victoria"}},
        {"team": None, "club": None, "competition": {"id": 19, "name": "Landelijk Jongens O18", "class_name": "Landelijke Topklasse"}},
    ]}
    result = _call_competitions_list(raw, session)

    assert result == {"competitions_found": 3, "upserted": 1, "skipped": 2}
    comp = session.exec(select(HockeyCompetition).where(HockeyCompetition.hl_comp_id == 19)).first()
    assert comp.name == "Landelijk Jongens O18"


def test_call_competitions_list_handles_the_flat_national_list_shape(session):
    raw = {"competitions": [
        {"id": 21, "name": "Landelijk Jongens O16", "class_name": "Landelijke Topklasse", "poule_id": 180935},
        {"id": 2, "name": "Staatsloterij Hoofdklasse Dames", "class_name": "Hoofdklasse", "poule_id": 180863},
    ]}
    result = _call_competitions_list(raw, session)

    assert result == {"competitions_found": 2, "upserted": 2, "skipped": 0}
    comp = session.exec(select(HockeyCompetition).where(HockeyCompetition.hl_comp_id == 21)).first()
    assert comp.name == "Landelijk Jongens O16"


def test_call_competitions_list_updates_the_existing_real_competition_instead_of_duplicating(session):
    real = HockeyCompetition(
        external_id="Landelijk Jongens O16|Landelijke Topklasse|Landelijk|2026-2027",
        name="Landelijk Jongens O16", class_name="Landelijke Topklasse", district="Landelijk",
        hockey_type="VE", season="2026-2027",
    )
    session.add(real)
    session.commit()
    poule = HockeyPoule(poule_id=1, name="Poule A", competition_id=real.id, season="2026-2027")
    session.add(poule)
    session.commit()

    raw = {"competitions": [
        {"id": 21, "name": "Landelijk Jongens O16", "class_name": "Landelijke Topklasse", "poule_id": 180935},
    ]}
    result = _call_competitions_list(raw, session)

    assert result == {"competitions_found": 1, "upserted": 1, "skipped": 0}
    assert session.exec(select(HockeyCompetition).where(HockeyCompetition.name == "Landelijk Jongens O16")).all() == [real]
    session.refresh(real)
    assert real.hl_comp_id == 21
    assert real.district == "Landelijk"


def test_call_competition_detail_releases_hl_comp_id_from_a_different_competition(session):
    stale = HockeyCompetition(
        external_id="Landelijk Jongens O16|Landelijke Topklasse|Landelijk|2026-2027",
        name="Landelijk Jongens O16", class_name="Landelijke Topklasse", district="Landelijk",
        hockey_type="VE", season="2026-2027", hl_comp_id=24,
    )
    session.add(stale)
    session.commit()

    raw = {"data": {"data": {
        "name": "Gold Cup Dames",
        "poules": [{
            "id": 175612, "name": "Poule A",
            "competition": {"class_name": "Gold Cup", "district_name": "Landelijk"},
            "matches": [{"date": "2025-09-11T20:30:00+02:00", "status": "final"}],
        }],
    }}}
    _call_competition_detail(raw, session, params={"comp_id": 24, "label": "Gold Cup Dames"})

    session.refresh(stale)
    assert stale.hl_comp_id is None
    real = session.exec(select(HockeyCompetition).where(HockeyCompetition.name == "Gold Cup Dames")).first()
    assert real.hl_comp_id == 24


def test_call_competition_detail_handles_two_poules_with_different_seasons_claiming_the_same_hl_comp_id(session):
    # Bijvangst 29-08-2026: crashte live met UNIQUE constraint failed
    # (hockey_competitions.hl_comp_id) - twee poules binnen 1 competitie-
    # detail-response kunnen een verschillend seizoen berekenen (elk uit hun
    # eigen matches), dus een verschillende ext_id, dus twee verschillende
    # HockeyCompetition-rijen die allebei hetzelfde hl_comp_id claimen.
    raw = {"data": {"data": {
        "name": "Landelijk Meisjes O16",
        "poules": [
            {
                "id": 1, "name": "Poule A",
                "competition": {"class_name": "Landelijke Klasse", "district_name": "Landelijk"},
                "matches": [{"date": "2025-09-11T20:30:00+02:00", "status": "final"}],
            },
            {
                "id": 2, "name": "Poule B",
                "competition": {"class_name": "Landelijke Klasse", "district_name": "Landelijk"},
                "matches": [{"date": "2026-09-12T20:30:00+02:00", "status": "final"}],
            },
        ],
    }}}

    result = _call_competition_detail(raw, session, params={"comp_id": 22, "label": "Landelijk Meisjes O16"})

    assert result is not None
    comps = session.exec(select(HockeyCompetition).where(HockeyCompetition.name == "Landelijk Meisjes O16")).all()
    assert len(comps) == 2
    with_hl = [c for c in comps if c.hl_comp_id == 22]
    assert len(with_hl) == 1


def test_call_competition_detail_recaptures_matches_and_standings_for_the_same_poule_without_error(session):
    # Bijvangst 29-08-2026: deze standings/matches-upsert is gedupliceerd
    # i.p.v. gedeeld met apply_poule_capture, dus kreeg de flush-fix daar
    # (item 1010) niet automatisch mee - crashte live op prod met UNIQUE
    # constraint failed: hockey_poule_matches.poule_id, match_id bij een
    # herscan van een landelijke competitie.
    def _raw():
        return {"data": {"data": {
            "name": "Landelijk Jongens O16",
            "poules": [{
                "id": 500, "name": "Poule Z",
                "competition": {"class_name": "Landelijke Klasse", "district_name": "Landelijk"},
                "standings": [{
                    "team": {"id": 700, "name": "Team A", "short_name": "A", "federation_reference_id": "HH11ZZ0"},
                    "rank": 1, "played": 1, "wins": 1, "points": 3,
                }],
                "matches": [{
                    "id": 900, "date": "2026-08-29T14:00:00+02:00", "status": "final",
                    "home": {"id": 700, "name": "Team A"}, "away": {"id": 701, "name": "Team B"},
                    "score": {"home": 3, "away": 1},
                }],
            }],
        }}}

    result1 = _call_competition_detail(_raw(), session, params={"comp_id": 21, "label": "Landelijk Jongens O16"})
    assert result1 is not None

    result2 = _call_competition_detail(_raw(), session, params={"comp_id": 21, "label": "Landelijk Jongens O16"})
    assert result2 is not None
    assert result2["poules_processed"] == 1


def test_call_competition_detail_reports_a_match_that_just_became_final(session):
    # item 1001/1013: get_competition_detail moet dezelfde "net final
    # geworden"-detectie doen als apply_poule_capture, anders krijgen
    # eindstand-meldingen nooit iets te melden voor gevolgde teams uit een
    # landelijke (hl_comp_id-gekoppelde) competitie - precies wat er live
    # gebeurde met Victoria MO16-1/MO18-1 op 29-08-2026.
    def _raw(status, home_score=None, away_score=None):
        score = {} if home_score is None else {"home": home_score, "away": away_score}
        return {"data": {"data": {
            "name": "Landelijk Meisjes O16",
            "poules": [{
                "id": 600, "name": "Poule A",
                "competition": {"class_name": "Landelijke Klasse", "district_name": "Landelijk"},
                "matches": [{
                    "id": 900, "date": "2026-08-29T12:30:00+02:00", "status": status,
                    "home": {"id": 7455, "name": "Victoria MO16-1"},
                    "away": {"id": 707, "name": "Groningen MO16-1"},
                    "score": score,
                }],
            }],
        }}}

    result1 = _call_competition_detail(_raw("scheduled"), session, params={"comp_id": 22, "label": "Landelijk Meisjes O16"})
    assert result1["newly_finished"] == []

    result2 = _call_competition_detail(_raw("final", 4, 1), session, params={"comp_id": 22, "label": "Landelijk Meisjes O16"})

    assert len(result2["newly_finished"]) == 1
    assert result2["newly_finished"][0]["home_score"] == 4
    assert result2["newly_finished"][0]["away_score"] == 1


# ── item 1019: team.poules[] -> linked_poules (proactieve volgende-fase-ontdekking) ──

def test_parse_raw_poule_extracts_linked_poules_excluding_the_current_one():
    # Verkorte versie van een echte hockey.nl-payload (team 2726, Cartouche
    # MO18-1) - team.poules[] somt alle ooit gekoppelde poules op, inclusief
    # de huidige (180879, hoort hier NIET in linked_poules terecht te komen).
    raw = {"data": {"data": {
        "team": {
            "id": 2726, "name": "Cartouche MO18-1", "recent_poule_id": 180879,
            "poules": [
                {"id": 180879, "name": "Poule E", "competition": {"period_name": "Voorcompetitie"}},
                {"id": 173412, "name": "Poule I", "competition": {"period_name": "Voorcompetitie"}},
                {"id": 175841, "name": "Poule D", "competition": {"period_name": "Nov tm Jun"}},
            ],
        },
        "poule": {
            "id": 180879, "name": "Poule E",
            "competition": {"name": "Meisjes O18 Voorcompetitie", "period_name": "Voorcompetitie", "subcompetition": {"class": "Landelijke Subtopklasse"}},
            "standings": [],
            "matches": [{"id": 1, "date": "2026-08-29T11:20:00+02:00", "status": "final"}],
        },
    }}}

    result = _parse_raw_poule(raw, params={"poule_id": 180879})

    assert result.team_id == 2726
    assert result.period_name == "Voorcompetitie"
    assert {(lp.id, lp.period_name) for lp in result.linked_poules} == {
        (173412, "Voorcompetitie"),
        (175841, "Nov tm Jun"),
    }


def test_call_poule_capture_queues_a_genuine_next_phase_poule_in_the_target_season(session):
    # Seizoensranges opbouwen zoals infer_poule_season ze zou aantreffen:
    # oud seizoen 2025-2026 dekt poule_id 1000-1600, huidig seizoen 2026-2027
    # start vanaf 2000.
    session.add(HockeyPoule(poule_id=1000, name="Oud A", competition_id=1, season="2025-2026"))
    session.add(HockeyPoule(poule_id=1600, name="Oud B", competition_id=1, season="2025-2026"))
    session.add(HockeyPoule(poule_id=2000, name="Huidig A", competition_id=2, season="2026-2027"))
    session.commit()

    body = PouleCaptureIn(
        poule_id=2100, poule_name="Poule E", competition_name="Meisjes O18 Voorcompetitie",
        class_name="Landelijke Subtopklasse", hockey_type="VE", season="2026-2027",
        period_name="Voorcompetitie", team_id=2726,
        linked_poules=[
            {"id": 1500, "period_name": "Nov tm Jun"},   # ander period_name, maar VORIG seizoen -> negeren
            {"id": 2050, "period_name": "Voorcompetitie"},  # huidig seizoen, maar ZELFDE period_name -> negeren
            {"id": 2075, "period_name": "Nov tm Jun"},   # huidig seizoen + ander period_name -> genuine volgende fase
        ],
    )
    _call_poule_capture(body, session)
    session.commit()

    queued = session.exec(select(VangerCmd).where(VangerCmd.cmd_type == "get_poule")).all()
    queued_poule_ids = {json.loads(c.params)["poule_id"] for c in queued}
    assert queued_poule_ids == {2075}
    cmd = next(c for c in queued if json.loads(c.params)["poule_id"] == 2075)
    assert cmd.reason == "next_phase_discovery"
    assert json.loads(cmd.params)["team_id"] == 2726


def test_call_poule_capture_does_not_requeue_an_already_captured_linked_poule(session):
    session.add(HockeyPoule(poule_id=2000, name="Huidig A", competition_id=2, season="2026-2027"))
    session.add(HockeyPoule(poule_id=2075, name="Al gevangen", competition_id=2, season="2026-2027"))
    session.commit()

    body = PouleCaptureIn(
        poule_id=2100, poule_name="Poule E", competition_name="Meisjes O18 Voorcompetitie",
        class_name="Landelijke Subtopklasse", hockey_type="VE", season="2026-2027",
        period_name="Voorcompetitie", team_id=2726,
        linked_poules=[{"id": 2075, "period_name": "Nov tm Jun"}],
    )
    _call_poule_capture(body, session)
    session.commit()

    assert session.exec(select(VangerCmd).where(VangerCmd.cmd_type == "get_poule")).all() == []
