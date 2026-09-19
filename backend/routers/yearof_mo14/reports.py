"""Verslagen & interviews — submit (via invullink)/create-direct/list/
moderation/update/delete/move/tags/like, en de losse links per verslag
(instagram/video) — add/update/delete. Zie __init__.py voor hoe dit
sub-router samengevoegd wordt onder /api/yearof-mo14."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, or_, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.yearof import (
    YearOfContributorLink,
    YearOfPhoto,
    YearOfPlayer,
    YearOfReport,
    YearOfReportLink,
    YearOfReportPlayerTag,
)

from ._shared import require_team_access

router = APIRouter(tags=["yearof-mo14"])


# ---------------------------------------------------------------------------
# Verslagen & interviews
# ---------------------------------------------------------------------------

class ReportSubmit(BaseModel):
    contributor_code: str
    title: str
    body: str
    author_name: Optional[str] = None


class ReportLinkIn(BaseModel):
    link_type: str  # instagram | video
    url: str
    note: Optional[str] = None


class ReportLinkUpdate(BaseModel):
    link_type: Optional[str] = None
    url: Optional[str] = None
    note: Optional[str] = None


class ReportCreate(BaseModel):
    match_ref: Optional[str] = None  # leeg = algemeen interview (coach/ouder), niet aan 1 wedstrijd gekoppeld
    report_type: str = "wedstrijdverslag"
    interviewee_role: Optional[str] = None  # speelster | coach | ouder
    title: str
    body: str
    author_name: Optional[str] = None
    links: Optional[list[ReportLinkIn]] = None
    status: str = "published"
    insert_after_id: Optional[str] = None  # WYSIWYG-editor: plaats dit item net na dit bestaande item op de wedstrijdpagina


class MoveDirection(BaseModel):
    direction: str  # "up" | "down"


class ReportUpdate(BaseModel):
    match_ref: Optional[str] = None
    report_type: Optional[str] = None
    interviewee_role: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    author_name: Optional[str] = None
    featured: Optional[bool] = None
    status: Optional[str] = None


def _report_links(session: Session, report_id: str) -> list[dict]:
    rows = session.exec(
        select(YearOfReportLink).where(YearOfReportLink.report_id == report_id).order_by(YearOfReportLink.sort_order)
    ).all()
    return [{"id": r.id, "link_type": r.link_type, "url": r.url, "note": r.note} for r in rows]


def _add_report_links(session: Session, report_id: str, links: Optional[list[ReportLinkIn]]) -> None:
    for i, link in enumerate(links or []):
        if not link.url or not link.url.strip():
            continue
        session.add(YearOfReportLink(report_id=report_id, link_type=link.link_type, url=link.url.strip(),
                                      note=link.note or None, sort_order=i))
    session.commit()


def _report_out(session: Session, report: YearOfReport, player_ids: Optional[list[str]] = None) -> dict:
    data = report.model_dump()
    data["links"] = _report_links(session, report.id)
    if player_ids is not None:
        data["player_ids"] = player_ids
    return data


@router.post("/reports", status_code=201)
def submit_report(body: ReportSubmit, session: Session = Depends(get_session)):
    """Publiek — via een wedstrijd-invullink, geen homeplatform-login.

    Eerste keer invullen -> nieuw verslag (concept). Opnieuw invullen via
    hetzelfde linkje -> bestaand verslag bijwerken i.p.v. een dubbele rij
    aan te maken; dit zet de status ALTIJD terug naar concept, ook als het
    inmiddels published was - dat IS het "wijziging aanvragen"-mechanisme:
    de vorige (goedgekeurde) tekst blijft dus tijdelijk van de site tot de
    beheerder de nieuwe versie opnieuw goedkeurt."""
    code = body.contributor_code.strip().lower()
    link = session.get(YearOfContributorLink, code)
    if not link or link.revoked_at is not None or link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Deze invullink is verlopen of ongeldig")

    existing = session.exec(
        select(YearOfReport)
        .where(YearOfReport.contributor_code == code)
        .order_by(YearOfReport.created_at.desc())
    ).first()

    if existing:
        existing.title = body.title
        existing.body = body.body
        existing.author_name = body.author_name
        existing.status = "concept"
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _report_out(session, existing)

    report = YearOfReport(
        match_ref=link.match_ref,
        report_type=link.report_type,
        interviewee_role="speelster" if link.report_type == "interview" else None,
        status="concept",
        title=body.title,
        body=body.body,
        author_name=body.author_name,
        contributor_code=code,
    )
    session.add(report)
    session.commit()
    session.refresh(report)

    if link.player_id:
        session.add(YearOfReportPlayerTag(report_id=report.id, player_id=link.player_id))
        session.commit()
        session.refresh(report)  # commit hierboven expired report, anders geeft model_dump() straks leeg terug

    return _report_out(session, report)


def _next_sort_order(session: Session, match_ref: Optional[str], insert_after_id: Optional[str]) -> int:
    """WYSIWYG-editor: nieuwe items krijgen standaard een sort_order aan het
    einde (+1000 t.o.v. de hoogste), of - als insert_after_id gegeven is -
    precies tussen dat item en het volgende in, zodat bestaande items niet
    herindexeerd hoeven te worden."""
    if not match_ref:
        return 0
    siblings = session.exec(
        select(YearOfReport).where(YearOfReport.match_ref == match_ref).order_by(YearOfReport.sort_order)
    ).all()
    if not siblings:
        return 1000
    if not insert_after_id:
        return siblings[-1].sort_order + 1000
    idx = next((i for i, r in enumerate(siblings) if r.id == insert_after_id), None)
    if idx is None:
        return siblings[-1].sort_order + 1000
    if idx + 1 < len(siblings):
        nxt = siblings[idx + 1]
        gap = nxt.sort_order - siblings[idx].sort_order
        return siblings[idx].sort_order + (gap // 2 if gap > 1 else 1)
    return siblings[idx].sort_order + 1000


@router.post("/reports/direct", status_code=201)
def create_report_direct(
    body: ReportCreate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — een verslag direct schrijven (bv. het officiele
    wedstrijdverslag), mag standaard meteen published zijn."""
    data = body.model_dump()
    links = data.pop("links", None)
    insert_after_id = data.pop("insert_after_id", None)
    data["sort_order"] = _next_sort_order(session, data.get("match_ref"), insert_after_id)
    if data.get("status") == "published":
        data["published_at"] = datetime.utcnow()
    report = YearOfReport(**data)
    session.add(report)
    session.commit()
    session.refresh(report)
    _add_report_links(session, report.id, [ReportLinkIn(**l) for l in (links or [])])
    session.refresh(report)  # _add_report_links commit hierboven expired report, anders geeft model_dump() straks leeg terug
    return _report_out(session, report)


