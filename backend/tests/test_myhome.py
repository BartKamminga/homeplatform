"""MyHome (item 1314): huismodel, layout-import, invoer en de open v1-API."""
from datetime import datetime

from core.auth import hash_api_key
from models.core import UserApiKey

LAYOUT = {"floors": [
    {"key": "ground", "name": "Ground floor", "level": 0, "ha_floor": "First floor", "rooms": [
        {"key": "kitchen", "name": "Kitchen", "kind": "living", "polygon": [[0, 0], [3, 0], [3, 4], [0, 4]]},
        {"key": "garden", "name": "Terrace", "kind": "outdoor", "polygon": [[0, -2], [3, -2], [3, 0], [0, 0]]},
    ]},
    {"key": "first", "name": "First floor", "level": 2.75, "rooms": [
        {"key": "bed1", "name": "Bedroom 1", "kind": "bedroom", "polygon": [[0, 0], [2, 0], [2, 2.5], [0, 2.5]]},
    ]},
]}


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _home(client, token):
    res = client.post("/api/myhome/homes", json={"name": "Ons huis", "garden_orientation": "Z"}, headers=_h(token))
    assert res.status_code == 201
    return res.json()["id"]


def test_layout_import_and_area(client, user_token):
    home_id = _home(client, user_token)
    res = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token))
    assert res.status_code == 200
    data = res.json()
    assert data["api_version"] == 1
    assert [f["key"] for f in data["floors"]] == ["ground", "first"]
    # buitenruimte telt niet mee in het woonoppervlak
    assert data["floors"][0]["area_m2"] == 12.0
    assert data["area_m2"] == 17.0


def test_reimport_keeps_manual_links(client, user_token):
    home_id = _home(client, user_token)
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token)).json()
    room_id = data["floors"][0]["rooms"][0]["id"]
    res = client.patch(f"/api/myhome/rooms/{room_id}", json={"ha_area": "Kitchen", "link_status": "linked"},
                       headers=_h(user_token))
    assert res.status_code == 200
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token)).json()
    kitchen = data["floors"][0]["rooms"][0]
    assert (kitchen["ha_area"], kitchen["link_status"]) == ("Kitchen", "linked")


def test_validation(client, user_token):
    home_id = _home(client, user_token)
    bad = {"floors": [{"key": "g", "name": "G", "rooms": [{"key": "x", "name": "X", "kind": "spaceship"}]}]}
    assert client.put(f"/api/myhome/homes/{home_id}/layout", json=bad, headers=_h(user_token)).status_code == 422


def test_other_user_cannot_read(client, user_token, admin_token):
    home_id = _home(client, user_token)
    assert client.get(f"/api/myhome/homes/{home_id}", headers=_h(admin_token)).status_code == 404
    assert client.get(f"/api/myhome/v1/homes/{home_id}", headers=_h(admin_token)).status_code == 404


def test_notes_and_sources(client, user_token, regular_user):
    home_id = _home(client, user_token)
    note = client.post(f"/api/myhome/homes/{home_id}/notes", json={"text": "Slaapkamer D is van Thom"},
                       headers=_h(user_token)).json()
    assert note["status"] == "open"
    res = client.patch(f"/api/myhome/notes/{note['id']}", json={"status": "applied", "response": "Gekoppeld"},
                       headers=_h(user_token))
    assert res.json()["resolved_at"] is not None
    assert client.get(f"/api/myhome/homes/{home_id}/notes?status=open", headers=_h(user_token)).json() == []

    # alleen eigen uploads uit de myhome-categorie
    bad = {"title": "Plan", "file_path": "general/someone/x.png"}
    assert client.post(f"/api/myhome/homes/{home_id}/sources", json=bad, headers=_h(user_token)).status_code == 422
    ok = {"title": "Zolder", "file_path": f"myhome/{regular_user.id}/a.png", "floor_key": "attic"}
    src = client.post(f"/api/myhome/homes/{home_id}/sources", json=ok, headers=_h(user_token)).json()
    assert src["url"].endswith("/a.png")


