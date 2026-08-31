"""Tests voor de vanger-queue-filter op competitie-niveau (roadmap-melding:
'Gold Cup Dames' - een senioren-competitie - kwam onterecht door het filter)."""

from datetime import datetime

from models.hockey_discovery import HockeyCompetition, HockeyTeam
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


def test_derive_competition_category_o25_reserve_competitions_are_senior_not_junior():
    # roadmap-melding: "Heren O25 NK Zaal" kwam door een Junioren-only filter
    # heen omdat _COMP_AGE_RE ook op "O25" matcht - een expliciet heren/dames-
    # woord moet voorrang krijgen boven de generieke leeftijd-regex.
    assert _derive_competition_category("Heren O25 NK Zaal") == "Senioren"
    assert _derive_competition_category("Dames O25 NK Zaal") == "Senioren"
    assert _derive_competition_category("Landelijk Jongens O16") == "Junioren"  # regressie


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


def test_zaal_competition_excluded_from_veld_only_filter_even_when_comp_lookup_fails(session):
    # roadmap-melding, 2e helft van de bug: als de hl_comp_id-lookup faalt
    # (comp is None) werd de hockey_type-check voorheen stilzwijgend
    # overgeslagen. Nu moet het z-prefix in het label als fallback dienen.
    params = {"comp_id": None, "label": "zHeren O25 NK Zaal"}
    matches = _cmd_matches_filter(
        session, "get_competition_detail", params,
        ages=[], club=None, cats=["Senioren"], hts=["VE"], genders=[],
    )
    assert matches is False


def test_unknown_comp_id_is_excluded_when_unclassifiable(session):
    # Onbekende competitie (niet in DB, geen label) - niet classificeerbaar ->
    # cats-check sluit 'm uit (geen valse zekerheid dat 'ie wel bij het filter past).
    matches = _cmd_matches_filter(
        session, "get_competition_detail", {"comp_id": 999999},
        ages=[], club=None, cats=["Junioren"], hts=["VE"], genders=[],
    )
    assert matches is False


# ── item 1019: zaal-tijdvak-bypass op het hockey_type-filter ──

def test_zaal_team_passes_veld_only_filter_inside_the_zaal_window(session):
    session.add(HockeyTeam(
        team_id=1, club_external_id="HH11XX0", name="Team A", short_name="H1",
        hockey_type="ZA", category_group_name="Senioren",
    ))
    session.commit()

    matches = _cmd_matches_filter(
        session, "get_poule", {"team_id": 1},
        ages=[], club=None, cats=["Senioren"], hts=["VE"], genders=[],
        now=datetime(2026, 12, 15),  # midden in het default-venster (15/11 t/m 15/3)
    )
    assert matches is True


def test_zaal_team_still_excluded_outside_the_zaal_window(session):
    session.add(HockeyTeam(
        team_id=1, club_external_id="HH11XX0", name="Team A", short_name="H1",
        hockey_type="ZA", category_group_name="Senioren",
    ))
    session.commit()

    matches = _cmd_matches_filter(
        session, "get_poule", {"team_id": 1},
        ages=[], club=None, cats=["Senioren"], hts=["VE"], genders=[],
        now=datetime(2026, 6, 1),  # ver buiten het venster
    )
    assert matches is False


def test_veld_team_behaviour_is_unchanged_inside_the_zaal_window(session):
    session.add(HockeyTeam(
        team_id=1, club_external_id="HH11XX0", name="Team A", short_name="H1",
        hockey_type="VE", category_group_name="Junioren",
    ))
    session.commit()

    matches = _cmd_matches_filter(
        session, "get_poule", {"team_id": 1},
        ages=[], club=None, cats=["Senioren"], hts=["VE"], genders=[],
        now=datetime(2026, 12, 15),
    )
    assert matches is False  # cats-filter sluit 'm nog steeds uit, ongewijzigd


def test_zaal_competition_passes_competition_detail_filter_inside_the_zaal_window(session):
    matches = _cmd_matches_filter(
        session, "get_competition_detail", {"comp_id": None, "label": "zHeren O25 NK Zaal"},
        ages=[], club=None, cats=["Senioren"], hts=["VE"], genders=[],
        now=datetime(2026, 12, 15),
    )
    assert matches is True


def test_scan_club_always_passes_regardless_of_zaal_window(session):
    matches = _cmd_matches_filter(
        session, "scan_club", {"external_id": "HH11XX0"},
        ages=[], club=None, cats=["Junioren"], hts=["VE"], genders=[],
        now=datetime(2026, 6, 1),
    )
    assert matches is True
