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


def test_mapillary_pick_prefers_heading_and_distance():
    from services.vbt_mapillary import pick
    p = (52.1, 4.9)
    near_wrong_way = {"id": "a", "computed_geometry": {"coordinates": [4.9, 52.1]}, "computed_compass_angle": 180}
    near_right_way = {"id": "b", "computed_geometry": {"coordinates": [4.9002, 52.1001]}, "computed_compass_angle": 10}
    far_right_way = {"id": "c", "computed_geometry": {"coordinates": [4.9006, 52.1004]}, "computed_compass_angle": 0}
    assert pick([near_wrong_way, far_right_way, near_right_way], p, 0)["id"] == "b"
    assert pick([near_wrong_way], p, 0) is None


def test_route_points_and_photo_status(client, user_token):
    h = {"Authorization": "Bearer " + user_token}
    bad = client.post("/api/vbt/routes", headers=h, json={"name": "x", "segments": [[100, 1]], "points": [[52, 4], [52, 4]]})
    assert bad.status_code == 422
    r = client.post("/api/vbt/routes", headers=h, json={"name": "Lus", "segments": [[100, 1], [100, 0]], "points": [[52.1, 4.9], [52.101, 4.9]]}).json()
    assert r["hasPoints"] and r["photoCount"] == 0
    assert client.get("/api/vbt/realride", headers=h).json() == {"configured": False}
    assert client.post("/api/vbt/routes/" + r["id"] + "/photos", headers=h).status_code == 503
    assert client.get("/api/vbt/routes/" + r["id"] + "/photos", headers=h).json() == []