def test_v1_with_api_key_and_filters(client, session, user_token, regular_user):
    home_id = _home(client, user_token)
    client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token))
    session.add(UserApiKey(user_id=regular_user.id, name="ha", key_hash=hash_api_key("hp_testkey"), key_hint="testkey",
                           created_at=datetime.utcnow()))
    session.commit()
    rooms = client.get(f"/api/myhome/v1/homes/{home_id}/rooms?kind=bedroom", headers=_h("hp_testkey")).json()
    assert [r["key"] for r in rooms] == ["bed1"]
    assert client.get("/api/myhome/v1/homes", headers=_h("hp_testkey")).json()[0]["id"] == home_id


def test_devices_import_assign_and_survive_relayout(client, user_token):
    home_id = _home(client, user_token)
    client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token))
    payload = {"devices": [
        {"name": "Kitchen panel", "kind": "light", "source": "hue", "external_id": "hue-1", "room_key": "ground/kitchen"},
        {"name": "Hall sensor", "kind": "sensor", "source": "home_assistant", "external_id": "binary_sensor.hall"},
    ]}
    res = client.put(f"/api/myhome/homes/{home_id}/devices/import", json=payload, headers=_h(user_token))
    assert res.json() == {"created": 2, "updated": 0, "new": ["Kitchen panel", "Hall sensor"]}
    # tweede import = update, geen dubbelingen
    assert client.put(f"/api/myhome/homes/{home_id}/devices/import", json=payload,
                      headers=_h(user_token)).json() == {"created": 0, "updated": 2, "new": []}

    data = client.get(f"/api/myhome/v1/homes/{home_id}", headers=_h(user_token)).json()
    kitchen = data["floors"][0]["rooms"][0]
    assert [d["name"] for d in kitchen["devices"]] == ["Kitchen panel"]
    assert [d["name"] for d in data["unassigned_devices"]] == ["Hall sensor"]

    # koppelen via PATCH, daarna opnieuw importeren van de tekening: koppeling blijft
    sensor_id = data["unassigned_devices"][0]["id"]
    bed_id = data["floors"][1]["rooms"][0]["id"]
    assert client.patch(f"/api/myhome/devices/{sensor_id}", json={"room_id": bed_id},
                        headers=_h(user_token)).json()["room_id"] == bed_id
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token)).json()
    assert data["unassigned_devices"] == []
    assert data["floors"][1]["rooms"][0]["devices"][0]["name"] == "Hall sensor"

    # ruimte verdwijnt uit de tekening -> apparaat wordt ontkoppeld
    smaller = {"floors": [LAYOUT["floors"][0]]}
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=smaller, headers=_h(user_token)).json()
    assert [d["name"] for d in data["unassigned_devices"]] == ["Hall sensor"]


def test_sync_flags_new_keeps_user_edits_and_maps_ha_area(client, user_token):
    home_id = _home(client, user_token)
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token)).json()
    kitchen_id = data["floors"][0]["rooms"][0]["id"]
    client.patch(f"/api/myhome/rooms/{kitchen_id}", json={"ha_area": "Kitchen", "link_status": "linked"}, headers=_h(user_token))

    sync = {"devices": [{"name": "Fridge plug", "kind": "plug", "source": "home_assistant", "external_id": "dev-1",
                         "meta": {"ha_area": "Kitchen"}}]}
    res = client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token)).json()
    assert res["new"] == ["Fridge plug"]
    home = client.get(f"/api/myhome/homes/{home_id}", headers=_h(user_token)).json()
    assert home["review_count"] == 1
    dev = home["floors"][0]["rooms"][0]["devices"][0]
    assert dev["meta"]["review"] == "new"

    # gebruiker hernoemt, plaatst en bevestigt; volgende sync laat dat staan
    meta = {**dev["meta"], "review": "done", "position": [1.0, 2.0], "floor": "ground"}
    client.patch(f"/api/myhome/devices/{dev['id']}", json={"name": "Koelkast", "meta": meta}, headers=_h(user_token))
    sync["devices"][0]["meta"] = {"ha_area": "Kitchen", "entities": ["switch.fridge"]}
    assert client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token)).json()["new"] == []
    dev = client.get(f"/api/myhome/homes/{home_id}", headers=_h(user_token)).json()["floors"][0]["rooms"][0]["devices"][0]
    assert dev["name"] == "Koelkast"
    assert dev["meta"]["position"] == [1.0, 2.0] and dev["meta"]["review"] == "done"
    assert dev["meta"]["entities"] == ["switch.fridge"]


