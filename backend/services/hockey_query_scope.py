"""Scoping-helpers voor de poulebord query-templates (routers/hockey_query.py)."""

from typing import List, Optional

from sqlmodel import Session, col, select

from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch
from services.hockey_scope import get_publication_links

# stat -> (sleutel-functie, reverse) — reverse=True is "hoogste eerst"
# "streak" (winstreak) staat er niet in: die vergt wedstrijdgeschiedenis i.p.v.
# een standings-veld en wordt apart afgehandeld in get_tag_ranking (item 673 -
# was een losse win-streak-template, nu een stat-optie op de ranglijst).
RANKING_STATS = {
    "points":        (lambda r: r.points, True),
    "goal_diff":     (lambda r: r.goals_for - r.goals_against, True),
    "goals_for":     (lambda r: r.goals_for, True),
    "goals_against": (lambda r: r.goals_against, False),
    "won":           (lambda r: r.won, True),
    "drawn":         (lambda r: r.drawn, True),
}
ALL_RANKING_STATS = set(RANKING_STATS) | {"streak"}

ROUND_TEAM_STATS = {"goals_for", "goals_against"}
ROUND_MATCH_STATS = {"biggest_margin", "closest_match"}


def scoped_poules(session: Session, tid: str, tags: Optional[List[str]]):
    """Poules (+ hun competitie) van alle zichtbare comp-koppelingen in een publicatie, evt. gefilterd op 1+ tags (AND: moet ze allemaal hebben)."""
    links = get_publication_links(session, tid, tags)
    comp_ids = [lnk.competition_id for lnk in links]
    if not comp_ids:
        return []
    comps = {
        c.id: c for c in session.exec(
            select(HockeyCompetition).where(col(HockeyCompetition.id).in_(comp_ids))
        ).all()
    }
    poules = session.exec(
        select(HockeyPoule).where(col(HockeyPoule.competition_id).in_(comp_ids))
    ).all()
    return [(p, comps.get(p.competition_id)) for p in poules]


def finished_matches(session: Session, poule_ext_ids: list):
    """Alle afgeronde wedstrijden van de gekozen poules (heel seizoen tot nu toe)."""
    return session.exec(
        select(HockeyPouleMatch)
        .where(col(HockeyPouleMatch.poule_id).in_(poule_ext_ids))
        .where(HockeyPouleMatch.status == "finished")
    ).all()


def last_round_only(matches: list):
    """Beperk tot de laatst gespeelde ronde, per poule."""
    last_round: dict = {}
    for m in matches:
        if m.round is None:
            continue
        if m.round > last_round.get(m.poule_id, -1):
            last_round[m.poule_id] = m.round
    return [m for m in matches if last_round.get(m.poule_id) == m.round], last_round


def scoped_matches(session: Session, poule_ext_ids: list, scope: str):
    """Wedstrijden binnen de gekozen scope: 'round' (laatste ronde per poule) of 'season' (heel seizoen)."""
    all_matches = finished_matches(session, poule_ext_ids)
    if scope == "round":
        return last_round_only(all_matches)
    return all_matches, {}


def compute_win_streaks(session: Session, poule_ext_ids: list):
    """Actieve overwinningsreeks per (poule_id, team_id) - alleen teams met een lopende streak > 0."""
    matches = finished_matches(session, poule_ext_ids)

    games_by_team: dict = {}  # (poule_id, team_id) -> [(round, result), ...]
    for m in matches:
        if m.round is None or m.home_score is None or m.away_score is None:
            continue
        if m.home_team_id is not None:
            result = "W" if m.home_score > m.away_score else ("L" if m.home_score < m.away_score else "D")
            games_by_team.setdefault((m.poule_id, m.home_team_id), []).append((m.round, result))
        if m.away_team_id is not None:
            result = "W" if m.away_score > m.home_score else ("L" if m.away_score < m.home_score else "D")
            games_by_team.setdefault((m.poule_id, m.away_team_id), []).append((m.round, result))

    streaks: dict = {}
    for key, games in games_by_team.items():
        games.sort(key=lambda g: g[0])
        streak = 0
        for _, result in reversed(games):
            if result != "W":
                break
            streak += 1
        if streak > 0:
            streaks[key] = streak
    return streaks
