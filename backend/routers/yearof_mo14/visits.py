"""Bezoeken per deelbare link (item 1193) + 1 overzicht van alle linkjes voor
de beheerder: sitelinks, wedstrijdlinks, spelerslinks en invullinks.
Profiellinks (speelster bewerkt eigen profiel) bewust niet.

Tellen gebeurt via een ping van de frontend bij het openen van een link
(opens = elke keer, uniek = per visitor_id uit localStorage). Geen IP-adres.
Bezoeken van ingelogde beheerders en van apparaten met "niet meetellen"
worden gemarkeerd (is_admin) en apart getoond, niet meegeteld in de cijfers."""

from collections import defaultdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.yearof import (
    YearOfContributorLink,
    YearOfLinkVisit,
    YearOfPlayer,
    YearOfShortLink,
    YearOfTeamLink,
)

from ._shared import get_optional_user
from .contributor_links import list_contributor_links
from .entries_timeline import _competition_timeline_items, _custom_timeline_items

router = APIRouter(tags=["yearof-mo14"])

LINK_KINDS = {"site", "match", "player", "contribute"}


class VisitIn(BaseModel):
    kind: str
    code: str
    visitor_id: str
    excluded: bool = False  # apparaat met "niet meetellen" (beheerder zonder login)


def _link_exists(session: Session, kind: str, code: str) -> bool:
    if kind == "site":
        return session.get(YearOfTeamLink, code) is not None
    if kind == "contribute":
        return session.get(YearOfContributorLink, code) is not None
    link = session.get(YearOfShortLink, code)
    return link is not None and link.link_type == kind


@router.post("/visits")
def record_visit(
    body: VisitIn,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Publiek. Bezoeken van beheerders (ingelogd of "niet meetellen") worden
    opgeslagen met is_admin=True en apart getoond."""
    code = body.code.strip().lower()
    if body.kind not in LINK_KINDS or not _link_exists(session, body.kind, code):
        raise HTTPException(status_code=400, detail="Onbekende link")
    is_admin = current_user is not None or body.excluded
    session.add(YearOfLinkVisit(link_kind=body.kind, link_code=code, visitor_id=body.visitor_id[:64], is_admin=is_admin))
    session.commit()
    return {"counted": not is_admin}


def _visit_stats(visits: list[YearOfLinkVisit]) -> dict:
    """Cijfers zonder beheerders; admin_opens = bezoeken van beheerders (tussen haakjes)."""
    counted = [v for v in visits if not v.is_admin]
    by_day: dict[str, list[YearOfLinkVisit]] = defaultdict(list)
    for v in visits:
        by_day[v.visited_at.date().isoformat()].append(v)
    return {
        "opens": len(counted),
        "unique": len({v.visitor_id for v in counted}),
        "admin_opens": len(visits) - len(counted),
        "last_visit": max((v.visited_at for v in counted), default=None),
        "days": [
            {
                "date": day,
                "opens": sum(1 for v in rows if not v.is_admin),
                "unique": len({v.visitor_id for v in rows if not v.is_admin}),
                "admin_opens": sum(1 for v in rows if v.is_admin),
            }
            for day, rows in sorted(by_day.items(), reverse=True)
        ],
    }


def _status(expires_at: Optional[datetime], revoked_at: Optional[datetime]) -> str:
    if revoked_at is not None:
        return "revoked"
    if expires_at is not None and expires_at < datetime.utcnow():
        return "expired"
    return "active"


@router.get("/link-overview")
def link_overview(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — alle deelbare linkjes per soort, met bezoekcijfers."""
    visits_by_link: dict[tuple[str, str], list[YearOfLinkVisit]] = defaultdict(list)
    for v in session.exec(select(YearOfLinkVisit)).all():
        visits_by_link[(v.link_kind, v.link_code)].append(v)

    match_titles = {
        item["match_ref"]: item.get("title") or item["match_ref"]
        for item in _competition_timeline_items(session) + _custom_timeline_items(session, include_archived=True)
    }
    players = {p.id: (p.nickname or p.name) for p in session.exec(select(YearOfPlayer)).all()}

    def row(kind: str, code: str, label: str, created_at, expires_at, revoked_at, **extra) -> dict:
        return {
            "code": code, "label": label, "created_at": created_at, "expires_at": expires_at, "revoked_at": revoked_at,
            "status": _status(expires_at, revoked_at), **extra,
            **_visit_stats(visits_by_link.get((kind, code), [])),
        }

    site = [
        row("site", t.id, "Sitelink", t.created_at, t.expires_at, t.revoked_at)
        for t in session.exec(select(YearOfTeamLink).order_by(YearOfTeamLink.created_at.desc())).all()
    ]

    match, player = [], []
    short_links = session.exec(select(YearOfShortLink).order_by(YearOfShortLink.created_at.desc())).all()
    for s in short_links:
        if s.link_type == "match":
            # Legacy wedstrijdlinks (zonder eigen vervaldatum) vervallen met hun teamcode.
            team = session.get(YearOfTeamLink, s.team_code) if s.expires_at is None else None
            expires_at = team.expires_at if team else s.expires_at
            revoked_at = s.revoked_at or (team.revoked_at if team else None)
            match.append(row("match", s.id, match_titles.get(s.match_ref, s.match_ref), s.created_at,
                             expires_at, revoked_at, legacy=s.expires_at is None, match_ref=s.match_ref))
        elif s.link_type == "player":
            player.append(row("player", s.id, players.get(s.player_id, "?"), s.created_at, s.expires_at, s.revoked_at,
                              player_id=s.player_id))

    # Invullinks incl. invul-status (geopend/ingevuld/...) uit de bestaande
    # lijst, zodat het blok op de wedstrijdpagina die oude lijst kan vervangen.
    contribute = [
        row("contribute", c["id"],
            f"{match_titles.get(c['match_ref'], c['match_ref'])} — {players.get(c['player_id'], 'algemeen') if c['player_id'] else 'algemeen'}",
            c["created_at"], c["expires_at"], c["revoked_at"],
            match_ref=c["match_ref"], player_id=c["player_id"], report_type=c["report_type"],
            opened_at=c["opened_at"], report_status=c["report_status"], photo_count=c["photo_count"])
        for c in list_contributor_links(session=session, _=None)
    ]

    return {"site": site, "match": match, "player": player, "contribute": contribute}