def test_edit_walls_appearance_and_room_photo(client, user_token, regular_user):
    home_id = _home(client, user_token)
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token)).json()
    room_id = data["floors"][0]["rooms"][0]["id"]
    bad = client.patch(f"/api/myhome/rooms/{room_id}", json={"polygon": [[0, 0], [1, 1]]}, headers=_h(user_token))
    assert bad.status_code == 422
    res = client.patch(f"/api/myhome/rooms/{room_id}", headers=_h(user_token), json={
        "polygon": [[0, 0], [4, 0], [4, 4], [0, 4]], "meta": {"wall_color": "#e8e2d4"}}).json()
    kitchen = res["floors"][0]["rooms"][0]
    assert kitchen["area_m2"] == 16.0 and kitchen["meta"]["wall_color"] == "#e8e2d4"

    photo = {"title": "Kitchen wall", "kind": "photo", "file_path": f"myhome/{regular_user.id}/w.jpg", "room_id": room_id}
    assert client.post(f"/api/myhome/homes/{home_id}/sources", json=photo, headers=_h(user_token)).json()["room_id"] == room_id
    photo["room_id"] = "not-a-room"
    assert client.post(f"/api/myhome/homes/{home_id}/sources", json=photo, headers=_h(user_token)).status_code == 422


def test_live_events(client, user_token):
    home_id = _home(client, user_token)
    sync = {"devices": [{"name": "Front door", "kind": "sensor", "source": "home_assistant", "external_id": "dev-door",
                         "meta": {"entities": ["binary_sensor.front_door"]}}]}
    client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token))
    events = {"events": [{"entity_id": "binary_sensor.front_door", "state": "on", "device_class": "door"},
                         {"entity_id": "light.unknown", "state": "on"}]}
    assert client.post(f"/api/myhome/homes/{home_id}/events", json=events, headers=_h(user_token)).json() == {"matched": 1}
    live = client.get(f"/api/myhome/homes/{home_id}/live", headers=_h(user_token)).json()
    (state,) = live.values()
    assert state["binary_sensor.front_door"]["state"] == "on"
    # een volgende sync laat de live-status staan
    client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token))
    assert client.get(f"/api/myhome/homes/{home_id}/live", headers=_h(user_token)).json() == live


def test_linking_room_to_ha_area_adopts_devices(client, user_token):
    home_id = _home(client, user_token)
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token)).json()
    bed_id = data["floors"][1]["rooms"][0]["id"]
    sync = {"ha_areas": ["Room Thom", "Kitchen"], "devices": [
        {"name": "Thom lamp", "kind": "light", "source": "hue", "external_id": "h1", "meta": {"ha_area": "Room Thom"}},
        {"name": "Thom speaker", "kind": "speaker", "source": "home_assistant", "external_id": "d1", "meta": {"ha_area": "Room Thom"}},
    ]}
    client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token))
    home = client.get(f"/api/myhome/homes/{home_id}", headers=_h(user_token)).json()
    assert home["meta"]["ha_areas"] == ["Kitchen", "Room Thom"] and len(home["unassigned_devices"]) == 2
    home = client.patch(f"/api/myhome/rooms/{bed_id}", json={"ha_area": "Room Thom", "link_status": "linked"},
                        headers=_h(user_token)).json()
    assert home["unassigned_devices"] == []
    assert {d["name"] for d in home["floors"][1]["rooms"][0]["devices"]} == {"Thom lamp", "Thom speaker"}


