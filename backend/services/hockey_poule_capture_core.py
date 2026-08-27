"""Gedeelde kern voor poule-capture-upserts (refactor-plan hockey-inside
Fase 2a, RFTR-B2). Was 2x bijna-identiek geimplementeerd: routers/hockey_capture.py
(HTTP-pad) en services/hockey_vanger_ingest.py (raw-payload-pad). Dit is nu de
enige plek waar de upsert-domeinlogica leeft; de aanroepers blijven zelf
verantwoordelijk voor HTTP-zorgen (archivering, commit, response-vorm)."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING
import re

from sqlmodel import Session, select

from models.hockey_discovery import (
    HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding, HockeyTeam,
)

if TYPE_CHECKING:
    from routers.hockey_capture import PouleCaptureIn

_CAT_JUNIOR_RE = re.compile(r"^[zZ]?[JjMm][OoZz]\d")


def _derive_category(name: str) -> str:
    """Leidt category_group_name af uit teamnaam (J/M prefix = Junioren, H/D = Senioren)."""
    n = name.lstrip("z").lstrip("Z")
    if _CAT_JUNIOR_RE.match(name):
        return "Junioren"
    if n and n[0] in ("H", "h", "D", "d"):
        return "Senioren"
    return ""


@dataclass
class PouleCaptureResult:
    comp: HockeyCompetition
    poule: HockeyPoule
    poule_status: str
    teams_created: int = 0
    teams_updated: int = 0
    standings_saved: int = 0
    matches_saved: int = 0
    matches_played: int = 0


def apply_poule_capture(session: Session, body: "PouleCaptureIn", target_season: str) -> PouleCaptureResult:
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    ext_id = body.competition_name + "|" + (body.class_name or "") + "|" + (body.district or "") + "|" + body.season
    comp = session.exec(select(HockeyCompetition).where(HockeyCompetition.external_id == ext_id)).first()
    if comp:
        comp.class_name = body.class_name
        comp.district   = body.district or comp.district
        comp.updated_at = now
        if body.hockey_type:
            comp.hockey_type = body.hockey_type
        session.add(comp)
    else:
        base_prefix = body.competition_name + "|" + (body.class_name or "") + "|" + (body.district or "") + "|"
        prev_comp = session.exec(
            select(HockeyCompetition)
            .where(HockeyCompetition.external_id.like(base_prefix + "%"))
            .where(HockeyCompetition.season != body.season)
            .order_by(HockeyCompetition.season.desc())
        ).first()
        # Alleen hergebruiken als de rij nog geen poules van een ander seizoen
        # draagt - anders raken die poules gekoppeld aan een label dat niet meer
        # bij ze hoort (zie roadmap-melding: "Jongens O14 Lente" bleef aan een
        # oude 2025-2026-poule hangen nadat de rij naar 2026-2027 was omgezet).
        prev_comp_has_poules = bool(prev_comp) and session.exec(
            select(HockeyPoule.id).where(HockeyPoule.competition_id == prev_comp.id)
        ).first() is not None
        if prev_comp and not prev_comp_has_poules:
            prev_comp.external_id = ext_id
            prev_comp.season      = body.season
            prev_comp.updated_at  = now
            if body.hockey_type:
                prev_comp.hockey_type = body.hockey_type
            if body.district:
                prev_comp.district = body.district
            comp = prev_comp
            session.add(comp)
        else:
            comp = HockeyCompetition(
                external_id=ext_id, name=body.competition_name, class_name=body.class_name,
                district=body.district or None,
                hockey_type=body.hockey_type, season=body.season, discovered_at=now, updated_at=now,
            )
            session.add(comp)
    session.flush()

    poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == body.poule_id)).first()
    if poule:
        poule_status = "updated"
        poule.name = body.poule_name
        poule.competition_id = comp.id
        poule.updated_at = now
        poule.last_scanned_at = now
        session.add(poule)
    else:
        prev_poule = session.exec(
            select(HockeyPoule)
            .where(HockeyPoule.name == body.poule_name)
            .where(HockeyPoule.competition_id == comp.id)
        ).first()
        if prev_poule:
            prev_poule.poule_id        = body.poule_id
            prev_poule.season          = body.season
            prev_poule.updated_at      = now
            prev_poule.last_scanned_at = now
            poule = prev_poule
            poule_status = "deduped"
            session.add(poule)
        else:
            poule_status = "created"
            poule = HockeyPoule(
                poule_id=body.poule_id, name=body.poule_name, competition_id=comp.id,
                season=body.season, discovered_at=now, updated_at=now, last_scanned_at=now,
            )
            session.add(poule)

    standings_saved = 0
    if body.standings_data:
        for old in session.exec(select(HockeyPouleStanding).where(HockeyPouleStanding.poule_id == body.poule_id)).all():
            session.delete(old)
        for sd in body.standings_data:
            session.add(HockeyPouleStanding(
                poule_id=body.poule_id, team_id=sd.team_id, team_name=sd.team_name,
                position=sd.position, played=sd.played, won=sd.won, drawn=sd.drawn,
                lost=sd.lost, goals_for=sd.goals_for, goals_against=sd.goals_against,
                points=sd.points, updated_at=now,
            ))
        standings_saved = len(body.standings_data)

    matches_saved = 0
    matches_played = 0
    if body.matches_data:
        for old in session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == body.poule_id)).all():
            session.delete(old)
        for md in body.matches_data:
            is_fin = md.status == "final"
            session.add(HockeyPouleMatch(
                poule_id=body.poule_id, match_id=md.match_id,
                home_team_id=md.home_team_id, home_team_name=md.home_team_name,
                away_team_id=md.away_team_id, away_team_name=md.away_team_name,
                match_date=md.match_date, status=md.status,
                home_score=md.home_score if is_fin else None,
                away_score=md.away_score if is_fin else None,
                round=md.round, updated_at=now,
            ))
        matches_saved = len(body.matches_data)
        matches_played = sum(1 for m in body.matches_data if m.status == "final")

    is_target = body.season == target_season
    teams_created = teams_updated = 0
    for t_in in body.teams_in_poule:
        existing = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == t_in.id)).first()
        if existing:
            if is_target and existing.recent_poule_id != body.poule_id:
                existing.recent_poule_id        = body.poule_id
                existing.season_pending         = False
                existing.no_new_poule_confirmed = False
                existing.updated_at             = now
                session.add(existing)
                teams_updated += 1
        else:
            hockey_type = body.hockey_type or ("ZA" if t_in.name.startswith(("z", "Z")) else "VE")
            session.add(HockeyTeam(
                team_id=t_in.id, club_external_id=t_in.federation_reference_id or "",
                name=t_in.name, short_name=t_in.short_name or t_in.name,
                logo_url=t_in.logo, hockey_type=hockey_type,
                category_group_name=_derive_category(t_in.name),
                recent_poule_id=body.poule_id, season_pending=not is_target,
                discovered_at=now, updated_at=now,
            ))
            teams_created += 1

    if not is_target:
        for t in session.exec(select(HockeyTeam).where(HockeyTeam.recent_poule_id == body.poule_id)).all():
            t.season_pending = True
            session.add(t)

    return PouleCaptureResult(
        comp=comp, poule=poule, poule_status=poule_status,
        teams_created=teams_created, teams_updated=teams_updated,
        standings_saved=standings_saved, matches_saved=matches_saved,
        matches_played=matches_played,
    )
