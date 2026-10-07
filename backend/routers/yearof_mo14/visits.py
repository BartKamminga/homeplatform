"""Bezoeken per deelbare link (item 1193) + 1 overzicht van alle linkjes voor
de beheerder: sitelinks, wedstrijdlinks, spelerslinks, invullinks en profiellinks.

Tellen gebeurt via een ping van de frontend bij het openen van een link
(opens = elke keer, uniek = per visitor_id uit localStorage). Geen IP-adres.
Bezoeken van ingelogde beheerders en van apparaten met "niet meetellen"
worden gemarkeerd (is_admin) en apart getoond, niet meegeteld in de cijfers."""

from collections import defaultdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.yearof import (
    YearOfContributorLink,
    YearOfLinkVisit,
    YearOfPlayer,
    YearOfProfileLink,
    YearOfShortLink,
    YearOfTeamLink,
)

from ._shared import get_optional_user
from .contributor_links import list_contributor_links
from .entries_timeline import _competition_timeline_items, _custom_timeline_items

router = APIRouter(tags=["yearof-mo14"])

LINK_KINDS = {"site", "match", "player", "contribute", "profile"}


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
    if kind == "profile":
        return session.get(YearOfProfileLink, code) is not None
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
    session.add(YearOfLinkVisit(link_kind=body.kind, link_code=code, visitor_id=body.visitor_id[:64], is_admin=is_admin,
                                user_id=current_user.id if current_user else None))
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


def _match_titles(session: Session) -> dict[str, str]:
    return {
        item["match_ref"]: item.get("title") or item["match_ref"]
        for item in _competition_timeline_items(session) + _custom_timeline_items(session, include_archived=True)
    }


def _player_names(session: Session) -> dict[str, str]:
    return {p.id: (p.nickname or p.name) for p in session.exec(select(YearOfPlayer)).all()}


@router.get("/link-overview")
def link_overview(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — alle deelbare linkjes per soort, met bezoekcijfers."""
    visits_by_link: dict[tuple[str, str], list[YearOfLinkVisit]] = defaultdict(list)
    for v in session.exec(select(YearOfLinkVisit)).all():
        visits_by_link[(v.link_kind, v.link_code)].append(v)

    match_titles, players = _match_titles(session), _player_names(session)

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

    # Profiellinks (speelster bewerkt eigen profiel): permanent, geen vervaldatum.
    profile = [
        row("profile", p.id, players.get(p.player_id, "?"), p.created_at, None, None, player_id=p.player_id)
        for p in session.exec(select(YearOfProfileLink).order_by(YearOfProfileLink.created_at.desc())).all()
    ]

    # Totalen per soort en overall - uniek moet hier over de ruwe bezoeken,
    # niet door rijen op te tellen (1 apparaat opent vaak meerdere links).
    all_visits = [v for rows in visits_by_link.values() for v in rows]

    def totals(visits: list[YearOfLinkVisit]) -> dict:
        counted = [v for v in visits if not v.is_admin]
        return {
            "opens": len(counted),
            "unique": len({v.visitor_id for v in counted}),
            "admin_opens": len(visits) - len(counted),
        }

    return {
        "site": site, "match": match, "player": player, "contribute": contribute, "profile": profile,
        "totals": {
            "all": totals(all_visits),
            **{kind: totals([v for v in all_visits if v.link_kind == kind]) for kind in LINK_KINDS},
        },
    }


@router.get("/visits/recent")
def recent_visits(
    limit: int = 50,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — laatste bezoeken met per bezoek: via welke link
    (wedstrijd/speelster/...), en wie: ingelogde gebruiker, niet-meetellen-
    apparaat of onbekend apparaat (nieuw of terugkerend)."""
    visits = session.exec(
        select(YearOfLinkVisit).order_by(YearOfLinkVisit.visited_at.desc()).limit(min(limit, 200))
    ).all()
    match_titles, players = _match_titles(session), _player_names(session)
    users = {u.id: u.username for u in session.exec(select(User)).all()}

    labels: dict[tuple[str, str], str] = {}
    for s in session.exec(select(YearOfShortLink)).all():
        if s.link_type == "match":
            labels[("match", s.id)] = match_titles.get(s.match_ref, s.match_ref)
        elif s.link_type == "player":
            labels[("player", s.id)] = players.get(s.player_id, "?")
    for c in session.exec(select(YearOfContributorLink)).all():
        who = players.get(c.player_id, "algemeen") if c.player_id else "algemeen"
        labels[("contribute", c.id)] = f"{match_titles.get(c.match_ref, c.match_ref)} — {who}"
    for p in session.exec(select(YearOfProfileLink)).all():
        labels[("profile", p.id)] = players.get(p.player_id, "?")

    # Eerste bezoek per apparaat, om "nieuw apparaat" te kunnen tonen.
    visitor_ids = {v.visitor_id for v in visits}
    first_seen = {
        vid: first for vid, first in session.exec(
            select(YearOfLinkVisit.visitor_id, func.min(YearOfLinkVisit.visited_at))
            .where(YearOfLinkVisit.visitor_id.in_(visitor_ids))
            .group_by(YearOfLinkVisit.visitor_id)
        ).all()
    }

    def who(v: YearOfLinkVisit) -> str:
        if v.user_id is not None:
            return "user"
        return "excluded" if v.is_admin else "unknown"

    return [
        {
            "visited_at": v.visited_at,
            "kind": v.link_kind,
            "code": v.link_code,
            "label": labels.get((v.link_kind, v.link_code), "Sitelink" if v.link_kind == "site" else v.link_code),
            "who": who(v),
            "username": users.get(v.user_id) if v.user_id is not None else None,
            "visitor": v.visitor_id[:6],
            "new_visitor": first_seen.get(v.visitor_id) == v.visited_at,
            "is_admin": v.is_admin,
        }
        for v in visits
    ]