def test_changes_push_queue_and_result(client, user_token):
    home_id = _home(client, user_token)
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token)).json()
    kitchen_id = data["floors"][0]["rooms"][0]["id"]
    client.patch(f"/api/myhome/rooms/{kitchen_id}", json={"ha_area": "Cooking", "link_status": "linked"}, headers=_h(user_token))
    sync = {"devices": [
        {"name": "Hue lamp 1", "kind": "light", "source": "hue", "external_id": "hue-9",
         "meta": {"ha_device_id": "dev-9", "ha_area": "Hall"}},
        {"name": "Tado kamer", "kind": "thermostat", "source": "home_assistant", "external_id": "dev-t",
         "manufacturer": "tado", "meta": {"ha_device_id": "dev-t", "ha_area": "Cooking"}},
    ]}
    client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token))
    devs = {d["external_id"]: d for d in client.get(f"/api/myhome/homes/{home_id}/devices", headers=_h(user_token)).json()}
    # in MyHome: lamp hernoemen en in de keuken zetten, tado hernoemen
    client.patch(f"/api/myhome/devices/{devs['hue-9']['id']}", json={"name": "Keuken plafond", "room_id": kitchen_id}, headers=_h(user_token))
    client.patch(f"/api/myhome/devices/{devs['dev-t']['id']}", json={"name": "Keuken thermostaat"}, headers=_h(user_token))

    changes = client.get(f"/api/myhome/homes/{home_id}/changes", headers=_h(user_token)).json()
    kinds = {(c["kind"], c["target"]): c for c in changes}
    assert kinds[("rename_device", "dev-9")]["payload"]["hue_device_id"] == "hue-9"
    assert kinds[("move_device", "dev-9")]["payload"]["to"] == "Cooking"
    assert kinds[("rename_device", "dev-t")]["supported"] is False
    assert kinds[("rename_area", "Cooking")]["payload"]["to"] == "Kitchen"

    pick = [{k: kinds[key][k] for k in ("kind", "target", "payload")} for key in [("rename_device", "dev-9"), ("move_device", "dev-9")]]
    assert client.post(f"/api/myhome/homes/{home_id}/push", json={"changes": pick}, headers=_h(user_token)).json() == {"queued": 2}
    assert client.post(f"/api/myhome/homes/{home_id}/push", json={"changes": pick}, headers=_h(user_token)).json() == {"queued": 0}
    jobs = client.get(f"/api/myhome/homes/{home_id}/push?status=pending", headers=_h(user_token)).json()
    assert len(jobs) == 2
    for j in jobs:
        client.post(f"/api/myhome/push/{j['id']}/result", json={"status": "applied"}, headers=_h(user_token))
    left = {(c["kind"], c["target"]) for c in client.get(f"/api/myhome/homes/{home_id}/changes", headers=_h(user_token)).json()}
    assert ("rename_device", "dev-9") not in left and ("move_device", "dev-9") not in left
    # volgende sync met de nieuwe HA-naam: geen verschil meer
    sync["devices"][0]["name"] = "Keuken plafond"
    client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token))
    left = {(c["kind"], c["target"]) for c in client.get(f"/api/myhome/homes/{home_id}/changes", headers=_h(user_token)).json()}
    assert ("rename_device", "dev-9") not in left


