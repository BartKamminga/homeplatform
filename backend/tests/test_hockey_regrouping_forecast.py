"""Tests voor de herindelingsprognose (items 1182/1183)."""

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding
from routers.hockey_regrouping import get_regrouping_forecast
from services.hockey_regrouping_forecast import (
    SourcePoule, TeamStanding, category_from_competition, club_of, forecast, serpentine,
)

_next_id = [0]


def _poule(class_name, district, label, club_prefix, points, played=5, suffix="MO14-1"):
    standings = []
    for pos, pts in enumerate(points, 1):
        _next_id[0] += 1
        standings.append(TeamStanding(
            team_id=_next_id[0], team_name=f"{club_prefix}{pos} {suffix}", position=pos,
            played=played, points=pts, goals_for=10 - pos, goals_against=pos,
        ))
    return SourcePoule(label=label, class_name=class_name, district=district,
                       matches_played=15 if played else 0, matches_total=30, standings=standings)


def _mo14_poules():
    districts = ["ZN", "MN", "Zuid-Holland", "NH", "NON"]
    poules = []
    for d in districts:
        for letter in "AB":
            poules.append(_poule("Topklasse", d, f"{d} {letter}", f"T{d}{letter}", [15, 12, 9, 6, 3, 0]))
    for d in districts:
        for letter in "ABC":
            # ZH-poule C heeft de sterkste nr 2 (13 pt), die moet via de ZH-regel naar IDC.
            second = 13 if (d, letter) == ("Zuid-Holland", "C") else 10
            poules.append(_poule("Subtopklasse", d, f"{d} {letter}", f"S{d}{letter}", [15, second, 6, 4, 2, 0]))
    return poules


def test_category_and_club_parsing():
    assert category_from_competition("Meisjes O14 Herfst") == "MO14"
    assert category_from_competition("Jongens O14 Voorcompetitie") == "JO14"
    assert category_from_competition("Senioren") is None
    assert club_of("Klein Zwitserland MO14-1") == "Klein Zwitserland"


def test_mo14_forecast_fills_super_and_idc_exactly():
    result = forecast("MO14", _mo14_poules())
    super_, idc, subtop = result["targets"]

    assert len(super_["seeding"]) == 30
    assert all(e["origin_class"] == "Topklasse" and e["origin_position"] <= 3 for e in super_["seeding"])
    assert [len(p["teams"]) for p in super_["pools"]] == [6] * 5

    # 10x nr4 + 10x nr5 + 15x Subtop nr1 + beste nr2 ZH = 36
    assert len(idc["seeding"]) == 36
    zh2 = [e for e in idc["seeding"] if e["origin_class"] == "Subtopklasse" and e["origin_position"] == 2]
    assert len(zh2) == 1 and zh2[0]["origin_district"] == "Zuid-Holland"
    assert len(subtop["seeding"]) == 10 and subtop["pools"] is None
    assert result["warnings"] == []


def test_seeding_is_tiered_and_serpentine():
    result = forecast("MO14", _mo14_poules())
    seeding = result["targets"][0]["seeding"]
    assert [e["seed"] for e in seeding] == list(range(1, 31))
    assert [e["origin_position"] for e in seeding] == [1] * 10 + [2] * 10 + [3] * 10
    # Serpentine: seed 1 -> A, 5 -> E, 6 -> E, 10 -> A
    assert [seeding[i]["pool_index"] for i in (0, 4, 5, 9)] == [0, 4, 4, 0]


def test_serpentine_avoids_same_club_in_pool():
    entries = [{"club": c} for c in ["A", "B", "B", "C"]]
    pools = serpentine(entries, 2)
    for pool in pools:
        clubs = [e["club"] for e in pool]
        assert len(clubs) == len(set(clubs))


def test_poule_without_results_gives_warning():
    poules = _mo14_poules()
    poules[-1] = _poule("Subtopklasse", "NON", "NON C", "SX", [0] * 6, played=0)
    result = forecast("MO14", poules)
    assert any("NON C" in w for w in result["warnings"])
    assert any(e["provisional"] for e in result["targets"][1]["seeding"])


def test_unknown_category_returns_none():
    assert forecast("MO12", _mo14_poules()) is None


def test_o18_forecast_follows_national_rules():
    top, sub = "Landelijke Topklasse", "Landelijke Subtopklasse"
    poules = [_poule(top, "Landelijk", f"T{i}", f"T{i}x", [9, 6, 3, 0], played=6, suffix="MO18-1") for i in range(8)]
    poules += [_poule(sub, "Landelijk", f"S{i}", f"S{i}x", [9, 6, 3, 0], played=6, suffix="MO18-1") for i in range(16)]
    result = forecast("MO18", poules)
    national, super_, subtop, out = result["targets"]

    assert len(national["seeding"]) == 16 and [len(p["teams"]) for p in national["pools"]] == [8, 8]
    assert len(super_["seeding"]) == 32 and [len(p["teams"]) for p in super_["pools"]] == [8] * 4
    assert {e["origin_code"] for e in super_["seeding"]} == {"T3", "T4", "S1"}
    assert len(subtop["seeding"]) == 32 and subtop["pools"] is None
    assert {e["origin_code"] for e in out["seeding"]} == {"S4"}
    assert result["warnings"] == []


def test_o16_forecast_follows_national_rules():
    top, sub = "Landelijke Topklasse", "Subtopklasse"
    points = [15, 12, 9, 6, 3, 0]
    poules = [_poule(top, "Landelijk", f"T{i}", f"T{i}x", points, suffix="JO16-1") for i in range(8)]
    poules += [_poule(sub, "Landelijk", f"S{i}", f"S{i}x", points, suffix="JO16-1") for i in range(8)]
    national, super_, subtop, out = forecast("JO16", poules)["targets"]

    assert len(national["seeding"]) == 24 and [len(p["teams"]) for p in national["pools"]] == [6] * 4
    assert {e["origin_code"] for e in super_["seeding"]} == {"T4", "T5", "S1"} and len(super_["seeding"]) == 24
    assert len(subtop["seeding"]) == 8 + 32
    assert len(out["seeding"]) == 8


def test_router_builds_forecast_from_db(session):
    comp = HockeyCompetition(external_id="t|mo14top", name="Meisjes O14 Herfst", class_name="Topklasse",
                             district="Zuid-Holland", hockey_type="VE", season="2026-2027")
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub-mo14", competition_id=comp.id, scan_profile="active"))
    session.add(HockeyPoule(poule_id=901, name="Poule A", competition_id=comp.id, season="2026-2027"))
    for pos in range(1, 7):
        session.add(HockeyPouleStanding(poule_id=901, team_id=9000 + pos, team_name=f"Club{pos} MO14-1",
                                        position=pos, played=5, points=18 - 3 * pos))
    session.add(HockeyPouleMatch(poule_id=901, match_id=1, status="final"))
    session.commit()

    result = get_regrouping_forecast(tid="pub-mo14", session=session)["forecast"]
    assert result["category"] == "MO14"
    # Gespeeld komt uit de stand (6 teams x 5 / 2), niet uit wedstrijdstatussen.
    assert result["progress"]["played"] == 15
    assert not any("no results" in w for w in result["warnings"])
    assert len(result["targets"][0]["seeding"]) == 3
    assert result["targets"][2]["seeding"][0]["team_name"] == "Club6 MO14-1"
