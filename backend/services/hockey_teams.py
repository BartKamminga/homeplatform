"""Team -> club resolutie (voor clublogo's) voor Hockey Discovery-standings."""

from sqlmodel import Session, col, select

from models.hockey_discovery import HockeyClub, HockeyTeam


def resolve_team_clubs(session: Session, team_ids: list):
    """team_id -> HockeyTeam en club_external_id -> HockeyClub, voor de gegeven team_ids."""
    if not team_ids:
        return {}, {}
    teams = {
        t.team_id: t for t in session.exec(
            select(HockeyTeam).where(col(HockeyTeam.team_id).in_(team_ids))
        ).all()
    }
    club_ext_ids = [t.club_external_id for t in teams.values()]
    clubs = {
        c.external_id: c for c in session.exec(
            select(HockeyClub).where(col(HockeyClub.external_id).in_(club_ext_ids))
        ).all()
    } if club_ext_ids else {}
    return teams, clubs


def club_logo_for_team(teams: dict, clubs: dict, team_id):
    """Logo-URL van de club achter dit team_id, of None als onbekend."""
    team = teams.get(team_id)
    club = clubs.get(team.club_external_id) if team else None
    return club.logo_url if club else None