def test_live_event_numeric_state(client, user_token):
    home_id = _home(client, user_token)
    sync = {"devices": [{"name": "Inverter 1", "kind": "energy", "source": "home_assistant", "external_id": "inv-1",
                         "meta": {"entities": ["sensor.inverter_1"]}}]}
    client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token))
    res = client.post(f"/api/myhome/homes/{home_id}/events", headers=_h(user_token),
                      json={"events": [{"entity_id": "sensor.inverter_1", "state": 114, "device_class": "power"}]})
    assert res.json() == {"matched": 1}
    (live,) = client.get(f"/api/myhome/homes/{home_id}/live", headers=_h(user_token)).json().values()
    assert live["sensor.inverter_1"]["state"] == "114"


def test_roof_and_garden_floors_not_indoor(client, user_token):
    home_id = _home(client, user_token)
    layout = {"floors": LAYOUT["floors"] + [
        {"key": "roof", "name": "Dak", "level": 8, "rooms": [
            {"key": "plane", "name": "Dakvlak", "kind": "roof", "polygon": [[0, 0], [4, 0], [4, 5], [0, 5]]}]},
        {"key": "garden", "name": "Tuin", "level": 0, "rooms": [
            {"key": "back", "name": "Achtertuin", "kind": "garden", "polygon": [[0, -8], [4, -8], [4, 0], [0, 0]]}]},
    ]}
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=layout, headers=_h(user_token)).json()
    assert data["area_m2"] == 17.0                          # dak en tuin tellen niet mee
    roof = next(f for f in data["floors"] if f["key"] == "roof")
    assert roof["rooms"][0]["area_m2"] == 20.0 and roof["area_m2"] == 0


def test_keep_ha_drops_proposals(client, user_token):
    home_id = _home(client, user_token)
    data = client.put(f"/api/myhome/homes/{home_id}/layout", json=LAYOUT, headers=_h(user_token)).json()
    kitchen_id = data["floors"][0]["rooms"][0]["id"]
    client.patch(f"/api/myhome/rooms/{kitchen_id}", json={"name": "Keuken", "ha_area": "Kitchen", "link_status": "linked"},
                 headers=_h(user_token))
    sync = {"devices": [{"name": "Hue lamp 1", "kind": "light", "source": "hue", "external_id": "hue-9",
                         "meta": {"ha_device_id": "dev-9", "ha_area": "Kitchen"}}]}
    client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token))
    dev = client.get(f"/api/myhome/homes/{home_id}/devices", headers=_h(user_token)).json()[0]
    client.patch(f"/api/myhome/devices/{dev['id']}", json={"name": "Lamp keuken", "room_id": None}, headers=_h(user_token))
    changes = client.get(f"/api/myhome/homes/{home_id}/changes", headers=_h(user_token)).json()
    pick = [{k: c[k] for k in ("kind", "target", "payload")} for c in changes if c["kind"] == "rename_device"]
    client.post(f"/api/myhome/homes/{home_id}/push", json={"changes": pick}, headers=_h(user_token))

    keep = lambda kind, target: client.post(f"/api/myhome/homes/{home_id}/changes/keep-ha",  # noqa: E731
                                            json={"kind": kind, "target": target}, headers=_h(user_token))
    left = keep("rename_area", "Kitchen").json()
    assert ("rename_area", "Kitchen") not in {(c["kind"], c["target"]) for c in left}
    assert keep("rename_device", "dev-9").json() == []
    dev = client.get(f"/api/myhome/homes/{home_id}/devices", headers=_h(user_token)).json()[0]
    assert dev["name"] == "Hue lamp 1"
    assert client.get(f"/api/myhome/homes/{home_id}/push?status=pending", headers=_h(user_token)).json() == []
    # naam volgt HA weer bij de volgende sync
    sync["devices"][0]["name"] = "Hue lamp keuken"
    client.put(f"/api/myhome/homes/{home_id}/devices/import", json=sync, headers=_h(user_token))
    assert client.get(f"/api/myhome/homes/{home_id}/devices", headers=_h(user_token)).json()[0]["name"] == "Hue lamp keuken"
    assert keep("move_device", "nope").status_code == 404
    assert keep("rename_floor", "x").status_code == 422
