"""Oefenwedstrijden & bijzondere dagen (YearOfCustomEntry) CRUD/archive/
restore, de samengevoegde tijdlijn (competitie via hockey-inside/Poulebord +
de handmatige custom entries) en de pouletabel. Zie __init__.py voor hoe dit
sub-router samengevoegd wordt onder /api/yearof-mo14."""

import shutil
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.hockey_discovery import HockeyPoule
from models.yearof import (
    YearOfContributorLink,
    YearOfCustomEntry,
    YearOfMatchGoal,
    YearOfMatchPhotoBlock,
    YearOfPhoto,
    YearOfPhotoPlayerTag,
    YearOfReport,
    YearOfReportLink,
    YearOfReportPlayerTag,
)
from routers.hockey_public import _serialize_poule_matches, get_hockey_poule_standings

from ._shared import POULE_ID, TEAM_NAME, require_team_access
from .photos import PHOTO_ROOT

router = APIRouter(tags=["yearof-mo14"])


# ---------------------------------------------------------------------------
# Oefenwedstrijden & bijzondere dagen (YearOfCustomEntry)
# ---------------------------------------------------------------------------

class CustomEntryIn(BaseModel):
    kind: str = "oefen"  # "oefen" | "bijzonder"
    title: str
    date: str  # ISO datum/datetime-string
    opponent: Optional[str] = None
    is_home: Optional[bool] = None
    score_us: Optional[int] = None
    score_them: Optional[int] = None
    location: Optional[str] = None
    description: Optional[str] = None
    is_pinned: bool = False


class CustomEntryUpdate(BaseModel):
    kind: Optional[str] = None
    title: Optional[str] = None
    date: Optional[str] = None
    opponent: Optional[str] = None
    is_home: Optional[bool] = None
    score_us: Optional[int] = None
    score_them: Optional[int] = None
    location: Optional[str] = None
    description: Optional[str] = None
    is_pinned: Optional[bool] = None


