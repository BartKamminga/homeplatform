"""MyHome - huis inladen vanuit een JSON-bestand (item 1314).

Bestand: {"home": {name, garden_orientation, notes, meta}, "layout": {"floors": [...]},
          "sources": [{"file", "title", "kind", "floor_key"}]}  (bestanden relatief aan het JSON-bestand)

Gebruik:
  python tools/myhome/import_home.py --base http://192.168.30.232:8081 --token hp_... --file temp/myhome/our-home.json
  ... --home-id <id>   bestaand huis bijwerken in plaats van een nieuw huis aanmaken (koppelingen blijven staan)
"""
import argparse
import json
import mimetypes
from pathlib import Path

import httpx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--token", required=True)
    ap.add_argument("--file", required=True)
    ap.add_argument("--home-id")
    ap.add_argument("--skip-sources", action="store_true")
    args = ap.parse_args()

    path = Path(args.file)
    data = json.loads(path.read_text(encoding="utf-8"))
    client = httpx.Client(base_url=args.base.rstrip("/"), headers={"Authorization": f"Bearer {args.token}"}, timeout=60)

    if args.home_id:
        home = client.patch(f"/api/myhome/homes/{args.home_id}", json=data["home"]).raise_for_status().json()
    else:
        home = client.post("/api/myhome/homes", json=data["home"]).raise_for_status().json()
    home_id = home["id"]
    print(f"Home {home_id}: {home['name']}")

    result = client.put(f"/api/myhome/homes/{home_id}/layout", json=data["layout"]).raise_for_status().json()
    rooms = sum(len(f["rooms"]) for f in result["floors"])
    print(f"Layout: {len(result['floors'])} floors, {rooms} rooms, {result['area_m2']} m2 indoor")

    if args.skip_sources:
        return
    existing = {s["title"] for s in client.get(f"/api/myhome/homes/{home_id}/sources").raise_for_status().json()}
    for src in data.get("sources", []):
        if src["title"] in existing:
            print(f"Source already there: {src['title']}")
            continue
        file = path.parent / src["file"]
        mime = mimetypes.guess_type(file.name)[0] or "image/png"
        up = client.post("/api/uploads", params={"category": "myhome"},
                         files={"file": (file.name, file.read_bytes(), mime)}).raise_for_status().json()
        body = {k: src.get(k) for k in ("title", "kind", "floor_key")} | {"file_path": up["path"]}
        client.post(f"/api/myhome/homes/{home_id}/sources", json=body).raise_for_status()
        print(f"Source uploaded: {src['title']}")


if __name__ == "__main__":
    main()
