"""VBT live backup: samples komen tijdens de rit binnen, gaten worden niet geplakt, finish rondt af."""


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _s(i):
    return [i, i * 8.0, i * 8.0, 150 + i, 85, 120, 8.0, i * 0.1]


LIVE = {"clientId": "c-live", "startedAt": "2026-10-13T18:00:00Z", "kind": "free", "courseKey": "free-v1", "name": "Free Ride"}


def test_live_backup_then_finish(client, user_token):
    r = client.post("/api/vbt/rides/live", headers=_h(user_token), json={**LIVE, "fromIndex": 0, "samples": [_s(i) for i in range(1, 16)]})
    assert r.json() == {"received": 15, "inProgress": True}
    # tweede batch sluit aan
    r = client.post("/api/vbt/rides/live", headers=_h(user_token), json={**LIVE, "fromIndex": 15, "samples": [_s(i) for i in range(16, 31)]})
    assert r.json()["received"] == 30
    # batch met een gat (vorige kwam niet aan): niet plakken, server zegt wat hij heeft
    r = client.post("/api/vbt/rides/live", headers=_h(user_token), json={**LIVE, "fromIndex": 45, "samples": [_s(46)]})
    assert r.json()["received"] == 30

    rides = client.get("/api/vbt/rides", headers=_h(user_token)).json()
    assert len(rides) == 1 and rides[0]["inProgress"] is True and rides[0]["duration"] == 30
    assert rides[0]["distance"] == 240 and rides[0]["syncedAt"]

    # finish met hetzelfde client_id rondt de live rit af (geen tweede rit)
    final = {**LIVE, "duration": 40, "distance": 320, "avgW": 170, "samples": [_s(i) for i in range(1, 41)]}
    done = client.post("/api/vbt/rides", headers=_h(user_token), json=final).json()
    assert done["inProgress"] is False and done["duration"] == 40
    rides = client.get("/api/vbt/rides", headers=_h(user_token)).json()
    assert len(rides) == 1 and len(client.get(f"/api/vbt/rides/{done['id']}", headers=_h(user_token)).json()["samples"]) == 40
    # na afronden doet live niets meer
    r = client.post("/api/vbt/rides/live", headers=_h(user_token), json={**LIVE, "fromIndex": 0, "samples": [_s(1)]})
    assert r.json() == {"received": 40, "inProgress": False}


def test_live_backup_is_private(client, user_token, admin_token):
    client.post("/api/vbt/rides/live", headers=_h(user_token), json={**LIVE, "fromIndex": 0, "samples": [_s(1)]})
    r = client.post("/api/vbt/rides/live", headers=_h(admin_token), json={**LIVE, "fromIndex": 1, "samples": [_s(2)]})
    assert r.status_code == 409


def test_resume_finished_ride(client, user_token):
    final = {**LIVE, "duration": 10, "samples": [_s(i) for i in range(1, 11)]}
    done = client.post("/api/vbt/rides", headers=_h(user_token), json=final).json()
    # herhaling van dezelfde (of kortere) versie verandert niets
    again = client.post("/api/vbt/rides", headers=_h(user_token), json={**final, "samples": [_s(1)]}).json()
    assert again["duration"] == 10
    # hervatten: live met resume zet hem weer open en plakt de nieuwe samples erachter
    r = client.post("/api/vbt/rides/live", headers=_h(user_token),
                    json={**LIVE, "resume": True, "fromIndex": 10, "samples": [_s(i) for i in range(11, 16)]})
    assert r.json() == {"received": 15, "inProgress": True}
    # finish met de langere rit rondt af - nog steeds 1 rit
    end = client.post("/api/vbt/rides", headers=_h(user_token), json={**LIVE, "duration": 20, "samples": [_s(i) for i in range(1, 21)]}).json()
    assert end["id"] == done["id"] and end["duration"] == 20 and end["inProgress"] is False
    assert len(client.get("/api/vbt/rides", headers=_h(user_token)).json()) == 1


def test_continued_ride_saved_even_if_live_sync_never_arrived(client, user_token):
    client.post("/api/vbt/rides", headers=_h(user_token), json={**LIVE, "duration": 10, "samples": [_s(i) for i in range(1, 11)]})
    longer = client.post("/api/vbt/rides", headers=_h(user_token), json={**LIVE, "duration": 25, "samples": [_s(i) for i in range(1, 26)]}).json()
    assert longer["duration"] == 25
