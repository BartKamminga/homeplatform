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


def club_for_team(teams: dict, clubs: dict, team_id):
    """HockeyClub achter dit team_id, of None als onbekend."""
    team = teams.get(team_id)
    return clubs.get(team.club_external_id) if team else None


def ensure_club_colors(session: Session, clubs: dict, limit: int = 8) -> None:
    """Bepaal 1x de kleur uit het logo voor clubs die er nog geen hebben
    (primary_color None). Mislukt = '' en wordt niet opnieuw geprobeerd.
    Hooguit `limit` logo's per verzoek, zodat een grote poulelijst niet traag
    wordt - de rest volgt bij de volgende verzoeken."""
    from services.club_colors import color_from_logo_url

    todo = [c for c in clubs.values() if c.logo_url and c.primary_color is None][:limit]
    for club in todo:
        club.primary_color = color_from_logo_url(club.logo_url)
        session.add(club)
    if todo:
        session.commit()


def club_side_fields(teams: dict, clubs: dict, team_id, side: str) -> dict:
    """Logo, id en kleur van de club van 1 kant ('home'/'away') van een wedstrijd."""
    from services.club_colors import effective_color

    club = club_for_team(teams, clubs, team_id)
    return {
        f"{side}_club_logo": club.logo_url if club else None,
        f"{side}_club_id": club.external_id if club else None,
        f"{side}_club_color": effective_color(club),
    }
