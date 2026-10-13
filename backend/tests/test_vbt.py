"""VBT router: profiel, ritten + PB-bepaling, eigendom, Strava-randgevallen."""


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _ride(**over):
    ride = {
        "startedAt": "2026-10-13T18:00:00.000Z", "kind": "free", "courseKey": "free-v1", "name": "Free Ride",
        "duration": 1200, "distance": 9700, "avgW": 150, "maxW": 380, "avgCad": 85, "avgHr": 135, "kj": 180,
        "elevation": 231, "lapTime": 1198.0, "jumped": False, "ftp": 180,
        "samples": [[1, 5.0, 5.0, 150, 85, 130, 5.0, 0.0], [2, 10.0, 10.0, 151, 86, 131, 5.0, 0.1]],
    }
    ride.update(over)
    return ride


def test_profile_defaults_and_update(client, user_token):
    r = client.get("/api/vbt/profile", headers=_h(user_token))
    assert r.status_code == 200
    assert r.json() == {"ftp": 180, "planSlug": "ftp-builder", "planStart": None, "planDone": {}, "settings": {}}

    r = client.put("/api/vbt/profile", headers=_h(user_token),
                   json={"ftp": 210, "planStart": "2026-10-12", "planDone": {"ftpb-w1d1": {"avgW": 120}}})
    assert r.status_code == 200
    assert client.get("/api/vbt/profile", headers=_h(user_token)).json()["ftp"] == 210


def test_profile_rejects_silly_ftp(client, user_token):
    assert client.put("/api/vbt/profile", headers=_h(user_token), json={"ftp": 5}).status_code == 422


def test_ride_pb_and_best_lap(client, user_token):
    first = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride()).json()
    assert first["pb"] is True
    slower = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride(lapTime=1300.0)).json()
    assert slower["pb"] is False
    jumped = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride(lapTime=900.0, jumped=True)).json()
    assert jumped["pb"] is False

    best = client.get("/api/vbt/rides/best-lap", params={"course": "free-v1"}, headers=_h(user_token)).json()
    assert best["id"] == first["id"]
    assert len(best["samples"]) == 2
    assert client.get("/api/vbt/rides/best-lap", params={"course": "other"}, headers=_h(user_token)).json() is None

    rides = client.get("/api/vbt/rides", headers=_h(user_token)).json()
    assert len(rides) == 3
    assert "samples" not in rides[0]


def test_ride_belongs_to_owner(client, user_token, admin_token):
    ride = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride()).json()
    assert client.get(f"/api/vbt/rides/{ride['id']}", headers=_h(admin_token)).status_code == 404
    assert client.delete(f"/api/vbt/rides/{ride['id']}", headers=_h(admin_token)).status_code == 404
    assert client.get(f"/api/vbt/rides/{ride['id']}", headers=_h(user_token)).status_code == 200


def test_strava_not_configured(client, user_token):
    status = client.get("/api/vbt/strava", headers=_h(user_token)).json()
    assert status["connected"] is False
    if not status["configured"]:
        assert client.get("/api/vbt/strava/connect", headers=_h(user_token)).status_code == 503


def test_strava_callback_rejects_bad_state(client):
    r = client.get("/api/vbt/strava/callback", params={"state": "nonsense", "code": "x"}, follow_redirects=False)
    assert r.status_code == 400


def test_strava_next_only_own_pages():
    from services.vbt_strava import safe_next, with_result
    assert safe_next("/account/profile") == "/account/profile"
    assert safe_next("/vbt/") == "/vbt/"
    for bad in [None, "", "https://evil.example/", "//evil.example/account/", "/admin/", "/account/\evil"]:
        assert safe_next(bad) == "/vbt/"
    assert with_result("/account/profile", "connected") == "/account/profile?strava=connected"
    assert with_result("/vbt/?x=1", "denied") == "/vbt/?x=1&strava=denied"


def test_strava_callback_returns_to_next(client, user_token):
    from services.vbt_strava import STATE_PURPOSE
    from core.auth import create_access_token, decode_token
    from datetime import timedelta
    sub = decode_token(user_token)["sub"]
    state = create_access_token({"sub": sub, "purpose": STATE_PURPOSE, "next": "/account/profile"}, timedelta(minutes=5))
    r = client.get("/api/vbt/strava/callback", params={"state": state, "error": "access_denied"}, follow_redirects=False)
    assert r.status_code in (302, 307) and r.headers["location"] == "/account/profile?strava=denied"