@router.get("/reports")
def list_reports(
    match_ref: Optional[str] = None,
    report_type: Optional[str] = None,
    session: Session = Depends(get_session),
    _: None = Depends(require_team_access),
):
    """Publiek — toont alleen gepubliceerde verslagen. Zie /reports/spotlight
    voor de handmatig-curated "In de kijker"-selectie."""
    q = select(YearOfReport).where(YearOfReport.status == "published")
    if match_ref:
        q = q.where(YearOfReport.match_ref == match_ref)
    if report_type:
        q = q.where(YearOfReport.report_type == report_type)
    reports = session.exec(q.order_by(YearOfReport.created_at.desc())).all()

    report_ids = [r.id for r in reports]
    tags_by_report: dict[str, list[str]] = {}
    if report_ids:
        for t in session.exec(select(YearOfReportPlayerTag).where(col(YearOfReportPlayerTag.report_id).in_(report_ids))).all():
            tags_by_report.setdefault(t.report_id, []).append(t.player_id)

    return [_report_out(session, r, tags_by_report.get(r.id, [])) for r in reports]


@router.get("/reports/spotlight")
def get_spotlight_reports(
    session: Session = Depends(get_session),
    _: None = Depends(require_team_access),
):
    """"In de kijker" - beheerder selecteert handmatig welke berichten hier
    verschijnen (featured=true). Algemene berichten (report_type="nieuws")
    staan er altijd bij - die zijn niet aan een wedstrijd gekoppeld en hebben
    anders nergens op de publieke site een plek. Zolang er nog niets
    gefeatured is en er geen nieuws is, valt dit terug op het wedstrijdverslag
    van de meest recente wedstrijd, zodat de pagina niet leeg is."""
    q = (
        select(YearOfReport)
        .where(YearOfReport.status == "published")
        .where(or_(YearOfReport.featured == True, YearOfReport.report_type == "nieuws"))  # noqa: E712
    )
    reports = session.exec(q.order_by(YearOfReport.created_at.desc())).all()

    if not reports:
        fallback_q = (
            select(YearOfReport)
            .where(YearOfReport.status == "published")
            .where(YearOfReport.report_type == "wedstrijdverslag")
        )
        fallback = session.exec(fallback_q.order_by(YearOfReport.created_at.desc())).first()
        reports = [fallback] if fallback else []

    report_ids = [r.id for r in reports]
    tags_by_report: dict[str, list[str]] = {}
    if report_ids:
        for t in session.exec(select(YearOfReportPlayerTag).where(col(YearOfReportPlayerTag.report_id).in_(report_ids))).all():
            tags_by_report.setdefault(t.report_id, []).append(t.player_id)

    return [_report_out(session, r, tags_by_report.get(r.id, [])) for r in reports]


