"""Item 1280: yearof leest hockeydata alleen via services/hockey_read - de grens
bewaakt, de competitiewedstrijden in de tijdlijn, en de clubkleur die nu aan
de hockey-kant geschreven wordt."""

import re
from pathlib import Path

from models.hockey_discovery import HockeyClub, HockeyPoule, HockeyPouleStanding
from routers.yearof_mo14 import entries_timeline
from services import hockey_read

YEAROF_DIR = Path(__file__).resolve().parent.parent / "routers" / "yearof_mo14"
FORBIDDEN = re.compile(r"^\s*(from|import)\s+(models\.hockey\w*|routers\.hockey\w*|services\.club_colors)\b", re.M)
API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_yearof_imports_no_hockey_internals():
    offenders = [f"{p.name}: {m.group(0).strip()}"
                 for p in YEAROF_DIR.glob("*.py") for m in FORBIDDEN.finditer(p.read_text(encoding="utf-8"))]
    assert offenders == []


def test_hockey_read_returns_none_for_unknown_poule(session):
    assert hockey_read.poule_info(session, 999) is None
    assert hockey_read.poule_matches(session, 999) is None
    assert hockey_read.poule_standings(session, 999) is None
    assert hockey_read.team_id_in_poule(session, 999, "x") is None


def test_hockey_read_poule_info_and_team_id(session):
    poule = HockeyPoule(id=551, poule_id=12345, name="Topklasse A", competition_id=1, season="2026-2027")
    session.add(poule)
    session.add(HockeyPouleStanding(poule_id=12345, team_id="t-ons", team_name="Victoria MO14-1"))
    session.commit()
    assert hockey_read.poule_info(session, 551) == {"id": 551, "poule_id": 12345, "name": "Topklasse A"}
    assert hockey_read.team_id_in_poule(session, 551, "Victoria MO14-1") == "t-ons"
    assert hockey_read.team_id_in_poule(session, 551, "Iemand anders") is None


def test_timeline_maps_competition_matches_for_our_team(client, admin_token, monkeypatch):
    us = entries_timeline.TEAM_NAME
    data = {
        "finished": [
            {"match_id": "1", "home": "HGC", "away": us, "home_score": 1, "away_score": 3, "date": "2026-09-20",
             "location": "Wassenaar", "home_club_logo": "hgc.png", "away_club_logo": "vic.png"},
            {"match_id": "2", "home": "HGC", "away": "Pinoke", "home_score": 0, "away_score": 0, "date": "2026-09-21"},
        ],
        "scheduled": [{"match_id": "3", "home": us, "away": "Pinoke", "date": "2026-10-04"}],
    }
    monkeypatch.setattr(entries_timeline.hockey_read, "poule_matches", lambda session, poule_id: data)
    items = client.get(f"{API}/timeline", headers=_auth(admin_token)).json()
    assert [i["match_ref"] for i in items] == ["knhb:1", "knhb:3"]
    away, home = items
    assert (away["is_home"], away["opponent"], away["score_us"], away["score_them"]) == (False, "HGC", 3, 1)
    assert (away["score_home"], away["score_away"], away["opponent_club_logo"]) == (1, 3, "hgc.png")
    assert (home["status"], home["score_us"], home["is_home"]) == ("scheduled", None, True)


def test_standings_404_without_poule(client, admin_token):
    assert client.get(f"{API}/standings", headers=_auth(admin_token)).status_code == 404


def test_club_color_moved_to_hockey(client, admin_token, session):
    session.add(HockeyClub(external_id="HH11QW6", name="Victoria", friendly_name="Victoria"))
    session.commit()
    url = "/api/hockey/club-colors/HH11QW6"
    res = client.put(url, json={"color": "#AA0000"}, headers=_auth(admin_token))
    assert res.json() == {"club_id": "HH11QW6", "color": "#aa0000", "manual": "#aa0000"}
    assert client.put(url, json={"color": "rood"}, headers=_auth(admin_token)).status_code == 422
    assert client.put("/api/hockey/club-colors/onbekend", json={"color": None}, headers=_auth(admin_token)).status_code == 404
    assert client.put(url, json={"color": None}).status_code == 401
    assert client.put(f"{API}/club-colors/HH11QW6", json={"color": None}, headers=_auth(admin_token)).status_code in (404, 405)
