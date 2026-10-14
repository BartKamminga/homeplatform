"""Keelson router - systems, elements, links and checklists (item 1340).

Admin only: Keelson describes the platform itself, including servers, access and finance.
"""
from datetime import datetime
from typing import Optional
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import require_admin
from core.database import get_session
from models.core import User
from models.keelson import KeelsonCheck, KeelsonElement, KeelsonLink, KeelsonSystem
from services.keelson import (
    ELEMENT_STATUSES, SYSTEM_KINDS, SYSTEM_STATUSES, ensure_checks, export_element, export_system,
    export_system_summary, get_system, validate_kind,
)
from services.keelson_catalog import catalog

router = APIRouter(prefix="/api/keelson", tags=["keelson"])


class SystemIn(BaseModel):
    name: str
    key: Optional[str] = None
    kind: str = "product"
    status: str = "active"
    description: Optional[str] = None
    owner: Optional[str] = None


class SystemPatch(BaseModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None


class ElementIn(BaseModel):
    kind: str
    name: str
    status: str = "present"
    description: Optional[str] = None
    attributes: Optional[dict] = None


class ElementPatch(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    attributes: Optional[dict] = None


class LinkIn(BaseModel):
    from_id: str
    to_id: str
    verb: str


class CheckPatch(BaseModel):
    done: Optional[bool] = None
    notes: Optional[str] = None


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"


def _check_choice(value, allowed, label):
    if value is not None and value not in allowed:
        raise HTTPException(status_code=422, detail=f"{label} must be one of: {', '.join(allowed)}")


@router.get("/catalog")
def get_catalog(_: User = Depends(require_admin)):
    return catalog()


@router.get("/systems")
def list_systems(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    systems = session.exec(select(KeelsonSystem).order_by(KeelsonSystem.name)).all()
    elements = session.exec(select(KeelsonElement)).all()
    checks = session.exec(select(KeelsonCheck)).all()
    out = []
    for s in systems:
        out.append(export_system_summary(s, [e for e in elements if e.system_id == s.id],
                                         [c for c in checks if c.system_id == s.id]))
    order = {"platform": 0, "product": 1, "tool": 2}
    return sorted(out, key=lambda s: (order.get(s["kind"], 9), s["status"] == "archived", s["name"].lower()))


@router.post("/systems", status_code=201)
def create_system(body: SystemIn, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    _check_choice(body.kind, SYSTEM_KINDS, "kind")
    _check_choice(body.status, SYSTEM_STATUSES, "status")
    key = _slug(body.key or body.name)
    if session.exec(select(KeelsonSystem).where(KeelsonSystem.key == key)).first():
        raise HTTPException(status_code=409, detail=f"A system with key '{key}' already exists")
    system = KeelsonSystem(key=key, **body.model_dump(exclude={"key"}))
    session.add(system)
    session.flush()
    ensure_checks(session, system)
    session.add(KeelsonElement(system_id=system.id, key="product", kind="Product", name=system.name,
                               description=system.description))
    session.commit()
    return export_system(session, system)


@router.get("/systems/{system_id}")
def read_system(system_id: str, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    return export_system(session, get_system(session, system_id))


@router.patch("/systems/{system_id}")
def update_system(system_id: str, body: SystemPatch, _: User = Depends(require_admin),
                  session: Session = Depends(get_session)):
    system = get_system(session, system_id)
    _check_choice(body.kind, SYSTEM_KINDS, "kind")
    _check_choice(body.status, SYSTEM_STATUSES, "status")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(system, k, v)
    system.updated_at = datetime.utcnow()
    session.add(system)
    session.commit()
    return export_system(session, system)


@router.post("/systems/{system_id}/elements", status_code=201)
def create_element(system_id: str, body: ElementIn, _: User = Depends(require_admin),
                   session: Session = Depends(get_session)):
    system = get_system(session, system_id)
    validate_kind(body.kind)
    _check_choice(body.status, ELEMENT_STATUSES, "status")
    el = KeelsonElement(system_id=system.id, key=f"{_slug(body.name)}-{uuid.uuid4().hex[:6]}", **body.model_dump())
    session.add(el)
    session.commit()
    session.refresh(el)
    return export_element(el)


@router.patch("/elements/{element_id}")
def update_element(element_id: str, body: ElementPatch, _: User = Depends(require_admin),
                   session: Session = Depends(get_session)):
    el = session.get(KeelsonElement, element_id)
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    _check_choice(body.status, ELEMENT_STATUSES, "status")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(el, k, v)
    el.updated_at = datetime.utcnow()
    session.add(el)
    session.commit()
    session.refresh(el)
    return export_element(el)


@router.delete("/elements/{element_id}", status_code=204)
def delete_element(element_id: str, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    el = session.get(KeelsonElement, element_id)
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    for link in session.exec(select(KeelsonLink).where((KeelsonLink.from_id == el.id) | (KeelsonLink.to_id == el.id))):
        session.delete(link)
    session.delete(el)
    session.commit()


@router.post("/links", status_code=201)
def create_link(body: LinkIn, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    if body.from_id == body.to_id:
        raise HTTPException(status_code=422, detail="An element cannot link to itself")
    for el_id in (body.from_id, body.to_id):
        if not session.get(KeelsonElement, el_id):
            raise HTTPException(status_code=404, detail="Element not found")
    verb = body.verb.strip()
    if not verb:
        raise HTTPException(status_code=422, detail="Describe the link with a verb, e.g. 'runs on'")
    existing = session.exec(select(KeelsonLink).where(KeelsonLink.from_id == body.from_id,
                                                      KeelsonLink.to_id == body.to_id, KeelsonLink.verb == verb)).first()
    if existing:
        raise HTTPException(status_code=409, detail="This link already exists")
    link = KeelsonLink(from_id=body.from_id, to_id=body.to_id, verb=verb)
    session.add(link)
    session.commit()
    return {"id": link.id, "from_id": link.from_id, "to_id": link.to_id, "verb": link.verb}


@router.delete("/links/{link_id}", status_code=204)
def delete_link(link_id: str, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    link = session.get(KeelsonLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    session.delete(link)
    session.commit()


@router.patch("/checks/{check_id}")
def update_check(check_id: str, body: CheckPatch, _: User = Depends(require_admin),
                 session: Session = Depends(get_session)):
    check = session.get(KeelsonCheck, check_id)
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")
    if body.done is not None and body.done != check.done:
        check.done = body.done
        check.done_at = datetime.utcnow() if body.done else None
    if body.notes is not None:
        check.notes = body.notes or None
    session.add(check)
    session.commit()
    return {"id": check.id, "done": check.done, "done_at": check.done_at.isoformat() if check.done_at else None,
            "notes": check.notes}


@router.get("/graph")
def graph(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    """Every element and link across systems, for the 3D map."""
    systems = {s.id: s for s in session.exec(select(KeelsonSystem))}
    elements = session.exec(select(KeelsonElement)).all()
    links = session.exec(select(KeelsonLink)).all()
    return {
        "systems": [{"id": s.id, "key": s.key, "name": s.name, "kind": s.kind, "status": s.status} for s in systems.values()],
        "elements": [export_element(e) for e in elements],
        "links": [{"id": l.id, "from_id": l.from_id, "to_id": l.to_id, "verb": l.verb} for l in links],
    }
