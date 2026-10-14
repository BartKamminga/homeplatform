"""MyHome push - wijzigingen uit het model terug naar Home Assistant en via HA naar Hue (item 1320).

MyHome kan HA niet bereiken (VLAN); daarom zet MyHome goedgekeurde wijzigingen in een wachtrij en haalt de
applier in HA (tools/myhome/ha/myhome_apply.py) ze op, voert ze uit en meldt het resultaat terug.

Soorten:
- rename_device: naam van een apparaat. Hue-apparaten worden op de bridge hernoemd (dan klopt ook de Hue-app),
  overige via name_by_user in de HA-device-registry.
- move_device:   apparaat naar een andere HA-ruimte (area_id in de device-registry; ruimte wordt aangemaakt als
  die nog niet bestaat).
- rename_area:   HA-ruimte krijgt de naam van de MyHome-ruimte.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.myhome import HomeDevice, HomePushJob, HomeRoom
from services.myhome import get_owned_home

router = APIRouter(prefix="/api/myhome", tags=["myhome"])

KINDS = {"rename_device", "move_device", "rename_area"}
# Apparaten waarvan de naam niet vanuit HA te wijzigen is (komen via HomeKit binnen).
UNSUPPORTED_RENAME = {"tado"}


class Change(BaseModel):
    kind: str
    target: str
    payload: dict


class PushIn(BaseModel):
    changes: list[Change]


class ResultIn(BaseModel):
    status: str           # applied | failed
    result: Optional[str] = None


def _job_dict(j: HomePushJob) -> dict:
    return {"id": j.id, "kind": j.kind, "target": j.target, "payload": j.payload, "status": j.status,
            "result": j.result, "created_at": j.created_at.isoformat(),
            "applied_at": j.applied_at.isoformat() if j.applied_at else None}


def compute_changes(session: Session, home_id: str) -> list[dict]:
    """Verschillen tussen het MyHome-model en wat HA bij de laatste sync meldde."""
    rooms = {r.id: r for r in session.exec(select(HomeRoom).where(HomeRoom.home_id == home_id)).all()}
    devices = session.exec(select(HomeDevice).where(HomeDevice.home_id == home_id)).all()
    pending = {(j.kind, j.target) for j in session.exec(
        select(HomePushJob).where(HomePushJob.home_id == home_id, HomePushJob.status == "pending")).all()}
    out = []

    def add(kind, target, payload, label, supported=True):
        out.append({"kind": kind, "target": target, "payload": payload, "label": label,
                    "supported": supported, "queued": (kind, target) in pending})

    for d in devices:
        meta = d.meta or {}
        ha_id = meta.get("ha_device_id")
        if d.source not in ("hue", "home_assistant") or not ha_id or meta.get("review") == "ignored":
            continue
        ha_name = meta.get("ha_name")
        if ha_name and d.name != ha_name:
            supported = (d.manufacturer or "").lower() not in UNSUPPORTED_RENAME
            add("rename_device", ha_id, {
                "ha_device_id": ha_id, "hue_device_id": d.external_id if d.source == "hue" else None,
                "device_id": d.id, "from": ha_name, "to": d.name,
            }, f"Rename “{ha_name}” to “{d.name}”", supported)
        room = rooms.get(d.room_id)
        if room and room.ha_area and room.link_status == "linked" and meta.get("ha_area") != room.ha_area:
            add("move_device", ha_id, {
                "ha_device_id": ha_id, "device_id": d.id, "from": meta.get("ha_area"), "to": room.ha_area,
            }, f"Move “{d.name}” from {meta.get('ha_area') or 'no area'} to {room.ha_area}")

    seen = set()
    for r in rooms.values():
        if r.link_status == "linked" and r.ha_area and r.ha_area != r.name and r.ha_area not in seen:
            seen.add(r.ha_area)
            add("rename_area", r.ha_area, {"from": r.ha_area, "to": r.name, "room_id": r.id},
                f"Rename HA area “{r.ha_area}” to “{r.name}”")
    return out


@router.get("/homes/{home_id}/changes")
def list_changes(home_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    get_owned_home(session, home_id, user.id)
    return compute_changes(session, home_id)


@router.post("/homes/{home_id}/push", status_code=201)
def push_changes(home_id: str, body: PushIn, user: User = Depends(get_current_user),
                 session: Session = Depends(get_session)):
    get_owned_home(session, home_id, user.id)
    queued = 0
    for c in body.changes:
        if c.kind not in KINDS:
            raise HTTPException(status_code=422, detail=f"Unknown change: {c.kind}")
        exists = session.exec(select(HomePushJob).where(
            HomePushJob.home_id == home_id, HomePushJob.kind == c.kind,
            HomePushJob.target == c.target, HomePushJob.status == "pending")).first()
        if exists:
            exists.payload = c.payload      # laatste keuze wint
            session.add(exists)
        else:
            session.add(HomePushJob(home_id=home_id, kind=c.kind, target=c.target, payload=c.payload))
            queued += 1
    session.commit()
    return {"queued": queued}


class KeepIn(BaseModel):
    kind: str
    target: str


@router.post("/homes/{home_id}/changes/keep-ha")
def keep_ha(home_id: str, body: KeepIn, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Andersom: MyHome neemt de versie van HA over, het voorstel vervalt (ook een nog wachtende push)."""
    get_owned_home(session, home_id, user.id)
    if body.kind == "rename_area":
        rooms = session.exec(select(HomeRoom).where(HomeRoom.home_id == home_id, HomeRoom.ha_area == body.target)).all()
        if not rooms:
            raise HTTPException(status_code=404, detail="Room not found")
        for r in rooms:
            r.name = body.target
            session.add(r)
    elif body.kind in ("rename_device", "move_device"):
        device = next((d for d in session.exec(select(HomeDevice).where(HomeDevice.home_id == home_id)).all()
                       if (d.meta or {}).get("ha_device_id") == body.target), None)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        meta = device.meta or {}
        if body.kind == "rename_device":
            device.name = meta.get("ha_name") or device.name
            device.meta = {**meta, "edited": False}     # volgende syncs houden de naam weer gelijk aan HA
        else:
            room = session.exec(select(HomeRoom).where(
                HomeRoom.home_id == home_id, HomeRoom.link_status == "linked",
                HomeRoom.ha_area == meta.get("ha_area"))).first()
            if not room:
                raise HTTPException(status_code=422, detail=f"No room in MyHome is linked to HA area {meta.get('ha_area')}")
            device.room_id = room.id
        device.updated_at = datetime.utcnow()
        session.add(device)
    else:
        raise HTTPException(status_code=422, detail=f"Unknown change: {body.kind}")
    for j in session.exec(select(HomePushJob).where(
            HomePushJob.home_id == home_id, HomePushJob.kind == body.kind,
            HomePushJob.target == body.target, HomePushJob.status == "pending")).all():
        j.status, j.result, j.applied_at = "cancelled", "kept the Home Assistant version", datetime.utcnow()
        session.add(j)
    session.commit()
    return compute_changes(session, home_id)


