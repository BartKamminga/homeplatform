"""Hockey Inside — publicatie CRUD, competitie-koppelingen en tags."""

import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, func

from core.database import get_session
from core.auth import get_current_user, require_admin
from core.crud import get_or_404
from core.logging import log_action
from models.core import User
from models.hockey import (
    HockeyPublication,
    HockeyPublicationComp,
    HockeyPublicationTag,
    HockeyPublicationTagCategory,
    HockeyPublicationCompTag,
)
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch

router = APIRouter(prefix="/api/hockey/publications", tags=["hockey-publications"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PublicationCreate(BaseModel):
    name:        str
    season:      Optional[str] = None
    description: Optional[str] = None

class PublicationUpdate(BaseModel):
    name:        Optional[str]  = None
    season:      Optional[str]  = None
    description: Optional[str]  = None
    status:      Optional[str]  = None
    order:       Optional[int]  = None
    published:   Optional[bool] = None
    info:        Optional[str]  = None

def _normalize_season(s: Optional[str]) -> Optional[str]:
    """"2026 - 2027" en "2026-2027" zijn dezelfde season maar sorteren als
    losse ORDER BY-blokken (item 896: volgorde niet overgenomen op poulebord)
    - spaties rond het streepje wegnemen voorkomt dat."""
    return re.sub(r"\s*-\s*", "-", s.strip()) if s else s


class PublicationsReorder(BaseModel):
    ids: list

class TagsReorder(BaseModel):
    ids: list

class TagCategoryCreate(BaseModel):
    name: str

class TagCategoriesReorder(BaseModel):
    ids: list

class CompLinkCreate(BaseModel):
    competition_id: int
    order:          int = 0
    label:          Optional[str] = None

class CompLinkUpdate(BaseModel):
    label:        Optional[str]  = None
    order:        Optional[int]  = None
    visible:      Optional[bool] = None
    scan_profile: Optional[str]  = None

class TagCreate(BaseModel):
    name:        str
    category_id: Optional[str] = None

class TagUpdate(BaseModel):
    name:        Optional[str] = None
    category_id: Optional[str] = None

class TagAssign(BaseModel):
    tag_id: str


# ── Publicaties ────────────────────────────────────────────────────────────────
# Opgelet: vaste paden (/reorder, /tags) staan VOOR /{pid} om route-conflicten te voorkomen.

@router.get("")
def list_publications(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    # Zelfde sortering als /api/hockey/public/publications (item 745) - anders
    # toont de admin-lijst (voorheen: order, created_at.desc()) een andere
    # volgorde dan poulebord zolang niemand ooit gesleept heeft (order=0 voor
    # iedereen), wat de indruk geeft dat "de volgorde niet wordt overgenomen".
    pubs = session.exec(
        select(HockeyPublication)
        .order_by(HockeyPublication.season.desc(), HockeyPublication.order, HockeyPublication.name)
    ).all()
    result = []
    for p in pubs:
        count = session.exec(
            select(func.count()).select_from(HockeyPublicationComp)
            .where(HockeyPublicationComp.publication_id == p.id)
        ).one()
        d = p.model_dump()
        d["competition_count"] = count
        result.append(d)
    return result


@router.post("", status_code=201)
def create_publication(body: PublicationCreate, session: Session = Depends(get_session), user: User = Depends(require_admin)):
    data = body.model_dump(exclude_none=True)
    if "season" in data:
        data["season"] = _normalize_season(data["season"])
    pub = HockeyPublication(**data, created_by=user.id)
    session.add(pub)
    session.commit()
    session.refresh(pub)
    log_action(session, "hockey.publication.create", user_id=user.id, payload={"name": pub.name})
    return pub


@router.patch("/reorder")
def reorder_publications(body: PublicationsReorder, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    for i, pid in enumerate(body.ids):
        pub = session.get(HockeyPublication, pid)
        if pub:
            pub.order = i
            session.add(pub)
    session.commit()
    return {"ok": True}


# ── Globale publicatie-tags (vóór /{pid} om conflict te voorkomen) ─────────────

def _serialize_tag(tag: HockeyPublicationTag, cats_by_id: dict) -> dict:
    cat = cats_by_id.get(tag.category_id) if tag.category_id else None
    return {
        "id": tag.id, "name": tag.name, "order": tag.order,
        "category_id": tag.category_id,
        "category_name": cat.name if cat else None,
        "category_order": cat.order if cat else None,
    }


@router.get("/tags")
def list_tags(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    cats_by_id = {c.id: c for c in session.exec(select(HockeyPublicationTagCategory)).all()}
    tags = session.exec(select(HockeyPublicationTag).order_by(HockeyPublicationTag.order, HockeyPublicationTag.name)).all()
    return [_serialize_tag(t, cats_by_id) for t in tags]


@router.post("/tags", status_code=201)
def create_tag(body: TagCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Naam is verplicht")
    existing = session.exec(select(HockeyPublicationTag).where(HockeyPublicationTag.name == name)).first()
    if existing:
        return existing
    count = session.exec(select(func.count()).select_from(HockeyPublicationTag)).one()
    tag = HockeyPublicationTag(name=name, order=count, category_id=body.category_id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    cats_by_id = {c.id: c for c in session.exec(select(HockeyPublicationTagCategory)).all()}
    return _serialize_tag(tag, cats_by_id)


@router.patch("/tags/reorder")
def reorder_tags(body: TagsReorder, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    for i, tag_id in enumerate(body.ids):
        tag = session.get(HockeyPublicationTag, tag_id)
        if tag:
            tag.order = i
            session.add(tag)
    session.commit()
    return {"ok": True}


@router.patch("/tags/{tag_id}")
def update_tag(tag_id: str, body: TagUpdate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    """Vooral bedoeld om category_id te (her)toewijzen, incl. terug naar null (item 749)."""
    tag = session.get(HockeyPublicationTag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag niet gevonden")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(tag, k, v)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    cats_by_id = {c.id: c for c in session.exec(select(HockeyPublicationTagCategory)).all()}
    return _serialize_tag(tag, cats_by_id)


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    tag = session.get(HockeyPublicationTag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag niet gevonden")
    session.delete(tag)
    session.commit()


# ── Tag-categorieën (item 749: organisatorische groepering, geen filterlogica) ─

@router.get("/tag-categories")
def list_tag_categories(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(
        select(HockeyPublicationTagCategory).order_by(HockeyPublicationTagCategory.order, HockeyPublicationTagCategory.name)
    ).all()


@router.post("/tag-categories", status_code=201)
def create_tag_category(body: TagCategoryCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Naam is verplicht")
    existing = session.exec(select(HockeyPublicationTagCategory).where(HockeyPublicationTagCategory.name == name)).first()
    if existing:
        return existing
    count = session.exec(select(func.count()).select_from(HockeyPublicationTagCategory)).one()
    cat = HockeyPublicationTagCategory(name=name, order=count)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.patch("/tag-categories/reorder")
def reorder_tag_categories(body: TagCategoriesReorder, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    for i, cat_id in enumerate(body.ids):
        cat = session.get(HockeyPublicationTagCategory, cat_id)
        if cat:
            cat.order = i
            session.add(cat)
    session.commit()
    return {"ok": True}


@router.delete("/tag-categories/{cat_id}", status_code=204)
def delete_tag_category(cat_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    cat = session.get(HockeyPublicationTagCategory, cat_id)
    if not cat:
        raise HTTPException(404, "Categorie niet gevonden")
    # Tags die naar deze categorie wezen vallen terug naar "Overig" i.p.v. een
    # dangling category_id te laten staan.
    for tag in session.exec(select(HockeyPublicationTag).where(HockeyPublicationTag.category_id == cat_id)).all():
        tag.category_id = None
        session.add(tag)
    session.delete(cat)
    session.commit()


# ── Publicatie detail (ná de vaste paden) ────────────────────────────────────

@router.get("/{pid}")
def get_publication(pid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return get_or_404(session, HockeyPublication, pid, "Publicatie")


@router.patch("/{pid}")
def update_publication(pid: str, body: PublicationUpdate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    pub = get_or_404(session, HockeyPublication, pid, "Publicatie")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(pub, k, _normalize_season(v) if k == "season" else v)
    session.add(pub)
    session.commit()
    session.refresh(pub)
    return pub


@router.delete("/{pid}", status_code=204)
def delete_publication(pid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    pub = get_or_404(session, HockeyPublication, pid, "Publicatie")
    for lnk in session.exec(select(HockeyPublicationComp).where(HockeyPublicationComp.publication_id == pid)).all():
        for ct in session.exec(select(HockeyPublicationCompTag).where(HockeyPublicationCompTag.comp_link_id == lnk.id)).all():
            session.delete(ct)
        session.delete(lnk)
    session.delete(pub)
    session.commit()


# ── Competitie-koppelingen ────────────────────────────────────────────────────

@router.get("/{pid}/competitions")
def list_publication_competitions(pid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    get_or_404(session, HockeyPublication, pid, "Publicatie")
    links = session.exec(
        select(HockeyPublicationComp)
        .where(HockeyPublicationComp.publication_id == pid)
        .order_by(HockeyPublicationComp.order)
    ).all()
    result = []
    for lnk in links:
        comp = session.get(HockeyCompetition, lnk.competition_id)
        poules = session.exec(
            select(HockeyPoule).where(HockeyPoule.competition_id == lnk.competition_id).order_by(HockeyPoule.name)
        ).all()
        assigned_tags = session.exec(
            select(HockeyPublicationCompTag, HockeyPublicationTag)
            .join(HockeyPublicationTag, HockeyPublicationCompTag.tag_id == HockeyPublicationTag.id)
            .where(HockeyPublicationCompTag.comp_link_id == lnk.id)
            .order_by(HockeyPublicationTag.order, HockeyPublicationTag.name)
        ).all()

        poule_list = []
        for p in poules:
            total  = session.exec(select(func.count()).select_from(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == p.id)).one()
            # item 5-09-2026 (live-score-fix): home_score is niet meer alleen
            # bij status='final' gevuld (kan nu ook een lopende wedstrijd
            # zijn) - "gespeeld" moet dus op status filteren, niet op de
            # aan/afwezigheid van een score.
            played = session.exec(select(func.count()).select_from(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == p.id).where(HockeyPouleMatch.status == "final")).one()
            poule_list.append({"id": p.id, "name": p.name, "poule_id": p.poule_id, "matches_total": total, "matches_played": played})

        result.append({
            "id":             lnk.id,
            "publication_id": lnk.publication_id,
            "competition_id": lnk.competition_id,
            "order":          lnk.order,
            "label":          lnk.label,
            "visible":        lnk.visible,
            "scan_profile":   lnk.scan_profile,
            "fase_tags":      [{"id": t.id, "name": t.name} for _, t in assigned_tags],
            "competition": {
                "id":          comp.id,
                "name":        comp.name,
                "class_name":  comp.class_name,
                "district":    comp.district,
                "hockey_type": comp.hockey_type,
                "season":      comp.season,
            } if comp else None,
            "poules": poule_list,
        })
    return result


@router.post("/{pid}/competitions", status_code=201)
def add_publication_competition(pid: str, body: CompLinkCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    get_or_404(session, HockeyPublication, pid, "Publicatie")
    comp = session.get(HockeyCompetition, body.competition_id)
    if not comp:
        raise HTTPException(404, "Competitie niet gevonden")
    existing = session.exec(
        select(HockeyPublicationComp)
        .where(HockeyPublicationComp.publication_id == pid)
        .where(HockeyPublicationComp.competition_id == body.competition_id)
    ).first()
    if existing:
        raise HTTPException(409, "Competitie al gekoppeld aan deze publicatie")
    lnk = HockeyPublicationComp(publication_id=pid, competition_id=body.competition_id, order=body.order, label=body.label)
    session.add(lnk)
    session.commit()
    session.refresh(lnk)

    # Auto-tags op basis van class_name en district
    for tag_name in [v for v in [comp.class_name, comp.district] if v and v.strip()]:
        tag = session.exec(select(HockeyPublicationTag).where(HockeyPublicationTag.name == tag_name)).first()
        if not tag:
            count = session.exec(select(func.count()).select_from(HockeyPublicationTag)).one()
            tag = HockeyPublicationTag(name=tag_name, order=count)
            session.add(tag)
            session.flush()
        if not session.exec(
            select(HockeyPublicationCompTag)
            .where(HockeyPublicationCompTag.comp_link_id == lnk.id)
            .where(HockeyPublicationCompTag.tag_id == tag.id)
        ).first():
            session.add(HockeyPublicationCompTag(comp_link_id=lnk.id, tag_id=tag.id))
    session.commit()
    return lnk


@router.patch("/{pid}/competitions/{link_id}")
def update_publication_competition(pid: str, link_id: str, body: CompLinkUpdate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    lnk = session.get(HockeyPublicationComp, link_id)
    if not lnk or lnk.publication_id != pid:
        raise HTTPException(404, "Koppeling niet gevonden")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(lnk, k, v)
    session.add(lnk)
    session.commit()
    session.refresh(lnk)
    return lnk


@router.delete("/{pid}/competitions/{link_id}", status_code=204)
def remove_publication_competition(pid: str, link_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    lnk = session.get(HockeyPublicationComp, link_id)
    if not lnk or lnk.publication_id != pid:
        raise HTTPException(404, "Koppeling niet gevonden")
    for ct in session.exec(select(HockeyPublicationCompTag).where(HockeyPublicationCompTag.comp_link_id == link_id)).all():
        session.delete(ct)
    session.delete(lnk)
    session.commit()


@router.post("/{pid}/competitions/{link_id}/tags", status_code=201)
def assign_comp_tag(pid: str, link_id: str, body: TagAssign, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    lnk = session.get(HockeyPublicationComp, link_id)
    if not lnk or lnk.publication_id != pid:
        raise HTTPException(404, "Koppeling niet gevonden")
    tag = session.get(HockeyPublicationTag, body.tag_id)
    if not tag:
        raise HTTPException(404, "Tag niet gevonden")
    existing = session.exec(
        select(HockeyPublicationCompTag)
        .where(HockeyPublicationCompTag.comp_link_id == link_id)
        .where(HockeyPublicationCompTag.tag_id == body.tag_id)
    ).first()
    if existing:
        return {"id": existing.id, "tag_id": tag.id, "name": tag.name}
    ct = HockeyPublicationCompTag(comp_link_id=link_id, tag_id=body.tag_id)
    session.add(ct)
    session.commit()
    session.refresh(ct)
    return {"id": ct.id, "tag_id": tag.id, "name": tag.name}


@router.delete("/{pid}/competitions/{link_id}/tags/{tag_id}", status_code=204)
def remove_comp_tag(pid: str, link_id: str, tag_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    lnk = session.get(HockeyPublicationComp, link_id)
    if not lnk or lnk.publication_id != pid:
        raise HTTPException(404, "Koppeling niet gevonden")
    ct = session.exec(
        select(HockeyPublicationCompTag)
        .where(HockeyPublicationCompTag.comp_link_id == link_id)
        .where(HockeyPublicationCompTag.tag_id == tag_id)
    ).first()
    if ct:
        session.delete(ct)
        session.commit()
