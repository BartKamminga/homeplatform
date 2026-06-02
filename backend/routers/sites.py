from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from core.database import get_session
from core.auth import require_admin
from core.logging import log_action
from models.core import User, Site, SiteAccess, Group

router = APIRouter(prefix="/api/admin/sites", tags=["admin - sites"])


class SiteOut(BaseModel):
    id: str
    name: str
    slug: str
    module: str
    theme_id: Optional[str]
    is_active: bool
    allowed_groups: list[str]


class SiteCreate(BaseModel):
    name: str
    slug: str
    module: str
    theme_id: Optional[str] = None


def _enrich(site: Site, session: Session) -> SiteOut:
    groups = session.exec(
        select(Group)
        .join(SiteAccess, SiteAccess.group_id == Group.id)
        .where(SiteAccess.site_id == site.id)
    ).all()
    return SiteOut(
        id=site.id,
        name=site.name,
        slug=site.slug,
        module=site.module,
        theme_id=site.theme_id,
        is_active=site.is_active,
        allowed_groups=[g.slug for g in groups],
    )


@router.get("/", response_model=list[SiteOut])
def list_sites(
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    return [_enrich(s, session) for s in session.exec(select(Site)).all()]


@router.post("/", response_model=SiteOut, status_code=201)
def create_site(
    data: SiteCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    existing = session.exec(select(Site).where(Site.slug == data.slug)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Site slug al in gebruik")

    site = Site(name=data.name, slug=data.slug,
                module=data.module, theme_id=data.theme_id)
    session.add(site)
    session.commit()
    session.refresh(site)
    log_action(session, "site.create", user_id=admin.id,
               payload={"site": data.slug})
    return _enrich(site, session)


@router.patch("/{site_id}/toggle")
def toggle_site(
    site_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site niet gevonden")

    site.is_active = not site.is_active
    session.add(site)
    session.commit()
    log_action(session, "site.toggle", user_id=admin.id,
               payload={"site": site.slug, "is_active": site.is_active})
    status = "geactiveerd" if site.is_active else "gedeactiveerd"
    return {"message": f"Site '{site.name}' {status}"}


@router.post("/{site_id}/access/{group_slug}")
def grant_access(
    site_id: str,
    group_slug: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    site = session.get(Site, site_id)
    group = session.exec(select(Group).where(Group.slug == group_slug)).first()
    if not site or not group:
        raise HTTPException(status_code=404, detail="Site of groep niet gevonden")

    existing = session.exec(
        select(SiteAccess)
        .where(SiteAccess.site_id == site_id)
        .where(SiteAccess.group_id == group.id)
    ).first()
    if not existing:
        session.add(SiteAccess(site_id=site_id, group_id=group.id))
        session.commit()
        log_action(session, "site.access.grant", user_id=admin.id,
                   payload={"site": site.slug, "group": group_slug})
    return {"message": f"Toegang verleend aan {group_slug} voor {site.slug}"}


@router.delete("/{site_id}/access/{group_slug}")
def revoke_access(
    site_id: str,
    group_slug: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    site = session.get(Site, site_id)
    group = session.exec(select(Group).where(Group.slug == group_slug)).first()
    if not site or not group:
        raise HTTPException(status_code=404, detail="Site of groep niet gevonden")

    link = session.exec(
        select(SiteAccess)
        .where(SiteAccess.site_id == site_id)
        .where(SiteAccess.group_id == group.id)
    ).first()
    if link:
        session.delete(link)
        session.commit()
        log_action(session, "site.access.revoke", user_id=admin.id,
                   payload={"site": site.slug, "group": group_slug})
    return {"message": f"Toegang ingetrokken voor {group_slug} op {site.slug}"}
