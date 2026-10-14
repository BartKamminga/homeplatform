"""Keelson services: seeding from HomePlatform, live figures and exports (item 1340)."""
from collections import Counter
from datetime import datetime

from fastapi import HTTPException
from sqlmodel import Session, select

from models.changelog import ChangelogEntry
from core.auth import ADMIN_GROUP
from models.core import Group, RoadmapItem, Site, SiteAccess
from models.keelson import KeelsonCheck, KeelsonElement, KeelsonLink, KeelsonSystem
from services.keelson_catalog import KIND_BY_KEY, check_templates
from services.keelson_seed_data import (
    PLATFORM_DONE_CHECKS, PLATFORM_ELEMENTS, PLATFORM_LINKS, PRODUCT_DONE_CHECKS, SYSTEMS,
)

ELEMENT_STATUSES = ("present", "partial", "missing")
SYSTEM_KINDS = ("platform", "product", "tool")
SYSTEM_STATUSES = ("active", "planned", "archived")


def get_system(session: Session, system_id: str) -> KeelsonSystem:
    system = session.get(KeelsonSystem, system_id)
    if not system:
        raise HTTPException(status_code=404, detail="System not found")
    return system


def ensure_checks(session: Session, system: KeelsonSystem, done_keys=()) -> None:
    """Adds missing checklist lines from the catalog; never touches existing ones."""
    existing = {c.key for c in session.exec(select(KeelsonCheck).where(KeelsonCheck.system_id == system.id))}
    for t in check_templates():
        if t["key"] in existing:
            continue
        done = t["key"] in done_keys
        session.add(KeelsonCheck(system_id=system.id, done=done, done_at=datetime.utcnow() if done else None, **t))


def _upsert_element(session, system_id, key, kind, name, status, description, attributes, cache):
    found = cache.get(key)
    if found:
        return found
    el = KeelsonElement(system_id=system_id, key=key, kind=kind, name=name, status=status,
                        description=description, attributes=attributes, source="seed")
    session.add(el)
    session.flush()
    cache[key] = el
    return el


def _add_link(session, from_el, to_el, verb, existing):
    sig = (from_el.id, to_el.id, verb)
    if sig not in existing:
        session.add(KeelsonLink(from_id=from_el.id, to_id=to_el.id, verb=verb, source="seed"))
        existing.add(sig)


def restrict_site_to_admins(session: Session) -> None:
    """The Keelson API is admin only, so the site is too - unless access was already configured."""
    site = session.exec(select(Site).where(Site.slug == "keelson")).first()
    admins = session.exec(select(Group).where(Group.slug == ADMIN_GROUP)).first()
    if site and admins and not session.exec(select(SiteAccess).where(SiteAccess.site_id == site.id)).first():
        session.add(SiteAccess(site_id=site.id, group_id=admins.id))


def seed_keelson(session: Session) -> None:
    """Idempotent: creates what is missing and leaves anything edited in the app alone."""
    restrict_site_to_admins(session)
    systems = {s.key: s for s in session.exec(select(KeelsonSystem))}
    for key, name, kind, status, description, meta in SYSTEMS:
        if key not in systems:
            systems[key] = KeelsonSystem(key=key, name=name, kind=kind, status=status, description=description,
                                         owner="Bart", meta=meta, seeded=True)
            session.add(systems[key])
    session.flush()

    links = {(l.from_id, l.to_id, l.verb) for l in session.exec(select(KeelsonLink))}
    platform = systems["platform"]
    cache = {e.key: e for e in session.exec(select(KeelsonElement).where(KeelsonElement.system_id == platform.id))}
    for key, kind, name, status, description, attributes in PLATFORM_ELEMENTS:
        _upsert_element(session, platform.id, key, kind, name, status, description, attributes, cache)
    for a, b, verb in PLATFORM_LINKS:
        _add_link(session, cache[a], cache[b], verb, links)
    ensure_checks(session, platform, PLATFORM_DONE_CHECKS)

    # Every product gets its product element and frontend, tied to the shared platform pieces
    for key, name, kind, _status, description, meta in SYSTEMS:
        if key == "platform":
            continue
        system = systems[key]
        own = {e.key: e for e in session.exec(select(KeelsonElement).where(KeelsonElement.system_id == system.id))}
        product = _upsert_element(session, system.id, "product", "Product", name, "present", description, meta, own)
        _add_link(session, product, cache["product"], "is part of", links)
        if "path" in (meta or {}):
            site = _upsert_element(session, system.id, "frontend", "Component", f"{name} frontend", "present",
                                   f"Site folder under frontend/sites, served at {meta['path']}.", {"path": meta["path"]}, own)
            _add_link(session, site, cache["svc-caddy"], "runs as", links)
            _add_link(session, cache["roadmap"], product, "falls under", links)
        ensure_checks(session, system, PRODUCT_DONE_CHECKS)
    session.commit()