def test_strava_upload_requires_link(client, user_token):
    ride = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride()).json()
    r = client.post(f"/api/vbt/rides/{ride['id']}/strava", headers=_h(user_token),
                    files={"fit": ("ride.fit", b"\x0e\x10", "application/octet-stream")})
    assert r.status_code == 409


def test_ride_save_is_idempotent_by_client_id(client, user_token, admin_token):
    first = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride(clientId="c-123")).json()
    again = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride(clientId="c-123")).json()
    assert again["id"] == first["id"] and again["clientId"] == "c-123"
    assert len(client.get("/api/vbt/rides", headers=_h(user_token)).json()) == 1
    # een andere gebruiker kan niet met hetzelfde client_id een rit 'claimen'
    assert client.post("/api/vbt/rides", headers=_h(admin_token), json=_ride(clientId="c-123")).status_code == 409


def test_zero_second_ride_is_saved(client, user_token):
    r = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride(duration=0, distance=0, samples=[], lapTime=None))
    assert r.status_code == 200 and r.json()["duration"] == 0


def test_delete_goes_to_trash_and_can_be_restored(client, user_token):
    ride = client.post("/api/vbt/rides", headers=_h(user_token),
                       json=_ride(elapsed=1500, pauses=[{"t": 600, "dur": 300, "reason": "trainer signal lost"}],
                                  events=[{"type": "pause", "msg": "Auto-paused"}])).json()
    assert ride["elapsed"] == 1500 and ride["pauses"][0]["reason"] == "trainer signal lost"
    assert client.get(f"/api/vbt/rides/{ride['id']}", headers=_h(user_token)).json()["events"][0]["type"] == "pause"
    assert client.delete(f"/api/vbt/rides/{ride['id']}", headers=_h(user_token)).json()["trash"] is True
    assert client.get("/api/vbt/rides", headers=_h(user_token)).json() == []
    trash = client.get("/api/vbt/rides-trash", headers=_h(user_token)).json()
    assert [r["id"] for r in trash] == [ride["id"]] and trash[0]["deletedAt"]
    # PB/ghost negeert de prullenbak
    assert client.get("/api/vbt/rides/best-lap", params={"course": "free-v1"}, headers=_h(user_token)).json() is None
    client.post(f"/api/vbt/rides/{ride['id']}/restore", headers=_h(user_token))
    assert [r["id"] for r in client.get("/api/vbt/rides", headers=_h(user_token)).json()] == [ride["id"]]
    assert client.get("/api/vbt/rides-trash", headers=_h(user_token)).json() == []


def test_profile_settings_merge(client, user_token):
    client.put("/api/vbt/profile", headers=_h(user_token), json={"settings": {"hrMax": 186}})
    r = client.put("/api/vbt/profile", headers=_h(user_token), json={"settings": {"voice": False}}).json()
    assert r["settings"] == {"hrMax": 186, "voice": False}
    assert client.get("/api/vbt/profile", headers=_h(user_token)).json()["settings"]["hrMax"] == 186


def test_ride_feedback(client, user_token, admin_token):
    ride = client.post("/api/vbt/rides", headers=_h(user_token), json=_ride(clientId="c-fb")).json()
    assert ride["rpe"] is None and ride["readiness"] is None
    r = client.patch(f"/api/vbt/rides/{ride['id']}/feedback", headers=_h(user_token), json={"rpe": 7})
    assert r.status_code == 200 and r.json()["rpe"] == 7
    r = client.patch(f"/api/vbt/rides/{ride['id']}/feedback", headers=_h(user_token), json={"readiness": "tired"})
    assert r.json()["rpe"] == 7 and r.json()["readiness"] == "tired"     # los aan te passen
    assert client.patch(f"/api/vbt/rides/{ride['id']}/feedback", headers=_h(user_token), json={"rpe": 11}).status_code == 422
    assert client.patch(f"/api/vbt/rides/{ride['id']}/feedback", headers=_h(user_token), json={"readiness": "meh"}).status_code == 422
    assert client.patch(f"/api/vbt/rides/{ride['id']}/feedback", headers=_h(admin_token), json={"rpe": 3}).status_code == 404
    # opnieuw opslaan (outbox-retry) laat de feedback staan
    client.post("/api/vbt/rides", headers=_h(user_token), json=_ride(clientId="c-fb", duration=999, samples=[[i, 0, 0, 100, 80, 0, 5, 0] for i in range(5)]))
    got = client.get(f"/api/vbt/rides/{ride['id']}", headers=_h(user_token)).json()
    assert got["rpe"] == 7 and got["readiness"] == "tired"
