"""MyHome apparaten - alle IoT-apparaten van het huis, gekoppeld aan ruimtes (item 1314).

`PUT /homes/{id}/devices/import` is de sync-ingang voor Hue/HA/tado: upsert op (source, external_id),
een bestaande ruimtekoppeling blijft staan tenzij de import zelf een ruimte meegeeft.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.myhome import HomeDevice, HomeFloor, HomeRoom
from services.myhome import device_dict, get_owned_home, log_call

router = APIRouter(prefix="/api/myhome", tags=["myhome"])

DEVICE_FIELDS = ("name", "kind", "source", "external_id", "manufacturer", "model", "notes", "meta")
# Velden in meta die alleen de gebruiker zet; een sync overschrijft ze nooit.
PROTECTED_META = {"position", "floor", "review", "edited", "live"}


class DeviceIn(BaseModel):
    name: str
    kind: str = "other"
    source: str = "manual"
    external_id: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    notes: Optional[str] = None
    meta: Optional[dict] = None
    room_id: Optional[str] = None
    room_key: Optional[str] = None     # alternatief voor room_id bij import: "<floor_key>/<room_key>"


class DevicePatch(BaseModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    room_id: Optional[str] = None
    notes: Optional[str] = None
    meta: Optional[dict] = None


class DeviceImport(BaseModel):
    devices: list[DeviceIn]
    ha_areas: Optional[list[str]] = None   # alle ruimtes in HA, voor de keuzelijst bij het koppelen


class StateEvent(BaseModel):
    entity_id: str
    state: str
    device_class: Optional[str] = None
    at: Optional[str] = None


class StateEvents(BaseModel):
    events: list[StateEvent]


def _resolve_room(session: Session, home_id: str, room_id: Optional[str], room_key: Optional[str]) -> Optional[str]:
    if room_id:
        room = session.get(HomeRoom, room_id)
        if not room or room.home_id != home_id:
            raise HTTPException(status_code=422, detail="Room does not belong to this home")
        return room.id
    if room_key:
        floor_key, _, key = room_key.partition("/")
        row = session.exec(
            select(HomeRoom).join(HomeFloor, HomeFloor.id == HomeRoom.floor_id)
            .where(HomeRoom.home_id == home_id, HomeFloor.key == floor_key, HomeRoom.key == key)
        ).first()
        if not row:
            raise HTTPException(status_code=422, detail=f"Unknown room: {room_key}")
        return row.id
    return None


@router.get("/homes/{home_id}/devices")
def list_devices(home_id: str, room_id: Optional[str] = None, source: Optional[str] = None,
                 unassigned: bool = False, user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    get_owned_home(session, home_id, user.id)
    q = select(HomeDevice).where(HomeDevice.home_id == home_id)
    if room_id:
        q = q.where(HomeDevice.room_id == room_id)
    if unassigned:
        q = q.where(HomeDevice.room_id.is_(None))
    if source:
        q = q.where(HomeDevice.source == source)
    return [device_dict(d) for d in session.exec(q.order_by(HomeDevice.name)).all()]


@router.post("/homes/{home_id}/devices", status_code=201)
def add_device(home_id: str, body: DeviceIn, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    get_owned_home(session, home_id, user.id)
    room_id = _resolve_room(session, home_id, body.room_id, body.room_key)
    device = HomeDevice(home_id=home_id, room_id=room_id, **body.model_dump(include=set(DEVICE_FIELDS)))
    session.add(device)
    session.commit()
    session.refresh(device)
    return device_dict(device)


@router.patch("/devices/{device_id}")
def update_device(device_id: str, body: DevicePatch, user: User = Depends(get_current_user),
                  session: Session = Depends(get_session)):
    device = session.get(HomeDevice, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    get_owned_home(session, device.home_id, user.id)
    data = body.model_dump(exclude_unset=True)
    if "room_id" in data:
        data["room_id"] = _resolve_room(session, device.home_id, data["room_id"], None)
    if ("name" in data and data["name"] != device.name) or ("kind" in data and data["kind"] != device.kind):
        data["meta"] = {**(data.get("meta") or device.meta or {}), "edited": True}
    for k, v in data.items():
        setattr(device, k, v)
    device.updated_at = datetime.utcnow()
    session.add(device)
    session.commit()
    return device_dict(device)


@router.delete("/devices/{device_id}", status_code=204)
def delete_device(device_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    device = session.get(HomeDevice, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    get_owned_home(session, device.home_id, user.id)
    session.delete(device)
    session.commit()


@router.put("/homes/{home_id}/devices/import")
def import_devices(home_id: str, body: DeviceImport, request: Request, user: User = Depends(get_current_user),
                   session: Session = Depends(get_session)):
    """Upsert op (source, external_id); verwijdert niets.

    Nieuwe apparaten krijgen meta.review = "new" (melding + vraag om info). Bij een update blijven
    door de gebruiker aangepaste velden (naam, soort, plek, review) staan. Zonder ruimte in de import
    wordt een ruimte gezocht via meta.ha_area tegen de gekoppelde HA-ruimtes.
    """
    home = get_owned_home(session, home_id, user.id)
    if body.ha_areas is not None:
        home.meta = {**(home.meta or {}), "ha_areas": sorted(set(body.ha_areas))}
        session.add(home)
    rooms_by_area = {
        (r.ha_area or "").lower(): r.id
        for r in session.exec(select(HomeRoom).where(HomeRoom.home_id == home_id, HomeRoom.link_status == "linked")).all()
        if r.ha_area
    }
    created, updated, new_names = 0, 0, []
    for item in body.devices:
        if not item.external_id:
            raise HTTPException(status_code=422, detail=f"external_id is required for import ({item.name})")
        room_id = _resolve_room(session, home_id, item.room_id, item.room_key)
        device = session.exec(select(HomeDevice).where(
            HomeDevice.home_id == home_id, HomeDevice.source == item.source,
            HomeDevice.external_id == item.external_id,
        )).first()
        incoming_meta = item.meta or {}
        if device:
            updated += 1
            meta = dict(device.meta or {})
            meta.update({k: v for k, v in incoming_meta.items() if k not in PROTECTED_META})
            device.manufacturer, device.model = item.manufacturer, item.model
            if not meta.get("edited"):
                device.name = item.name   # soort alleen bij aanmaken; daarna van de gebruiker
        else:
            created += 1
            new_names.append(item.name)
            meta = {**incoming_meta, "review": "new"}
            device = HomeDevice(home_id=home_id, **item.model_dump(include=set(DEVICE_FIELDS) - {"meta"}))
        device.meta = meta
        if not room_id and not device.room_id:
            room_id = rooms_by_area.get(str(incoming_meta.get("ha_area") or "").lower())
        if room_id:
            device.room_id = room_id
        device.updated_at = datetime.utcnow()
        session.add(device)
    session.commit()
    log_call(request, "/api/myhome/homes/{id}/devices/import", created + updated)
    return {"created": created, "updated": updated, "new": new_names}


@router.post("/homes/{home_id}/events")
def post_events(home_id: str, body: StateEvents, user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    """Live-status vanuit HA (lamp aan, deur open, beweging). Koppelt via meta.entities van het apparaat;
    de laatste status per entity komt in meta.live. Onbekende entities worden genegeerd."""
    get_owned_home(session, home_id, user.id)
    devices = session.exec(select(HomeDevice).where(HomeDevice.home_id == home_id)).all()
    by_entity = {e: d for d in devices for e in (d.meta or {}).get("entities", [])}
    matched = 0
    for ev in body.events:
        device = by_entity.get(ev.entity_id)
        if not device:
            continue
        meta = dict(device.meta or {})
        live = dict(meta.get("live") or {})
        live[ev.entity_id] = {"state": ev.state, "device_class": ev.device_class, "at": ev.at or datetime.utcnow().isoformat()}
        meta["live"] = live
        device.meta = meta
        session.add(device)
        matched += 1
    session.commit()
    return {"matched": matched}


@router.get("/homes/{home_id}/live")
def get_live(home_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Compact overzicht van de live-status per apparaat, voor polling vanuit het model."""
    get_owned_home(session, home_id, user.id)
    devices = session.exec(select(HomeDevice).where(HomeDevice.home_id == home_id)).all()
    return {d.id: d.meta["live"] for d in devices if (d.meta or {}).get("live")}


@router.get("/v1/homes/{home_id}/devices")
def v1_list_devices(home_id: str, request: Request, room_id: Optional[str] = None, source: Optional[str] = None,
                    unassigned: bool = False, user: User = Depends(get_current_user),
                    session: Session = Depends(get_session)):
    devices = list_devices(home_id, room_id, source, unassigned, user, session)
    log_call(request, "/api/myhome/v1/homes/{id}/devices", len(devices))
    return devices
