"""MyHome - een huis van de ene omgeving naar de andere kopieren (bv. acc -> prod), via de API.

Neemt mee: huisgegevens + meta, verdiepingen en ruimtes (incl. koppelingen en kleuren), apparaten (ruimte,
positie, review-status, entities), bronbestanden (opnieuw geupload) en correcties. Live-status niet.

Gebruik:
  python tools/myhome/transfer_home.py --src http://192.168.30.232:8081 --src-token hp_... --home <id>
                                       --dst https://webheaven.nl --dst-token hp_...
"""
import argparse
import mimetypes

import httpx

LAYOUT_ROOM_FIELDS = ("key", "name", "kind", "polygon", "label_at", "ha_area", "link_status", "notes", "meta")
LAYOUT_FLOOR_FIELDS = ("key", "name", "level", "ha_floor", "roof")


def client(base, token):
    return httpx.Client(base_url=base.rstrip("/"), headers={"Authorization": f"Bearer {token}"}, timeout=120)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--src-token", required=True)
    ap.add_argument("--home", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--dst-token", required=True)
    args = ap.parse_args()
    src, dst = client(args.src, args.src_token), client(args.dst, args.dst_token)

    home = src.get(f"/api/myhome/v1/homes/{args.home}").raise_for_status().json()
    new = dst.post("/api/myhome/homes", json={k: home[k] for k in ("name", "garden_orientation", "notes", "meta")}).raise_for_status().json()
    hid = new["id"]
    print(f"Home {hid}: {home['name']}")

    # Indeling
    floors = [{**{k: f[k] for k in LAYOUT_FLOOR_FIELDS}, "rooms": [{k: r[k] for k in LAYOUT_ROOM_FIELDS} for r in f["rooms"]]}
              for f in home["floors"]]
    layout = dst.put(f"/api/myhome/homes/{hid}/layout", json={"floors": floors}).raise_for_status().json()
    src_room_key = {r["id"]: f"{f['key']}/{r['key']}" for f in home["floors"] for r in f["rooms"]}
    dst_room_id = {f"{f['key']}/{r['key']}": r["id"] for f in layout["floors"] for r in f["rooms"]}
    room_map = {sid: dst_room_id[key] for sid, key in src_room_key.items()}
    print(f"Layout: {len(layout['floors'])} floors, {len(room_map)} rooms")

    # Apparaten: gesynchroniseerde via import, handmatige via POST; daarna meta/ruimte exact overnemen
    devices = [d for f in home["floors"] for r in f["rooms"] for d in r["devices"]] + home["unassigned_devices"]
    synced = [d for d in devices if d["external_id"]]
    if synced:
        dst.put(f"/api/myhome/homes/{hid}/devices/import", json={"devices": [
            {k: d[k] for k in ("name", "kind", "source", "external_id", "manufacturer", "model", "notes")} for d in synced
        ]}).raise_for_status()
    current = dst.get(f"/api/myhome/homes/{hid}/devices").raise_for_status().json()
    by_ext = {(d["source"], d["external_id"]): d["id"] for d in current}
    for d in devices:
        meta = {k: v for k, v in (d["meta"] or {}).items() if k != "live"}
        room = room_map.get(d["room_id"])
        if d["external_id"]:
            dst.patch(f"/api/myhome/devices/{by_ext[(d['source'], d['external_id'])]}",
                      json={"room_id": room, "meta": meta}).raise_for_status()
        else:
            dst.post(f"/api/myhome/homes/{hid}/devices", json={
                "name": d["name"], "kind": d["kind"], "source": d["source"], "notes": d["notes"],
                "manufacturer": d["manufacturer"], "model": d["model"], "room_id": room, "meta": meta,
            }).raise_for_status()
    print(f"Devices: {len(devices)} ({len(synced)} synced, {len(devices) - len(synced)} manual)")

    # Bronnen: bestand ophalen en opnieuw uploaden
    sources = src.get(f"/api/myhome/homes/{args.home}/sources").raise_for_status().json()
    for s in sources:
        blob = src.get(s["url"]).raise_for_status().content
        name = s["file_path"].rsplit("/", 1)[-1]
        mime = mimetypes.guess_type(name)[0] or "image/jpeg"
        up = dst.post("/api/uploads", params={"category": "myhome"}, files={"file": (name, blob, mime)}).raise_for_status().json()
        dst.post(f"/api/myhome/homes/{hid}/sources", json={
            "title": s["title"], "kind": s["kind"], "floor_key": s["floor_key"],
            "room_id": room_map.get(s["room_id"]), "file_path": up["path"],
        }).raise_for_status()
    print(f"Sources: {len(sources)}")

    # Correcties, oudste eerst
    notes = src.get(f"/api/myhome/homes/{args.home}/notes").raise_for_status().json()
    for n in reversed(notes):
        nn = dst.post(f"/api/myhome/homes/{hid}/notes", json={"text": n["text"]}).raise_for_status().json()
        if n["status"] != "open" or n["response"]:
            dst.patch(f"/api/myhome/notes/{nn['id']}", json={"status": n["status"], "response": n["response"]}).raise_for_status()
    print(f"Notes: {len(notes)}")

    check = dst.get(f"/api/myhome/v1/homes/{hid}").raise_for_status().json()
    print(f"Check: {check['area_m2']} m2, {check['device_count']} devices, {check['review_count']} to review, "
          f"{len(check['unassigned_devices'])} unassigned")


if __name__ == "__main__":
    main()