def live_figures(session: Session, system: KeelsonSystem) -> dict:
    """Read-only figures from the roadmap and changelog of HomePlatform itself."""
    meta = system.meta or {}
    roadmap_sites = meta.get("roadmap_sites") or [system.key]
    changelog_sites = meta.get("changelog_sites") or [system.key]
    statuses = session.exec(select(RoadmapItem.status).where(RoadmapItem.site.in_(roadmap_sites))).all()
    by_status = Counter(statuses)
    releases = session.exec(select(ChangelogEntry).where(ChangelogEntry.site.in_(changelog_sites))
                            .order_by(ChangelogEntry.released_at.desc()).limit(5)).all()
    return {
        "roadmap": {"total": len(statuses), "open": len(statuses) - by_status.get("done", 0), "by_status": dict(by_status)},
        "releases": [{"version": r.version, "title": r.title, "released_at": r.released_at.isoformat()} for r in releases],
    }


def export_element(e: KeelsonElement) -> dict:
    kind = KIND_BY_KEY.get(e.kind)
    return {"id": e.id, "system_id": e.system_id, "key": e.key, "kind": e.kind,
            "dimension": kind["dimension"] if kind else None, "name": e.name, "status": e.status,
            "description": e.description, "attributes": e.attributes or {}, "source": e.source,
            "updated_at": e.updated_at.isoformat()}


def export_system_summary(system: KeelsonSystem, elements, checks) -> dict:
    present = Counter(KIND_BY_KEY[e.kind]["dimension"] for e in elements if e.kind in KIND_BY_KEY)
    done = sum(1 for c in checks if c.done)
    return {"id": system.id, "key": system.key, "name": system.name, "kind": system.kind, "status": system.status,
            "description": system.description, "owner": system.owner, "meta": system.meta or {},
            "element_count": len(elements), "elements_per_dimension": dict(present),
            "checks_done": done, "checks_total": len(checks)}


def export_system(session: Session, system: KeelsonSystem) -> dict:
    elements = session.exec(select(KeelsonElement).where(KeelsonElement.system_id == system.id)
                            .order_by(KeelsonElement.kind, KeelsonElement.name)).all()
    checks = session.exec(select(KeelsonCheck).where(KeelsonCheck.system_id == system.id)
                          .order_by(KeelsonCheck.sort)).all()
    ids = [e.id for e in elements]
    links = session.exec(select(KeelsonLink).where(KeelsonLink.from_id.in_(ids) | KeelsonLink.to_id.in_(ids))).all() if ids else []
    # Elements of other systems on the far side of a link (shared platform pieces)
    far_ids = {l.from_id for l in links} | {l.to_id for l in links}
    far = session.exec(select(KeelsonElement).where(KeelsonElement.id.in_(far_ids - set(ids)))).all() if far_ids else []
    return {
        **export_system_summary(system, elements, checks),
        "elements": [export_element(e) for e in elements],
        "linked_elements": [export_element(e) for e in far],
        "links": [{"id": l.id, "from_id": l.from_id, "to_id": l.to_id, "verb": l.verb} for l in links],
        "checks": [{"id": c.id, "key": c.key, "dimension": c.dimension, "phase": c.phase, "title": c.title,
                    "done": c.done, "done_at": c.done_at.isoformat() if c.done_at else None, "notes": c.notes}
                   for c in checks],
        "live": live_figures(session, system),
    }


def validate_kind(kind: str) -> None:
    if kind not in KIND_BY_KEY:
        raise HTTPException(status_code=422, detail=f"Unknown element kind: {kind}")
