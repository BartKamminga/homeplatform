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
    assert r.json() == {"ftp": 180, "planStart": None, "planDone": {}}

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
