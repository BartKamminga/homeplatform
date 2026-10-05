"""Poulebord — herindelingsprognose (item 1182). Logica zit in
services/hockey_regrouping_forecast.py, hier alleen data ophalen."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.database import get_session
from models.hockey_discovery import HockeyPouleMatch, HockeyPouleStanding
from services.hockey_query_scope import scoped_poules
from services.hockey_regrouping_forecast import (
    RULES, SourcePoule, TeamStanding, category_from_competition, forecast,
)
from services.hockey_teams import club_logo_for_team, resolve_team_clubs

router = APIRouter(prefix="/api/hockey", tags=["hockey-regrouping"])


@router.get("/public/tournaments/{tid}/query/regrouping-forecast")
def get_regrouping_forecast(tid: str, session: Session = Depends(get_session)):
    """Prognose van de herindeling na de herfst/voorcompetitie voor een publicatie.

    Bewust over de hele publicatie (geen tag-filter): ook bij filter Topklasse
    zijn de Subtopklasse-standen nodig om de IDC aan te vullen."""
    scoped = [
        (p, comp) for p, comp, _ in scoped_poules(session, tid, None)
        if comp and comp.hockey_type in ("VE", "")
    ]
    by_category: dict = {}
    for p, comp in scoped:
        cat = category_from_competition(comp.name)
        if cat in RULES and comp.class_name in RULES[cat]["source_classes"]:
            by_category.setdefault(cat, []).append((p, comp))
    if not by_category:
        return {"forecast": None}
    # Een publicatie hoort bij één categorie; bij meerdere de grootste nemen.
    category, scoped = max(by_category.items(), key=lambda kv: len(kv[1]))

    ext_ids = [p.poule_id for p, _ in scoped]
    rows = session.exec(
        select(HockeyPouleStanding).where(col(HockeyPouleStanding.poule_id).in_(ext_ids))
    ).all()
    teams, clubs = resolve_team_clubs(session, [r.team_id for r in rows])
    rows_by_poule: dict = {}
    for r in rows:
        rows_by_poule.setdefault(r.poule_id, []).append(r)

    counts: dict = {}
    for m in session.exec(select(HockeyPouleMatch).where(col(HockeyPouleMatch.poule_id).in_(ext_ids))).all():
        c = counts.setdefault(m.poule_id, [0, 0])
        c[1] += 1
        if m.status == "final":
            c[0] += 1

    poules = []
    for p, comp in scoped:
        prow = sorted(rows_by_poule.get(p.poule_id, []), key=lambda r: (r.position is None, r.position or 0, -r.points))
        played, total = counts.get(p.poule_id, [0, 0])
        poules.append(SourcePoule(
            label=f"{comp.district or '?'} · {p.name}",
            class_name=comp.class_name, district=comp.district,
            matches_played=played, matches_total=total,
            standings=[
                TeamStanding(
                    team_id=r.team_id, team_name=r.team_name, position=r.position or i,
                    played=r.played, points=r.points, goals_for=r.goals_for, goals_against=r.goals_against,
                    club_logo_url=club_logo_for_team(teams, clubs, r.team_id),
                )
                for i, r in enumerate(prow, 1)
            ],
        ))
    return {"forecast": forecast(category, poules)}
