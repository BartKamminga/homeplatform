"""Tests voor de vanger-queue-filter op competitie-niveau (roadmap-melding:
'Gold Cup Dames' - een senioren-competitie - kwam onterecht door het filter)."""

from models.hockey_discovery import HockeyCompetition
from services.hockey_vanger_filters import (
    _cmd_matches_filter, _derive_competition_category, _derive_competition_gender,
)


def test_derive_competition_category_recognizes_senior_keywords():
    assert _derive_competition_category("Gold Cup Dames") == "Senioren"
    assert _derive_competition_category("Hoofdklasse Heren") == "Senioren"


def test_derive_competition_category_recognizes_junior_keywords():
    assert _derive_competition_category("Landelijk Jongens O18") == "Junioren"
    assert _derive_competition_category("Topklasse Meisjes") == "Junioren"
    assert _derive_competition_category("Super O14") == "Junioren"


def test_derive_competition_category_unclassifiable_returns_empty():
    assert _derive_competition_category("Gold Cup") == ""


def test_derive_competition_gender():
    assert _derive_competition_gender("Gold Cup Dames") == "Dames"
    assert _derive_competition_gender("Landelijk Jongens O18") == "Jongens"
    assert _derive_competition_gender("Gold Cup") == ""


def test_senior_competition_is_filtered_out_of_default_junioren_only_queue(session):
    comp = HockeyCompetition(
        external_id="test|gold-cup-dames", name="Gold Cup Dames",
        class_name="Landelijk", hockey_type="VE", season="2026-2027", hl_comp_id=12345,
    )
    session.add(comp)
    session.commit()

    params = {"comp_id": 12345, "label": "Gold Cup Dames"}
    matches = _cmd_matches_filter(
        session, "get_competition_detail", params,
        ages=[], club=None, cats=["Junioren"], hts=["VE"], genders=[],
    )
    assert matches is False


def test_junior_competition_passes_default_junioren_only_queue(session):
    comp = HockeyCompetition(
        external_id="test|landelijk-jongens-o18", name="Landelijk Jongens O18",
        class_name="Landelijk", hockey_type="VE", season="2026-2027", hl_comp_id=67890,
    )
    session.add(comp)
    session.commit()

    params = {"comp_id": 67890, "label": "Landelijk Jongens O18"}
    matches = _cmd_matches_filter(
        session, "get_competition_detail", params,
        ages=[], club=None, cats=["Junioren"], hts=["VE"], genders=[],
    )
    assert matches is True


def test_unknown_comp_id_is_excluded_when_unclassifiable(session):
    # Onbekende competitie (niet in DB, geen label) - niet classificeerbaar ->
    # cats-check sluit 'm uit (geen valse zekerheid dat 'ie wel bij het filter past).
    matches = _cmd_matches_filter(
        session, "get_competition_detail", {"comp_id": 999999},
        ages=[], club=None, cats=["Junioren"], hts=["VE"], genders=[],
    )
    assert matches is False
