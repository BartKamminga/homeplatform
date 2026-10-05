"""Tests voor clublocaties en reistijd in de herindelingsprognose (item 1184)."""

from models.hockey_discovery import HockeyClub
from routers import hockey_club_geo
from services.hockey_club_geo import distance_km, max_travel, travel_minutes
from services.hockey_regrouping_forecast import SourcePoule, TeamStanding, forecast

MAASTRICHT = (50.858, 5.694)
GRONINGEN = (53.221, 6.574)
UTRECHT = (52.091, 5.122)


def test_distance_and_travel_estimate():
    km = distance_km(MAASTRICHT, GRONINGEN)
    assert 255 < km < 275
    assert travel_minutes(km) > 120
    assert 195 < travel_minutes(km) < 225          # werkelijk ~3u30
    assert 115 < travel_minutes(distance_km(UTRECHT, GRONINGEN)) < 140  # werkelijk ~2u


def test_max_travel_picks_furthest_pair_and_counts_unknown():
    teams = [
        {"club": "Maastricht", "lat": MAASTRICHT[0], "lon": MAASTRICHT[1]},
        {"club": "Groningen", "lat": GRONINGEN[0], "lon": GRONINGEN[1]},
        {"club": "Kampong", "lat": UTRECHT[0], "lon": UTRECHT[1]},
        {"club": "Onbekend", "lat": None, "lon": None},
    ]
    result = max_travel(teams)
    assert set(result["between"]) == {"Maastricht", "Groningen"}
    assert result["unknown"] == 1
    assert max_travel(teams[2:]) is None


def _team(tid, name, pos, point):
    return TeamStanding(team_id=tid, team_name=f"{name} MO14-1", position=pos, played=5,
                        points=15 - 3 * pos, goals_for=10, goals_against=pos, lat=point[0], lon=point[1])


def test_o14_pool_with_maastricht_and_groningen_is_too_far():
    # Twee bronpoules -> 6 teams over 5 Super-poules: seeds 5 en 6 (de twee
    # nrs 3: Maastricht en Groningen) komen via de serpentine samen in poule E.
    p1 = SourcePoule("ZN · A", "Topklasse", "ZN", 15, 30, [
        _team(1, "Tilburg", 1, (51.56, 5.08)), _team(2, "Breda", 2, (51.59, 4.78)),
        _team(3, "Maastricht", 3, MAASTRICHT), _team(4, "Pelikaan", 4, (51.69, 5.30)),
        _team(5, "Rosmalen", 5, (51.71, 5.36)), _team(6, "Push", 6, (51.58, 4.77)),
    ])
    p2 = SourcePoule("NON · A", "Topklasse", "NON", 15, 30, [
        _team(11, "Zwolle", 1, (52.51, 6.09)), _team(12, "Twente", 2, (52.22, 6.89)),
        _team(13, "Groningen", 3, GRONINGEN), _team(14, "GHBS", 4, (53.2, 6.6)),
        _team(15, "Bully", 5, (53.2, 6.5)), _team(16, "Leeuwarden", 6, (53.2, 5.8)),
    ])
    super_ = forecast("MO14", [p1, p2])["targets"][0]
    assert super_["max_travel_minutes"] == 120
    by_name = {p["name"]: p for p in super_["pools"]}
    pool_e = by_name["Poule E"]
    assert {t["club"] for t in pool_e["teams"]} == {"Maastricht", "Groningen"}
    assert pool_e["too_far"] is True
    result = forecast("MO14", [p1, p2])
    travel_warnings = [w for w in result["warnings"] if "Poule E" in w and "over 2h00" in w]
    assert len(travel_warnings) == 1
    assert "Maastricht" in travel_warnings[0] and "Groningen" in travel_warnings[0]
    assert by_name["Poule A"]["travel"] is None  # maar 1 team


def test_o18_has_no_travel_limit():
    top = "Landelijke Topklasse"
    poule = SourcePoule("L · A", top, "Landelijk", 12, 12, [
        TeamStanding(i, f"Club{i} MO18-1", i, 6, 9 - 3 * (i - 1), 5, 1, lat=MAASTRICHT[0] if i == 1 else GRONINGEN[0],
                     lon=MAASTRICHT[1] if i == 1 else GRONINGEN[1])
        for i in range(1, 5)
    ])
    national = forecast("MO18", [poule])["targets"][0]
    assert national["max_travel_minutes"] is None
    assert all(p["too_far"] is False for p in national["pools"])


def test_geocode_endpoint_fills_missing_locations(session, monkeypatch):
    session.add(HockeyClub(external_id="C1", name="Maastricht", friendly_name="Maastricht", zipcode="6211 AA"))
    session.add(HockeyClub(external_id="C2", name="Nergens", friendly_name="Nergens"))
    session.add(HockeyClub(external_id="C3", name="Al bekend", friendly_name="Al bekend", zipcode="1000AA",
                           latitude=52.0, longitude=5.0))
    session.commit()
    calls = []
    monkeypatch.setattr(hockey_club_geo, "geocode", lambda client, z, c: calls.append(z) or MAASTRICHT)

    result = hockey_club_geo.geocode_clubs(force=False, limit=500, session=session, _=None)

    assert calls == ["6211 AA"]
    assert result["geocoded"] == 1 and result["not_found"] == ["Nergens"]
    club = session.exec(HockeyClub.__table__.select().where(HockeyClub.external_id == "C1")).first()
    assert club.latitude == MAASTRICHT[0]
