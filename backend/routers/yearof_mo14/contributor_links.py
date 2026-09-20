"""Wedstrijd-invullink (contributor) — eenmalig/tijdelijk, publiek zonder
teamcode (de invullink zelf is het bewijs van toegang): create/list/context,
en interview-candidates. Zie __init__.py voor hoe dit sub-router samengevoegd
wordt onder /api/yearof-mo14."""

import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.yearof import YearOfContributorLink, YearOfPhoto, YearOfPlayer, YearOfReport

from ._shared import TEAM_LINK_CHARS, require_team_access
from .entries_timeline import _competition_timeline_items, _custom_timeline_items

router = APIRouter(tags=["yearof-mo14"])


# ---------------------------------------------------------------------------
# Wedstrijd-invullink (contributor) — eenmalig/tijdelijk, publiek zonder
# teamcode (de invullink zelf is het bewijs van toegang).
# ---------------------------------------------------------------------------

CONTRIBUTOR_LINK_DEFAULT_DAYS = 14


class ContributorLinkIn(BaseModel):
    match_ref: str
    player_id: Optional[str] = None
    report_type: str = "interview"  # interview | wedstrijdverslag | foto (alleen fotos/filmpjes, geen tekst)
    expires_days: int = CONTRIBUTOR_LINK_DEFAULT_DAYS


@router.post("/contributor-links")
def create_contributor_link(
    body: ContributorLinkIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    code = None
    for _ in range(20):
        candidate = "".join(random.choices(TEAM_LINK_CHARS, k=6))
        if not session.get(YearOfContributorLink, candidate):
            code = candidate
            break
    if not code:
        raise RuntimeError("Geen unieke code gevonden")

    link = YearOfContributorLink(
        id=code,
        match_ref=body.match_ref,
        player_id=body.player_id,
        report_type=body.report_type,
        expires_at=datetime.utcnow() + timedelta(days=body.expires_days),
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.get("/contributor-links")
def list_contributor_links(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — inclusief status (opened_at + het lot van het bijbehorende
    verslag, indien al ingevuld) zodat de UI geopend/ingevuld/concept/gepubliceerd
    kan tonen zonder aparte round-trips. Voor report_type "foto" bestaat er geen
    verslag - daar telt het aantal geuploade fotos/filmpjes als "ingevuld"."""
    links = session.exec(select(YearOfContributorLink).order_by(YearOfContributorLink.created_at.desc())).all()
    reports = session.exec(select(YearOfReport).where(col(YearOfReport.contributor_code).is_not(None))).all()
    report_by_code = {r.contributor_code: r for r in reports}

    foto_codes = [link.id for link in links if link.report_type == "foto"]
    photo_count_by_code: dict[str, int] = {}
    if foto_codes:
        photos = session.exec(select(YearOfPhoto).where(col(YearOfPhoto.uploader_code).in_(foto_codes))).all()
        for photo in photos:
            photo_count_by_code[photo.uploader_code] = photo_count_by_code.get(photo.uploader_code, 0) + 1

    return [
        {
            **link.model_dump(),
            "report_status": report_by_code[link.id].status if link.id in report_by_code else None,
            "photo_count": photo_count_by_code.get(link.id, 0),
        }
        for link in links
    ]


@router.delete("/contributor-links/{code}")
def delete_contributor_link(
    code: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    link = get_or_404(session, YearOfContributorLink, code, "Invullinkje")
    session.delete(link)
    session.commit()
    return {"ok": True}


@router.get("/matches/{match_ref}/interview-candidates")
def list_interview_candidates(
    match_ref: str,
    session: Session = Depends(get_session),
    _: None = Depends(require_team_access),
):
    """Publiek (teamcode) — namen/fotos van spelers met een nog openstaand
    interview-linkje voor deze wedstrijd, voor een leuke "wie komt er aan het
    woord"-teaser op de homepage. Geeft bewust NOOIT de linkjes/codes zelf
    terug - dat zou een manier zijn om ongevraagd bij iemands invulpagina te komen."""
    now = datetime.utcnow()
    links = session.exec(
        select(YearOfContributorLink)
        .where(YearOfContributorLink.match_ref == match_ref)
        .where(YearOfContributorLink.report_type == "interview")
        .where(YearOfContributorLink.revoked_at.is_(None))
        .where(YearOfContributorLink.expires_at > now)
    ).all()
    reports = session.exec(select(YearOfReport).where(col(YearOfReport.contributor_code).is_not(None))).all()
    filled_codes = {r.contributor_code for r in reports}

    player_ids = [l.player_id for l in links if l.player_id and l.id not in filled_codes]
    if not player_ids:
        return []
    players = session.exec(select(YearOfPlayer).where(col(YearOfPlayer.id).in_(player_ids))).all()
    return [{"id": p.id, "name": p.nickname or p.name, "photo_url": p.photo_url} for p in players]


@router.get("/contributor-links/{code}")
def get_contributor_link_context(code: str, session: Session = Depends(get_session)):
    """Publiek — het invulformulier haalt hiermee de context op (welke wedstrijd,
    voor wie) en checkt meteen of de link nog geldig is. Zet ook opened_at
    (eerste keer) voor de statusweergave in het beheerderscherm."""
    link = session.get(YearOfContributorLink, code.strip().lower())
    if not link or link.revoked_at is not None or link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Deze invullink is verlopen of ongeldig")

    if link.opened_at is None:
        link.opened_at = datetime.utcnow()
        session.add(link)
        session.commit()

    player = session.get(YearOfPlayer, link.player_id) if link.player_id else None
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    match = next((it for it in items if it["match_ref"] == link.match_ref), None)

    # bestaand verslag via dit linkje - laat het formulier vooraf invullen i.p.v.
    # blanco te tonen, en voorkomt dubbele rijen bij opnieuw versturen. Bij
    # report_type "foto" wordt bewust geen verslag aangemaakt (puur fotos/
    # filmpjes, geen tekst) - eerder geuploade fotos worden dan gevonden via
    # uploader_code i.p.v. report_id.
    existing = None
    existing_photos = []
    if link.report_type == "foto":
        existing_photos = session.exec(
            select(YearOfPhoto).where(YearOfPhoto.uploader_code == code.strip().lower()).order_by(YearOfPhoto.created_at)
        ).all()
    else:
        existing = session.exec(
            select(YearOfReport)
            .where(YearOfReport.contributor_code == code.strip().lower())
            .order_by(YearOfReport.created_at.desc())
        ).first()
        # Ook nog-concept fotos tonen bij dit verslag (anders lijken ze
        # "verdwenen" bij opnieuw invullen, terwijl ze gewoon wachten op
        # goedkeuring) - mag hier zonder login, want de contributor-code zelf
        # is al het bewijs dat dit hun eigen invullink/verslag is.
        if existing:
            existing_photos = session.exec(
                select(YearOfPhoto).where(YearOfPhoto.report_id == existing.id).order_by(YearOfPhoto.created_at)
            ).all()

    return {
        "match_ref": link.match_ref,
        "match_title": match["title"] if match else link.match_ref,
        "player_id": link.player_id,
        "player_name": (player.nickname or player.name) if player else None,
        "report_type": link.report_type,
        "existing_report": existing,
        "existing_photos": existing_photos,
    }
