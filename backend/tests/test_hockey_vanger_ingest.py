"""Tests voor twee seizoen-labeling-bugs in de poule-capture-ingest (roadmap-melding:
'Jongens O14 Lente' bleef als 2026-2027 rondhangen terwijl het 2025-2026-data was)."""

from sqlmodel import select

from models.hockey_discovery import HockeyCompetition, HockeyPoule
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
