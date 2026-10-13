"""Hockeydata - de lees-API voor andere producten (yearof, later teambeheer).

Item 1280: yearof leest hockeydata alleen nog via deze module en importeert
geen hockeymodellen of -routers meer. Alles gaat er als dict uit, nooit als
model, zodat dit later een HTTP-client kan worden (docs/yearof-architectuur.md
sectie 8 en 20). Nu in-process: elke functie krijgt de platformsessie.

poule_id is overal HockeyPoule.id (de interne id), niet de bond-poule-id.
"""

from typing import Optional

from sqlmodel import Session, select

from models.hockey_discovery import HockeyPoule, HockeyPouleMatch, HockeyPouleStanding
from services.hockey_query_scope import compute_win_streaks
from services.hockey_teams import club_logo_for_team, club_side_fields, ensure_club_colors, resolve_team_clubs


def serialize_poule_matches(session: Session, poule: HockeyPoule) -> dict:
    """Gespeelde en geplande wedstrijden van een poule, met logo's, club-id's en
    clubkleuren. Ook gebruikt door de openbare hockey-endpoints."""
    matches = session.exec(
        select(HockeyPouleMatch)
        .where(HockeyPouleMatch.poule_id == poule.poule_id)
        .order_by(HockeyPouleMatch.match_date, HockeyPouleMatch.match_id)
    ).all()
    finished  = [m for m in matches if m.status == "final"]
    scheduled = [m for m in matches if m.status != "final"]

    team_ids = {m.home_team_id for m in matches if m.home_team_id} | {m.away_team_id for m in matches if m.away_team_id}
    teams, clubs = resolve_team_clubs(session, list(team_ids))
    ensure_club_colors(session, clubs)

    def club_fields(m):
        return {**club_side_fields(teams, clubs, m.home_team_id, "home"),
                **club_side_fields(teams, clubs, m.away_team_id, "away")}

    return {
        "finished": [
            {
                "match_id":       m.match_id,
                "home":           m.home_team_name,
                "away":           m.away_team_name,
                "home_score":     m.home_score,
                "away_score":     m.away_score,
                "date":           m.match_date,
                "round":          m.round,
                "location":       m.location_name,
                **club_fields(m),
            }
            for m in finished
        ],
        "scheduled": [
            {
                "match_id":       m.match_id,
                "home":           m.home_team_name,
                "away":           m.away_team_name,
                "date":           m.match_date,
                "round":          m.round,
                "location":       m.location_name,
                **club_fields(m),
            }
            for m in scheduled
        ],
    }


def serialize_poule_standings(session: Session, poule: HockeyPoule) -> dict:
    """Stand van een poule met clublogo en winstreeks."""
    rows = session.exec(
        select(HockeyPouleStanding)
        .where(HockeyPouleStanding.poule_id == poule.poule_id)
        .order_by(HockeyPouleStanding.position, HockeyPouleStanding.points.desc())  # type: ignore[attr-defined]
    ).all()
    teams, clubs = resolve_team_clubs(session, [r.team_id for r in rows])
    streaks = compute_win_streaks(session, [poule.poule_id])
    return {
        "pool_name": poule.name,
        "ai_note":   poule.ai_note,
        "standings": [
            {"team_id": r.team_id, "team_name": r.team_name, "club_logo_url": club_logo_for_team(teams, clubs, r.team_id),
             "pts": r.points, "played": r.played, "won": r.won,
             "drawn": r.drawn, "lost": r.lost, "gf": r.goals_for, "ga": r.goals_against,
             "streak": streaks.get((poule.poule_id, r.team_id), 0),
             "ai_note": r.ai_note}
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# De lees-API (alleen dicts naar buiten)
# ---------------------------------------------------------------------------

def poule_info(session: Session, poule_id: int) -> Optional[dict]:
    poule = session.get(HockeyPoule, poule_id)
    if not poule:
        return None
    return {"id": poule.id, "poule_id": poule.poule_id, "name": poule.name}


def poule_matches(session: Session, poule_id: int) -> Optional[dict]:
    """{"finished": [...], "scheduled": [...]} of None als de poule onbekend is."""
    poule = session.get(HockeyPoule, poule_id)
    return serialize_poule_matches(session, poule) if poule else None


def poule_standings(session: Session, poule_id: int) -> Optional[dict]:
    """{"pool_name", "ai_note", "standings": [...]} of None als de poule onbekend is."""
    poule = session.get(HockeyPoule, poule_id)
    return serialize_poule_standings(session, poule) if poule else None


def team_id_in_poule(session: Session, poule_id: int, team_name: str) -> Optional[str]:
    """Team-id van een team in een poule (uit de stand), of None."""
    poule = session.get(HockeyPoule, poule_id)
    if not poule:
        return None
    standing = session.exec(
        select(HockeyPouleStanding)
        .where(HockeyPouleStanding.poule_id == poule.poule_id, HockeyPouleStanding.team_name == team_name)
    ).first()
    return standing.team_id if standing else None