@router.get("/reports/moderation")
def list_reports_for_moderation(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    reports = session.exec(select(YearOfReport).order_by(YearOfReport.created_at.desc())).all()
    all_tags = session.exec(select(YearOfReportPlayerTag)).all()
    tags_by_report: dict[str, list[str]] = {}
    for t in all_tags:
        tags_by_report.setdefault(t.report_id, []).append(t.player_id)
    return [_report_out(session, report, tags_by_report.get(report.id, [])) for report in reports]


@router.patch("/reports/{report_id}")
def update_report(
    report_id: str,
    body: ReportUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    updates = body.model_dump(exclude_unset=True)
    was_published = report.status == "published"
    for key, value in updates.items():
        setattr(report, key, value)
    session.add(report)

    if report.status == "published" and report.published_at is None:
        report.published_at = datetime.utcnow()

    # Fotos bij dit verslag volgen de publicatiestatus van het verslag zelf -
    # anders blijft een net gepubliceerd verslag toch onzichtbare (concept)
    # fotos houden totdat je ze los publiceert in het fotobeheer.
    if report.status == "published" and not was_published:
        for photo in session.exec(select(YearOfPhoto).where(YearOfPhoto.report_id == report_id)).all():
            photo.status = "published"
            if photo.published_at is None:
                photo.published_at = datetime.utcnow()
            session.add(photo)

    session.commit()
    session.refresh(report)
    return _report_out(session, report)


@router.delete("/reports/{report_id}")
def delete_report(
    report_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    for tag in session.exec(select(YearOfReportPlayerTag).where(YearOfReportPlayerTag.report_id == report_id)).all():
        session.delete(tag)
    for link in session.exec(select(YearOfReportLink).where(YearOfReportLink.report_id == report_id)).all():
        session.delete(link)
    for photo in session.exec(select(YearOfPhoto).where(YearOfPhoto.report_id == report_id)).all():
        photo.report_id = None
        session.add(photo)
    session.delete(report)
    session.commit()
    return {"ok": True}


@router.post("/reports/{report_id}/like")
def like_report(report_id: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Publiek - alleen positieve reactie (hartje), geen aparte like-rijen per
    bezoeker. Dedupe (niet meerdere keren liken) gebeurt client-side via
    localStorage, zelfde vertrouwensmodel als de rest van de anonieme site."""
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    report.like_count += 1
    session.add(report)
    session.commit()
    return {"like_count": report.like_count}


@router.delete("/reports/{report_id}/like")
def unlike_report(report_id: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    report.like_count = max(0, report.like_count - 1)
    session.add(report)
    session.commit()
    return {"like_count": report.like_count}


@router.post("/reports/{report_id}/move")
def move_report(
    report_id: str,
    body: MoveDirection,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """WYSIWYG-editor: verwissel sort_order met de vorige/volgende sibling
    binnen dezelfde wedstrijdpagina."""
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    if not report.match_ref:
        raise HTTPException(400, "Alleen wedstrijd-gebonden berichten kunnen verplaatst worden")
    siblings = session.exec(
        select(YearOfReport).where(YearOfReport.match_ref == report.match_ref).order_by(YearOfReport.sort_order)
    ).all()
    idx = next((i for i, r in enumerate(siblings) if r.id == report_id), None)
    if idx is None:
        raise HTTPException(404, "Verslag niet gevonden")
    swap_idx = idx - 1 if body.direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(siblings):
        return {"ok": True}
    other = siblings[swap_idx]
    report.sort_order, other.sort_order = other.sort_order, report.sort_order
    session.add(report)
    session.add(other)
    session.commit()
    return {"ok": True}


@router.post("/reports/{report_id}/links", status_code=201)
def add_report_link(
    report_id: str,
    body: ReportLinkIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, YearOfReport, report_id, "Verslag")
    existing_count = len(session.exec(select(YearOfReportLink).where(YearOfReportLink.report_id == report_id)).all())
    link = YearOfReportLink(report_id=report_id, link_type=body.link_type, url=body.url, note=body.note,
                            sort_order=existing_count)
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.patch("/reports/links/{link_id}")
def update_report_link(
    link_id: str,
    body: ReportLinkUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    link = get_or_404(session, YearOfReportLink, link_id, "Link")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(link, key, value)
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.delete("/reports/links/{link_id}")
def delete_report_link(
    link_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    link = get_or_404(session, YearOfReportLink, link_id, "Link")
    session.delete(link)
    session.commit()
    return {"ok": True}


@router.post("/reports/{report_id}/tags/{player_id}")
def tag_report(
    report_id: str,
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, YearOfReport, report_id, "Verslag")
    get_or_404(session, YearOfPlayer, player_id, "Speler")
    existing = session.exec(
        select(YearOfReportPlayerTag)
        .where(YearOfReportPlayerTag.report_id == report_id)
        .where(YearOfReportPlayerTag.player_id == player_id)
    ).first()
    if existing:
        return existing
    tag = YearOfReportPlayerTag(report_id=report_id, player_id=player_id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.delete("/reports/{report_id}/tags/{player_id}")
def untag_report(
    report_id: str,
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    existing = session.exec(
        select(YearOfReportPlayerTag)
        .where(YearOfReportPlayerTag.report_id == report_id)
        .where(YearOfReportPlayerTag.player_id == player_id)
    ).first()
    if existing:
        session.delete(existing)
        session.commit()
    return {"ok": True}
