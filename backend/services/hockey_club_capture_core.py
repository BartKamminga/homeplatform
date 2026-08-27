"""Gedeelde kern voor club-detail- en club-lijst-upserts (refactor-plan
hockey-inside Fase 2b/2c, RFTR-B2). Was resp. 3x en 2x bijna-identiek
geimplementeerd verspreid over routers/hockey_clubs.py en
services/hockey_vanger_ingest.py."""

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlmodel import Session, select

from models.hockey_discovery import HockeyClub, HockeyTeam

if TYPE_CHECKING:
    from routers.hockey_clubs import ClubDetailIn


@dataclass
class ClubDetailResult:
    club: HockeyClub
    teams_created: int = 0
    teams_updated: int = 0
    teams_new_poule: int = 0
    teams_disappeared: int = 0
    youth_teams: int = 0


def apply_club_detail(session: Session, body: "ClubDetailIn") -> ClubDetailResult:
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == body.federation_reference_id)).first()
    club = existing or HockeyClub(external_id=body.federation_reference_id, discovered_at=now)
    if body.name:          club.name          = body.name
    if body.friendly_name: club.friendly_name = body.friendly_name
    club.city     = body.city
    club.logo_url = body.logo
    club.address  = body.address
    club.zipcode  = body.zipcode
    club.phone    = body.phone
    club.email    = body.email
    club.website  = body.website
    club.tenue    = body.tenue
    club.district = body.district
    club.payment_options = (
        json.dumps(body.payment_options, ensure_ascii=False)
        if isinstance(body.payment_options, list) else body.payment_options
    )
    club.parking = body.parking
    club.hockey_types = (
        json.dumps(body.hockey_types, ensure_ascii=False)
        if isinstance(body.hockey_types, list) else body.hockey_types
    )
    club.detail_loaded = True
    club.updated_at = now
    club.last_scanned_at = now
    session.add(club)

    known_team_ids = {t.team_id for t in session.exec(
        select(HockeyTeam).where(HockeyTeam.club_external_id == body.federation_reference_id)
    ).all()}
    incoming_team_ids = {ti.id for ti in body.teams}

    teams_created = teams_updated = teams_new_poule = youth_teams = 0
    for team_in in body.teams:
        if team_in.category_group_name == "Junioren":
            youth_teams += 1
        existing_team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == team_in.id)).first()
        if existing_team:
            if team_in.name:       existing_team.name       = team_in.name
            if team_in.short_name: existing_team.short_name = team_in.short_name
            existing_team.logo_url            = team_in.logo
            existing_team.hockey_type         = team_in.hockey_type
            existing_team.category_group_name = team_in.category_group_name
            # Alleen overschrijven bij een echte (nieuwe, niet-lege) poule-id -
            # voorheen overschreef de router-variant hier onvoorwaardelijk, wat
            # een bestaande recent_poule_id naar None kon vegen als een detail-
            # scan toevallig zonder recent_poule_id binnenkwam (RFTR-B2-fix,
            # samenvoeging met de al defensieve service-variant).
            if team_in.recent_poule_id and team_in.recent_poule_id != existing_team.recent_poule_id:
                existing_team.recent_poule_id        = team_in.recent_poule_id
                existing_team.no_new_poule_confirmed = False
                existing_team.season_pending         = False
                teams_new_poule += 1
            existing_team.updated_at      = now
            existing_team.last_scanned_at = now
            session.add(existing_team)
            teams_updated += 1
        else:
            teams_created += 1
            session.add(HockeyTeam(
                team_id=team_in.id, club_external_id=body.federation_reference_id,
                name=team_in.name, short_name=team_in.short_name,
                logo_url=team_in.logo, hockey_type=team_in.hockey_type,
                category_group_name=team_in.category_group_name,
                recent_poule_id=team_in.recent_poule_id,
                discovered_at=now, updated_at=now, last_scanned_at=now,
            ))

    return ClubDetailResult(
        club=club, teams_created=teams_created, teams_updated=teams_updated,
        teams_new_poule=teams_new_poule, youth_teams=youth_teams,
        teams_disappeared=len(known_team_ids - incoming_team_ids),
    )


@dataclass
class ClubsListResult:
    clubs_found: int
    clubs_created: int = 0
    clubs_updated: int = 0


def apply_clubs_list(session: Session, clubs: list) -> ClubsListResult:
    """clubs: lijst van dicts met minstens federation_reference_id/name/
    friendly_name (accepteert zowel federation_reference_id als het oudere
    external_id-alias, en zowel logo als logo_url / type als club_type -
    superset van de 2 eerdere varianten die deze vervangt)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    clubs_created = clubs_updated = 0
    for item in clubs:
        if not isinstance(item, dict):
            continue
        ext_id = item.get("federation_reference_id") or item.get("external_id")
        if not ext_id:
            continue
        existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == ext_id)).first()
        if existing:
            if item.get("name"):          existing.name          = item["name"]
            if item.get("friendly_name"): existing.friendly_name = item["friendly_name"]
            existing.city      = item.get("city")
            existing.logo_url  = item.get("logo") or item.get("logo_url")
            existing.club_type = item.get("type") or item.get("club_type") or existing.club_type
            existing.updated_at = now
            session.add(existing)
            clubs_updated += 1
        else:
            session.add(HockeyClub(
                external_id=ext_id,
                name=item.get("name", ""),
                friendly_name=item.get("friendly_name"),
                city=item.get("city"),
                logo_url=item.get("logo") or item.get("logo_url"),
                club_type=item.get("type") or item.get("club_type"),
                discovered_at=now,
                updated_at=now,
            ))
            clubs_created += 1
    return ClubsListResult(clubs_found=len(clubs), clubs_created=clubs_created, clubs_updated=clubs_updated)
