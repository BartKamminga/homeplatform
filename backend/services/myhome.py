"""MyHome - export en import van het huismodel (item 1314).

`export_home` is het contract van de open v1-API: wijzig bestaande sleutels niet, voeg alleen toe.
"""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from core.analytics import client_ip, hash_ip, log_site_event
from models.myhome import Home, HomeDevice, HomeFloor, HomeRoom

ROOM_KINDS = {"living", "bedroom", "wet", "circulation", "storage", "outdoor"}
LINK_STATUSES = {"linked", "proposed", "none"}
API_VERSION = 1


def log_call(request: Request, endpoint: str, count: Optional[int] = None) -> None:
    """Gebruik van de open API en de HA-sync zichtbaar maken in admin > Site-monitoring.
    Live-events worden bewust niet gelogd (elke lamp/deur zou een rij opleveren)."""
    try:
        log_site_event("myhome", "api_call", ip_hash=hash_ip(client_ip(request)),
                       user_agent=request.headers.get("User-Agent", ""), endpoint=endpoint, result_count=count)
    except Exception:
        pass


def polygon_area(polygon: Optional[list]) -> float:
    """Oppervlak in m2 via de shoelace-formule."""
    if not polygon or len(polygon) < 3:
        return 0.0
    total = 0.0
    for i, (x1, z1) in enumerate(polygon):
        x2, z2 = polygon[(i + 1) % len(polygon)]
        total += x1 * z2 - x2 * z1
    return round(abs(total) / 2, 2)


def adopt_area_devices(session: Session, room: HomeRoom) -> int:
    """Apparaten zonder ruimte waarvan de HA-ruimte gelijk is aan die van deze ruimte, verhuizen mee."""
    area = room.ha_area.lower()
    moved = 0
    for d in session.exec(select(HomeDevice).where(HomeDevice.home_id == room.home_id, HomeDevice.room_id.is_(None))).all():
        if str((d.meta or {}).get("ha_area") or "").lower() == area:
            d.room_id = room.id
            session.add(d)
            moved += 1
    return moved


def get_owned_home(session: Session, home_id: str, user_id: str) -> Home:
    home = session.get(Home, home_id)
    if not home or home.user_id != user_id:
        raise HTTPException(status_code=404, detail="Home not found")
    return home


def device_dict(d: HomeDevice) -> dict:
    return {
        "id": d.id, "name": d.name, "kind": d.kind, "source": d.source,
        "external_id": d.external_id, "manufacturer": d.manufacturer, "model": d.model,
        "room_id": d.room_id, "notes": d.notes, "meta": d.meta or {},
    }


def room_dict(room: HomeRoom, floor_key: str, devices: Optional[list] = None) -> dict:
    return {
        "id": room.id,
        "key": room.key,
        "floor": floor_key,
        "name": room.name,
        "kind": room.kind,
        "area_m2": polygon_area(room.polygon),
        "ha_area": room.ha_area,
        "link_status": room.link_status,
        "notes": room.notes,
        "polygon": room.polygon,
        "label_at": room.label_at,
        "meta": room.meta or {},
        "devices": devices or [],
    }


def export_home(session: Session, home: Home) -> dict:
    floors = session.exec(
        select(HomeFloor).where(HomeFloor.home_id == home.id).order_by(HomeFloor.sort)
    ).all()
    rooms = session.exec(
        select(HomeRoom).where(HomeRoom.home_id == home.id).order_by(HomeRoom.sort)
    ).all()
    devices = session.exec(
        select(HomeDevice).where(HomeDevice.home_id == home.id).order_by(HomeDevice.name)
    ).all()
    by_room: dict = {}
    for d in devices:
        by_room.setdefault(d.room_id, []).append(device_dict(d))
    out_floors = []
    for f in floors:
        f_rooms = [room_dict(r, f.key, by_room.get(r.id)) for r in rooms if r.floor_id == f.id]
        indoor = sum(r["area_m2"] for r in f_rooms if r["kind"] != "outdoor")
        out_floors.append({
            "id": f.id, "key": f.key, "name": f.name, "level": f.level,
            "ha_floor": f.ha_floor, "roof": f.roof,
            "area_m2": round(indoor, 2), "rooms": f_rooms,
        })
    return {
        "api_version": API_VERSION,
        "id": home.id,
        "name": home.name,
        "garden_orientation": home.garden_orientation,
        "notes": home.notes,
        "meta": home.meta or {},
        "updated_at": home.updated_at.isoformat(),
        "area_m2": round(sum(f["area_m2"] for f in out_floors), 2),
        "floors": out_floors,
        "unassigned_devices": by_room.get(None, []),
        "device_count": len(devices),
        "review_count": sum(1 for d in devices if (d.meta or {}).get("review") == "new"),
    }


def replace_layout(session: Session, home: Home, floors: list[dict]) -> None:
    """Vervangt alle verdiepingen en ruimtes van een huis (import vanuit tekeningen).

    Bestaande ruimtes met dezelfde floor+room-key houden hun id (dus hun apparaten) en hun
    ha_area/link_status/notes als de import die niet meegeeft - zo gaan handmatige koppelingen niet
    verloren bij een nieuwe tekening. Apparaten van verdwenen ruimtes worden ontkoppeld.
    """
    old_floors = session.exec(select(HomeFloor).where(HomeFloor.home_id == home.id)).all()
    old_rooms = session.exec(select(HomeRoom).where(HomeRoom.home_id == home.id)).all()
    floor_key_by_id = {f.id: f.key for f in old_floors}
    keep = {(floor_key_by_id.get(r.floor_id), r.key): r for r in old_rooms}
    new_keys = {(f["key"], r["key"]) for f in floors for r in f.get("rooms", [])}
    gone = {r.id for k, r in keep.items() if k not in new_keys}
    for d in session.exec(select(HomeDevice).where(HomeDevice.home_id == home.id)).all():
        if d.room_id in gone:
            d.room_id = None
            session.add(d)
    for r in old_rooms:
        session.delete(r)
    for f in old_floors:
        session.delete(f)
    session.flush()

    for fi, f in enumerate(floors):
        floor = HomeFloor(
            home_id=home.id, key=f["key"], name=f["name"], level=f.get("level", 0),
            sort=f.get("sort", fi), ha_floor=f.get("ha_floor"), roof=f.get("roof"),
        )
        session.add(floor)
        session.flush()
        for ri, r in enumerate(f.get("rooms", [])):
            prev = keep.get((f["key"], r["key"]))
            kind = r.get("kind", "living")
            status = r.get("link_status") or (prev.link_status if prev else "none")
            if kind not in ROOM_KINDS:
                raise HTTPException(status_code=422, detail=f"Unknown room kind: {kind}")
            if status not in LINK_STATUSES:
                raise HTTPException(status_code=422, detail=f"Unknown link status: {status}")
            session.add(HomeRoom(
                **({"id": prev.id} if prev else {}),
                home_id=home.id, floor_id=floor.id, key=r["key"], name=r["name"], kind=kind,
                polygon=r.get("polygon"), label_at=r.get("label_at"),
                ha_area=r.get("ha_area", prev.ha_area if prev else None),
                link_status=status,
                notes=r.get("notes", prev.notes if prev else None),
                meta=r.get("meta", prev.meta if prev else None),
                sort=r.get("sort", ri),
            ))
    home.updated_at = datetime.utcnow()
    session.add(home)
    session.commit()