@router.get("/entries")
def list_entries(kind: Optional[str] = None, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    q = select(YearOfCustomEntry)
    if kind:
        q = q.where(YearOfCustomEntry.kind == kind)
    return session.exec(q.order_by(YearOfCustomEntry.date)).all()


@router.post("/entries")
def create_entry(
    body: CustomEntryIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    entry = YearOfCustomEntry(**body.model_dump())
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.patch("/entries/{entry_id}")
def update_entry(
    entry_id: str,
    body: CustomEntryUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.post("/entries/{entry_id}/archive")
def archive_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Verbergt deze dag van de publieke site - foto's, verslagen en linkjes
    eronder blijven gewoon bestaan en zijn nog te bekijken/bewerken door de
    beheerder. Bewust geen verwijderen (zie item 1147): dat zou ook alles
    eronder weggooien."""
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    entry.archived_at = datetime.utcnow()
    session.add(entry)
    session.commit()
    return {"ok": True}


@router.post("/entries/{entry_id}/restore")
def restore_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    entry.archived_at = None
    session.add(entry)
    session.commit()
    return {"ok": True}


@router.delete("/entries/{entry_id}")
def delete_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Permanent verwijderen, inclusief alles wat eronder hangt (foto's/video's,
    verslagen + hun tags/linkjes, invullinkjes, doelpunten, foto-blok-positie).
    Alleen toegestaan als de dag al gearchiveerd is - eerst archiveren dwingt
    een bewuste tussenstap af voor je iets echt onomkeerbaars doet."""
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    if entry.archived_at is None:
        raise HTTPException(status_code=400, detail="Archiveer deze dag eerst voor je 'm permanent verwijdert")
    match_ref = f"custom:{entry_id}"

    photos = session.exec(select(YearOfPhoto).where(YearOfPhoto.match_ref == match_ref)).all()
    for photo in photos:
        for tag in session.exec(select(YearOfPhotoPlayerTag).where(YearOfPhotoPlayerTag.photo_id == photo.id)).all():
            session.delete(tag)
        session.delete(photo)

    reports = session.exec(select(YearOfReport).where(YearOfReport.match_ref == match_ref)).all()
    for report in reports:
        for tag in session.exec(select(YearOfReportPlayerTag).where(YearOfReportPlayerTag.report_id == report.id)).all():
            session.delete(tag)
        for link in session.exec(select(YearOfReportLink).where(YearOfReportLink.report_id == report.id)).all():
            session.delete(link)
        session.delete(report)

    for link in session.exec(select(YearOfContributorLink).where(YearOfContributorLink.match_ref == match_ref)).all():
        session.delete(link)

    for goal in session.exec(select(YearOfMatchGoal).where(YearOfMatchGoal.match_ref == match_ref)).all():
        session.delete(goal)

    photo_block = session.get(YearOfMatchPhotoBlock, match_ref)
    if photo_block:
        session.delete(photo_block)

    session.delete(entry)
    session.commit()

    for photo in photos:
        shutil.rmtree(PHOTO_ROOT / photo.id, ignore_errors=True)

    return {"ok": True}


# ---------------------------------------------------------------------------
# Tijdlijn — competitie (Poulebord/hockey-inside) + custom entries samengevoegd
# ---------------------------------------------------------------------------

def _competition_timeline_items(session: Session) -> list[dict]:
    poule = session.get(HockeyPoule, POULE_ID)
    if not poule:
        return []
    data = _serialize_poule_matches(session, poule)
    items = []
    for status_key, rows in (("finished", data["finished"]), ("scheduled", data["scheduled"])):
        for m in rows:
            if TEAM_NAME not in (m["home"], m["away"]):
                continue
            is_home = m["home"] == TEAM_NAME
            items.append({
                "kind": "competitie",
                "match_ref": f"knhb:{m['match_id']}",
                "title": f"{m['home']} - {m['away']}",
                "date": m["date"],
                "opponent": m["away"] if is_home else m["home"],
                "is_home": is_home,
                "score_us": (m["home_score"] if is_home else m["away_score"]) if status_key == "finished" else None,
                "score_them": (m["away_score"] if is_home else m["home_score"]) if status_key == "finished" else None,
                # Aparte thuis/uit-geordende score (i.t.t. score_us/score_them
                # hierboven) zodat de score net als de titel altijd
                # thuis-uit getoond kan worden - bug ontdekt 21/09: titel in
                # thuis/uit-volgorde naast score in wij/zij-volgorde liet de
                # uitslag bij een uitwedstrijd omgedraaid lijken.
                "score_home": m["home_score"] if status_key == "finished" else None,
                "score_away": m["away_score"] if status_key == "finished" else None,
                "location": m.get("location"),
                "home_club_logo": m.get("home_club_logo"),
                "away_club_logo": m.get("away_club_logo"),
                "opponent_club_logo": m.get("away_club_logo") if is_home else m.get("home_club_logo"),
                "description": None,
                "is_pinned": False,
                "status": status_key,
                "is_archived": False,
            })
    return items


def _custom_timeline_items(session: Session, include_archived: bool = False) -> list[dict]:
    q = select(YearOfCustomEntry)
    if not include_archived:
        q = q.where(col(YearOfCustomEntry.archived_at).is_(None))
    rows = session.exec(q.order_by(YearOfCustomEntry.date)).all()
    items = []
    for e in rows:
        has_score = e.score_us is not None or e.score_them is not None
        items.append({
            "kind": e.kind,
            "match_ref": f"custom:{e.id}",
            "title": e.title,
            "date": e.date,
            "opponent": e.opponent,
            "is_home": e.is_home,
            "score_us": e.score_us,
            "score_them": e.score_them,
            "location": e.location,
            "description": e.description,
            "is_pinned": e.is_pinned,
            "status": "finished" if has_score else "scheduled",
            "is_archived": e.archived_at is not None,
        })
    return items


def _annotate_content_flags(session: Session, items: list[dict]) -> list[dict]:
    """Zet has_photos/has_report/has_footage per item - voor kleine
    aanwezigheids-icoontjes op het tijdlijn-overzicht, zonder de content zelf
    te tonen (dat blijft aan de detailpagina)."""
    match_refs = [it["match_ref"] for it in items]
    if not match_refs:
        return items
    photos = session.exec(
        select(YearOfPhoto).where(YearOfPhoto.status == "published").where(col(YearOfPhoto.match_ref).in_(match_refs))
    ).all()
    photos_by_ref = {p.match_ref for p in photos}

    reports = session.exec(
        select(YearOfReport).where(YearOfReport.status == "published").where(col(YearOfReport.match_ref).in_(match_refs))
    ).all()
    reports_by_ref = {r.match_ref for r in reports if r.report_type in ("wedstrijdverslag", "interview")}
    footage_by_ref = {r.match_ref for r in reports if r.report_type == "wedstrijd_beelden"}

    for it in items:
        it["has_photos"] = it["match_ref"] in photos_by_ref
        it["has_report"] = it["match_ref"] in reports_by_ref
        it["has_footage"] = it["match_ref"] in footage_by_ref
    return items


@router.get("/timeline")
def get_timeline(session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Competitiewedstrijden (read-only sync) + oefenwedstrijden/bijzondere dagen
    (handmatig ingevoerd), samengevoegd en op datum gesorteerd. match_ref is het
    genormaliseerde tag-doel voor latere content (fase 4/5)."""
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    items.sort(key=lambda e: e["date"])
    return _annotate_content_flags(session, items)


@router.get("/timeline/moderation")
def get_timeline_moderation(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Beheerder-only — zelfde als /timeline, maar inclusief gearchiveerde
    dagen (die op de publieke site verborgen zijn). Moet vóór /timeline/{match_ref}
    gedeclareerd staan, anders vangt die route 'moderation' als match_ref weg."""
    items = _competition_timeline_items(session) + _custom_timeline_items(session, include_archived=True)
    items.sort(key=lambda e: e["date"])
    return _annotate_content_flags(session, items)


@router.get("/timeline/moderation/{match_ref}")
def get_timeline_item_moderation(match_ref: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    items = _competition_timeline_items(session) + _custom_timeline_items(session, include_archived=True)
    for item in items:
        if item["match_ref"] == match_ref:
            return item
    raise HTTPException(status_code=404, detail="Item niet gevonden")


@router.get("/timeline/{match_ref}")
def get_timeline_item(match_ref: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    for item in items:
        if item["match_ref"] == match_ref:
            return item
    raise HTTPException(status_code=404, detail="Item niet gevonden")


@router.get("/standings")
def get_standings(session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Pouletabel (item 1152) - hergebruikt de bestaande Poulebord/hockey-inside
    standings-endpoint 1-op-1, alleen achter het teamlinkje i.p.v. volledig open.
    Markeert onze eigen rij (is_us) zodat de frontend die niet zelf hoeft te
    matchen op teamnaam."""
    data = get_hockey_poule_standings(POULE_ID, session)
    for row in data["standings"]:
        row["is_us"] = row["team_name"] == TEAM_NAME
    return data