@router.get("/homes/{home_id}/push")
def list_jobs(home_id: str, status: Optional[str] = None, user: User = Depends(get_current_user),
              session: Session = Depends(get_session)):
    """Voor de applier (status=pending) en voor de historie in de UI."""
    get_owned_home(session, home_id, user.id)
    q = select(HomePushJob).where(HomePushJob.home_id == home_id)
    if status:
        q = q.where(HomePushJob.status == status)
    return [_job_dict(j) for j in session.exec(q.order_by(HomePushJob.created_at.desc()).limit(200)).all()]


@router.post("/push/{job_id}/result")
def report_result(job_id: str, body: ResultIn, user: User = Depends(get_current_user),
                  session: Session = Depends(get_session)):
    job = session.get(HomePushJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    get_owned_home(session, job.home_id, user.id)
    if body.status not in ("applied", "failed"):
        raise HTTPException(status_code=422, detail="Status must be applied or failed")
    job.status, job.result, job.applied_at = body.status, body.result, datetime.utcnow()
    if body.status == "applied":
        _mirror_applied(session, job)
    session.add(job)
    session.commit()
    return _job_dict(job)


def _mirror_applied(session: Session, job: HomePushJob) -> None:
    """Na een geslaagde push weet MyHome direct dat HA bijgewerkt is (zonder op de volgende sync te wachten)."""
    p = job.payload or {}
    if job.kind in ("rename_device", "move_device"):
        device = session.get(HomeDevice, p.get("device_id"))
        if device:
            key = "ha_name" if job.kind == "rename_device" else "ha_area"
            device.meta = {**(device.meta or {}), key: p.get("to")}
            session.add(device)
    elif job.kind == "rename_area":
        for r in session.exec(select(HomeRoom).where(HomeRoom.home_id == job.home_id, HomeRoom.ha_area == p.get("from"))).all():
            r.ha_area = p.get("to")
            session.add(r)
        for d in session.exec(select(HomeDevice).where(HomeDevice.home_id == job.home_id)).all():
            if (d.meta or {}).get("ha_area") == p.get("from"):
                d.meta = {**d.meta, "ha_area": p.get("to")}
                session.add(d)
