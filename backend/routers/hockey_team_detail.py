"""Hockey — season-scoped teamdetail (item 994): welke poule(s)/competitie(s)
heeft een team in het geselecteerde seizoen, incl. stand en wedstrijden.
Los bestand i.p.v. uitbreiding van hockey_clubs.py/hockey_capture.py om die
onder de 300-regelgrens te houden."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import (
    HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding,
    HockeyTeam, HockeyTeamPoule,
)
from services.hockey_vanger_settings import get_target_season

router = APIRouter(prefix="/api/hockey", tags=["hockey-clubs"])


def _poule_payload(session: Session, poule: HockeyPoule, team_id: int, is_primary: bool) -> dict:
    comp = session.get(HockeyCompetition, poule.competition_id)
    standings = session.exec(
        select(HockeyPouleStanding)
        .where(HockeyPouleStanding.poule_id == poule.poule_id)
        .order_by(col(HockeyPouleStanding.position))
    ).all()
    matches = session.exec(
        select(HockeyPouleMatch)
        .where(HockeyPouleMatch.poule_id == poule.poule_id)
        .order_by(col(HockeyPouleMatch.round), col(HockeyPouleMatch.match_date))
    ).all()
    own_standing = next((s for s in standings if s.team_id == team_id), None)

    return {
        "poule_id":        poule.poule_id,
        "poule_name":      poule.name,
        "season":          poule.season,
        "is_primary":      is_primary,
        "captured":        True,
        "competition_id":  comp.id if comp else None,
        "competition_name": comp.name if comp else None,
        "district":        comp.district if comp else None,
        "class_name":      comp.class_name if comp else None,
        "hockey_type":     comp.hockey_type if comp else None,
        "own_standing": {
            "position":      own_standing.position,
            "played":        own_standing.played,
            "won":           own_standing.won,
            "drawn":         own_standing.drawn,
            "lost":          own_standing.lost,
            "goals_for":     own_standing.goals_for,
            "goals_against": own_standing.goals_against,
            "points":        own_standing.points,
        } if own_standing else None,
        "standings": [
            {
                "team_id": s.team_id, "team_name": s.team_name, "position": s.position,
                "played": s.played, "won": s.won, "drawn": s.drawn, "lost": s.lost,
                "goals_for": s.goals_for, "goals_against": s.goals_against, "points": s.points,
            }
            for s in standings
        ],
        "matches": [
            {
                "match_id": m.match_id, "home_team_id": m.home_team_id, "home_team_name": m.home_team_name,
                "away_team_id": m.away_team_id, "away_team_name": m.away_team_name,
                "match_date": m.match_date, "status": m.status,
                "home_score": m.home_score, "away_score": m.away_score, "round": m.round,
            }
            for m in matches
        ],
    }


@router.get("/teams/{team_id}/detail")
def get_team_detail(
    team_id: int,
    season: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Alle poule-koppelingen (primair + extra) van een team voor het
    opgegeven seizoen (default: actief serverdoelseizoen), met stand en
    wedstrijden per poule. Zie list_youth_teams (hockey_clubs.py) voor
    dezelfde season-membership-aanname bij een nog niet gevangen primaire
    poule."""
    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == team_id)).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team niet gevonden")

    target_season = season or get_target_season(session)

    poule_ids: list = []
    if team.recent_poule_id:
        poule_ids.append((team.recent_poule_id, True))
    extra_rows = session.exec(
        select(HockeyTeamPoule)
        .where(HockeyTeamPoule.team_id == team_id)
        .where(HockeyTeamPoule.season == target_season)
    ).all()
    for r in extra_rows:
        poule_ids.append((r.poule_id, False))

    poules_out = []
    seen_pids = set()
    for pid, is_primary in poule_ids:
        if pid in seen_pids:
            continue
        seen_pids.add(pid)
        poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == pid)).first()
        if poule is None:
            # Nog niet gevangen - alleen relevant voor het huidige seizoen
            # (zie list_youth_teams voor dezelfde aanname).
            if is_primary and target_season == get_target_season(session):
                poules_out.append({
                    "poule_id": pid, "poule_name": None, "season": target_season,
                    "is_primary": True, "captured": False,
                    "competition_id": None, "competition_name": None,
                    "district": None, "class_name": None, "hockey_type": None,
                    "own_standing": None, "standings": [], "matches": [],
                })
            continue
        if poule.season != target_season:
            continue
        poules_out.append(_poule_payload(session, poule, team_id, is_primary))

    return {
        "team": {
            "team_id":             team.team_id,
            "name":                team.name,
            "short_name":          team.short_name,
            "club_external_id":    team.club_external_id,
            "hockey_type":         team.hockey_type,
            "category_group_name": team.category_group_name,
        },
        "season": target_season,
        "poules": poules_out,
    }
