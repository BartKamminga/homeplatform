"""Items 1297 en 1302: zones en beste vermogens per rit (services/vbt_analysis.py)."""
from services.vbt_analysis import analyze, mmp, zones


def ride(seconds, watts, hr=lambda t: 140):
    return [[t, 0, t * 8, watts(t), 85, hr(t), 8, 0] for t in range(seconds)]


def test_power_zones_use_ride_ftp():
    # FTP 200: 100 W = 50% (Z1), 160 W = 80% (Z3), 220 W = 110% (Z5), 0 W = Z1
    s = ride(40, lambda t: [100, 160, 220, 0][t // 10])
    assert zones(s, 200)["pw"] == [20, 0, 10, 0, 10, 0, 0]


def test_hr_histogram_per_5_bpm():
    s = ride(10, lambda t: 150, hr=lambda t: 141 if t < 4 else 0)
    assert zones(s, 200)["hr"] == {"140": 4}


def test_mmp_best_windows():
    # 10 min op 150 W, dan 5 min op 300 W, dan 10 min op 150 W
    s = ride(1500, lambda t: 300 if 600 <= t < 900 else 150)
    m = mmp(s)
    assert m["300"] == 300
    assert m["1200"] == round((300 * 300 + 900 * 150) / 1200)
    assert "3600" not in m


def test_analyze_has_version_and_parts():
    a = analyze(ride(2000, lambda t: 150), 180)
    assert a["v"] == 2 and a["eligible"] and "zones" in a and "mmp" in a
    assert analyze([], 180) == {"v": 2, "eligible": False}


def test_routes_crud_and_validation(client, user_token, admin_token):
    h = {"Authorization": "Bearer " + user_token}
    bad = client.post("/api/vbt/routes", headers=h, json={"name": "x", "segments": [[100, 45]]})
    assert bad.status_code == 422
    r = client.post("/api/vbt/routes", headers=h, json={"name": "Ronde Venen", "segments": [[100, 2], [100, -1], [200, 5]], "curves": [0, 1.5, -2]}).json()
    assert r["distance"] == 400 and r["elevation"] == 12 and r["slug"] == "gpx-" + r["id"]
    assert [x["id"] for x in client.get("/api/vbt/routes", headers=h).json()] == [r["id"]]
    other = {"Authorization": "Bearer " + admin_token}
    assert client.get("/api/vbt/routes/" + r["id"], headers=other).status_code == 404
    assert client.get("/api/vbt/routes/" + r["id"], headers=h).json()["curves"] == [0, 1.5, -2]
    assert client.delete("/api/vbt/routes/" + r["id"], headers=h).json() == {"ok": True}
