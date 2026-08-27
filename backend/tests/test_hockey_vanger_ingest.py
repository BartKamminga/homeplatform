"""Tests voor twee seizoen-labeling-bugs in de poule-capture-ingest (roadmap-melding:
'Jongens O14 Lente' bleef als 2026-2027 rondhangen terwijl het 2025-2026-data was)."""

from sqlmodel import select

from models.hockey_discovery import HockeyCompetition, HockeyPoule
from routers.hockey_capture import PouleCaptureIn
from services.hockey_vanger_ingest import _call_poule_capture, _parse_raw_poule


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
