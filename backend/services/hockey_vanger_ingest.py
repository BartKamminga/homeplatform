"""Vanger raw-data-parsers + capture-verwerking (poule/club/competitie) -
verplaatst uit routers/hockey_vanger.py (item 696). Zet ruwe payloads van de
vanger-extensie om naar domeinmodellen (HockeyPoule/HockeyTeam/HockeyClub/...)."""

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlmodel import Session, col, select

from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch,
    HockeyPouleStanding, HockeyTeam, VangerCmd,
)
from routers.hockey_capture import (
    MatchIn, PouleCaptureIn, StandingIn, TeamInPoule,
    _derive_category, _get_target_season,
)
from routers.hockey_clubs import ClubDetailIn, TeamIn


def _release_stale_hl_comp_id(session: Session, hl_cid: Optional[int], keep_id: Optional[int]) -> None:
    """Voorkomt dat twee competities hetzelfde hl_comp_id dragen (roadmap-melding:
    "Landelijk Jongens O16" hield per ongeluk het hl_comp_id van "Gold Cup Dames"
    vast, waardoor het scanplan bij elke landelijke-comp-scan de verkeerde data
    ophaalde). hockey.nl-competitie-ids zijn uniek, dus zodra een nummer opnieuw
    wordt toegekend is elke andere rij die het nog droeg per definitie fout."""
    if not hl_cid:
        return
    for c in session.exec(select(HockeyCompetition).where(HockeyCompetition.hl_comp_id == hl_cid)).all():
        if c.id != keep_id:
            c.hl_comp_id = None
            session.add(c)


def _season_from_date(date_str: str) -> Optional[str]:
    """NL hockeyseizoen loopt van zomer tot zomer (Sep t/m Jun) - juli/aug tellen als start nieuw seizoen."""
    try:
        dt = datetime.fromisoformat(date_str)
    except (TypeError, ValueError):
        return None
    year = dt.year
    return f"{year}-{year + 1}" if dt.month >= 7 else f"{year - 1}-{year}"


def _parse_raw_poule(raw: dict, params: dict, target_season: Optional[str] = None) -> Optional[PouleCaptureIn]:
    try:
        poule_data = raw["data"]["data"]["poule"]
        comp       = poule_data.get("competition") or {}
        subcomp    = comp.get("subcompetition") or {}

        teams_list:    List[TeamInPoule] = []
        standings_list: List[StandingIn] = []
        matches_list:   List[MatchIn]    = []

        for s in poule_data.get("standings") or []:
            st = s.get("team") or {}
            if not st.get("id"):
                continue
            teams_list.append(TeamInPoule(
                id=st["id"],
                name=st.get("name", ""),
                short_name=st.get("short_name") or st.get("name", ""),
                logo=st.get("logo"),
                federation_reference_id=st.get("federation_reference_id"),
            ))
            standings_list.append(StandingIn(
                team_id=st["id"],
                team_name=st.get("name", ""),
                position=s.get("position") or s.get("rank"),
                played=s.get("played") or s.get("games_played") or 0,
                won=s.get("won") or s.get("wins") or 0,
                drawn=s.get("draw") or s.get("drawn") or s.get("draws") or 0,
                lost=s.get("lost") or s.get("losses") or 0,
                goals_for=s.get("goals_for") or s.get("gf") or s.get("goals_scored") or 0,
                goals_against=s.get("goals_against") or s.get("ga") or s.get("goals_conceded") or 0,
                points=s.get("points") or s.get("pts") or 0,
            ))

        for m in poule_data.get("matches") or []:
            ht  = m.get("home_team") or m.get("homeTeam") or m.get("home") or {}
            at  = m.get("away_team") or m.get("awayTeam") or m.get("away") or {}
            sc  = m.get("score") or {}
            home_score = m["home_score"] if m.get("home_score") is not None else sc.get("home")
            away_score = m["away_score"] if m.get("away_score") is not None else sc.get("away")
            matches_list.append(MatchIn(
                match_id=m.get("id"),
                home_team_id=ht.get("id"),
                home_team_name=ht.get("name", ""),
                away_team_id=at.get("id"),
                away_team_name=at.get("name", ""),
                match_date=m.get("date"),
                status=m.get("status", ""),
                home_score=home_score,
                away_score=away_score,
                round=m.get("round") or m.get("round_number"),
            ))

        hockey_type = raw.get("hockey_type", "")
        if not hockey_type:
            name = poule_data.get("name", "")
            hockey_type = "ZA" if name.lower().startswith("z") else "VE"

        # Datum van de wedstrijden zelf is leidend, niet raw["seizoen"] (dat
        # reflecteert de site-context van de pagina die gescand is, niet per se
        # het seizoen van de getoonde poule - zie roadmap-melding: een lente-poule
        # (maart-juni) kreeg zo het "actieve" seizoen van de scan-datum in augustus).
        match_dates = sorted(m.match_date for m in matches_list if m.match_date)
        season = _season_from_date(match_dates[0]) if match_dates else None
        if not season:
            season = raw.get("seizoen")
        if not season:
            season = target_season or "2026-2027"

        return PouleCaptureIn(
            poule_id=params["poule_id"],
            poule_name=poule_data.get("name", ""),
            competition_name=comp.get("name", ""),
            class_name=subcomp.get("class") or comp.get("class_name", ""),
            district=comp.get("district_name") or comp.get("district") or "",
            hockey_type=hockey_type,
            season=season,
            teams_in_poule=teams_list,
            standings_data=standings_list,
            matches_data=matches_list,
        )
    except Exception:
        return None


def _parse_raw_club(raw: dict, params: dict) -> Optional[ClubDetailIn]:
    try:
        d = raw.get("data") or raw
        teams: List[TeamIn] = []
        for t in d.get("teams") or []:
            teams.append(TeamIn(
                id=t["id"],
                name=t.get("name", ""),
                short_name=t.get("short_name") or t.get("name", ""),
                logo=t.get("logo"),
                hockey_type=t.get("hockey_type", ""),
                category_group_name=t.get("category_group_name", ""),
                recent_poule_id=t.get("recent_poule_id"),
            ))
        return ClubDetailIn(
            federation_reference_id=d.get("federation_reference_id") or params.get("external_id", ""),
            name=d.get("name", ""),
            friendly_name=d.get("friendly_name") or d.get("name", ""),
            city=d.get("city"),
            logo=d.get("logo"),
            address=d.get("address"),
            zipcode=d.get("zipcode"),
            phone=d.get("phone"),
            email=d.get("email"),
            website=d.get("website"),
            tenue=d.get("tenue"),
            district=d.get("district"),
            payment_options=d.get("payment_options"),
            parking=d.get("parking"),
            hockey_types=d.get("hockey_types"),
            teams=teams,
        )
    except Exception:
        return None


# ── Internal _call_* helpers (no HTTP layer) ─────────────

def _call_poule_capture(body: PouleCaptureIn, session: Session):
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
            session.add(prev_poule)
        else:
            session.add(HockeyPoule(
                poule_id=body.poule_id, name=body.poule_name, competition_id=comp.id,
                season=body.season, discovered_at=now, updated_at=now, last_scanned_at=now,
            ))

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

    target_season = _get_target_season(session)
    is_target = body.season == target_season
    for t_in in body.teams_in_poule:
        existing = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == t_in.id)).first()
        if existing:
            if is_target and existing.recent_poule_id != body.poule_id:
                existing.recent_poule_id        = body.poule_id
                existing.season_pending         = False
                existing.no_new_poule_confirmed = False
                existing.updated_at             = now
                session.add(existing)
        else:
            ht = body.hockey_type or ("ZA" if t_in.name.startswith(("z", "Z")) else "VE")
            session.add(HockeyTeam(
                team_id=t_in.id, club_external_id=t_in.federation_reference_id or "",
                name=t_in.name, short_name=t_in.short_name or t_in.name,
                logo_url=t_in.logo, hockey_type=ht,
                category_group_name=_derive_category(t_in.name),
                recent_poule_id=body.poule_id, season_pending=not is_target,
                discovered_at=now, updated_at=now,
            ))

    if not is_target:
        for t in session.exec(select(HockeyTeam).where(HockeyTeam.recent_poule_id == body.poule_id)).all():
            t.season_pending = True
            session.add(t)

    matches_played = sum(1 for m in (body.matches_data or []) if m.status == "final")
    return {
        "teams":          len(body.teams_in_poule),
        "standings":      len(body.standings_data or []),
        "matches_total":  len(body.matches_data or []),
        "matches_played": matches_played,
        "competition":    body.competition_name,
        "season":         body.season,
    }


def _call_club_detail(body: ClubDetailIn, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == body.federation_reference_id)).first()
    club = existing or HockeyClub(external_id=body.federation_reference_id, discovered_at=now)
    if body.name:         club.name          = body.name
    if body.friendly_name: club.friendly_name = body.friendly_name
    club.city = body.city
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

    known_team_ids    = {t.team_id for t in session.exec(
        select(HockeyTeam).where(HockeyTeam.club_external_id == body.federation_reference_id)
    ).all()}
    incoming_team_ids = {ti.id for ti in body.teams}

    teams_added = teams_new_poule = 0
    for team_in in body.teams:
        existing_team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == team_in.id)).first()
        if existing_team:
            if team_in.name:       existing_team.name       = team_in.name
            if team_in.short_name: existing_team.short_name = team_in.short_name
            existing_team.logo_url             = team_in.logo
            existing_team.hockey_type          = team_in.hockey_type
            existing_team.category_group_name  = team_in.category_group_name
            if team_in.recent_poule_id and team_in.recent_poule_id != existing_team.recent_poule_id:
                existing_team.recent_poule_id        = team_in.recent_poule_id
                existing_team.no_new_poule_confirmed = False
                existing_team.season_pending         = False
                teams_new_poule += 1
            existing_team.updated_at      = now
            existing_team.last_scanned_at = now
            session.add(existing_team)
        else:
            teams_added += 1
            session.add(HockeyTeam(
                team_id=team_in.id, club_external_id=body.federation_reference_id,
                name=team_in.name, short_name=team_in.short_name,
                logo_url=team_in.logo, hockey_type=team_in.hockey_type,
                category_group_name=team_in.category_group_name,
                recent_poule_id=team_in.recent_poule_id,
                discovered_at=now, updated_at=now, last_scanned_at=now,
            ))

    return {
        "teams_found":       len(body.teams),
        "teams_added":       teams_added,
        "teams_new_poule":   teams_new_poule,
        "teams_disappeared": len(known_team_ids - incoming_team_ids),
    }


def _call_clubs_list(clubs: list, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    clubs_added = clubs_updated = 0
    for item in clubs:
        ext_id = item.get("federation_reference_id")
        if not ext_id:
            continue
        existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == ext_id)).first()
        if existing:
            changed = False
            if existing.name != item.get("name"):
                existing.name = item.get("name"); changed = True
            if existing.friendly_name != item.get("friendly_name"):
                existing.friendly_name = item.get("friendly_name"); changed = True
            if existing.city != item.get("city"):
                existing.city = item.get("city"); changed = True
            if existing.logo_url != item.get("logo"):
                existing.logo_url = item.get("logo"); changed = True
            if changed:
                existing.updated_at = now
                session.add(existing)
                clubs_updated += 1
        else:
            session.add(HockeyClub(
                external_id=ext_id,
                name=item.get("name"),
                friendly_name=item.get("friendly_name"),
                city=item.get("city"),
                logo_url=item.get("logo"),
                discovered_at=now,
                updated_at=now,
            ))
            clubs_added += 1
    return {"clubs_found": len(clubs), "clubs_added": clubs_added, "clubs_updated": clubs_updated}


def _call_competition_detail(raw: dict, session: Session, params: dict):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        data  = raw.get("data") or {}
        inner = data.get("data") or {}
        comp_name   = inner.get("name") or params.get("label", "Onbekend")
        poules_list = inner.get("poules") or []
    except Exception:
        return None

    if not isinstance(poules_list, list) or not poules_list:
        return None

    fallback_season = ""
    for _pd in poules_list:
        for _m in (_pd.get("matches") or []):
            _d = ((_m.get("date") or ""))[:10]
            if len(_d) >= 7:
                try:
                    _y, _mo = int(_d[:4]), int(_d[5:7])
                    fallback_season = f"{_y}-{_y+1}" if _mo >= 8 else f"{_y-1}-{_y}"
                except Exception:
                    pass
            if fallback_season:
                break
        if fallback_season:
            break

    _canonical_class = _canonical_district = ""
    for _pd in poules_list:
        _ci = _pd.get("competition") or {}
        if _ci.get("class_name"):
            _canonical_class    = _ci.get("class_name", "")
            _canonical_district = _ci.get("district_name") or _ci.get("district") or ""
            break

    poules_processed = 0
    teams_found_set: set = set()
    current_poule_map: Dict[int, int] = {}

    for poule_data in poules_list:
        poule_id   = poule_data.get("id")
        poule_name = poule_data.get("name", "")
        class_name = _canonical_class or "Landelijk"
        district   = _canonical_district

        matches = poule_data.get("matches") or []
        season  = ""
        for m in matches:
            d_str = (m.get("date") or "")[:10]
            if len(d_str) >= 7:
                try:
                    y, mo = int(d_str[:4]), int(d_str[5:7])
                    season = f"{y}-{y+1}" if mo >= 8 else f"{y-1}-{y}"
                    break
                except Exception:
                    pass
        if not season:
            season = fallback_season

        ext_id   = comp_name + "|" + (class_name or "") + "|" + (district or "") + "|" + (season or "onbekend")
        hl_cid   = params.get("comp_id")
        comp_row = session.exec(select(HockeyCompetition).where(HockeyCompetition.external_id == ext_id)).first()
        if comp_row:
            comp_row.class_name = class_name or comp_row.class_name
            comp_row.district   = district or comp_row.district
            if hl_cid:
                _release_stale_hl_comp_id(session, hl_cid, keep_id=comp_row.id)
                comp_row.hl_comp_id = hl_cid
            comp_row.updated_at = now
            session.add(comp_row)
        else:
            _release_stale_hl_comp_id(session, hl_cid, keep_id=None)
            comp_row = HockeyCompetition(
                external_id=ext_id, name=comp_name, class_name=class_name,
                district=district or None,
                hockey_type="VE", season=season or "onbekend",
                hl_comp_id=hl_cid, discovered_at=now, updated_at=now,
            )
            session.add(comp_row)
        session.flush()

        if poule_id:
            poule_row = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == poule_id)).first()
            if poule_row:
                poule_row.name = poule_name
                poule_row.competition_id = comp_row.id
                poule_row.updated_at = now
                poule_row.last_scanned_at = now
                session.add(poule_row)
            else:
                session.add(HockeyPoule(
                    poule_id=poule_id, name=poule_name, competition_id=comp_row.id,
                    season=season or "onbekend", discovered_at=now, updated_at=now,
                    last_scanned_at=now,
                ))

        standings = poule_data.get("standings") or []
        if standings and poule_id:
            for old in session.exec(select(HockeyPouleStanding).where(HockeyPouleStanding.poule_id == poule_id)).all():
                session.delete(old)
            for s in standings:
                team = s.get("team") or {}
                tid  = team.get("id")
                if tid:
                    teams_found_set.add(tid)
                    ht_row = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == tid)).first()
                    if not ht_row:
                        session.add(HockeyTeam(
                            team_id=tid,
                            club_external_id=team.get("federation_reference_id") or "",
                            name=team.get("name", ""),
                            short_name=team.get("short_name") or team.get("name", ""),
                            logo_url=team.get("logo"),
                            hockey_type=team.get("hockey_type") or "VE",
                            category_group_name=_derive_category(team.get("name", "")),
                            discovered_at=now, updated_at=now,
                        ))
                    elif not ht_row.club_external_id and team.get("federation_reference_id"):
                        ht_row.club_external_id = team["federation_reference_id"]
                        ht_row.updated_at = now
                        session.add(ht_row)
                session.add(HockeyPouleStanding(
                    poule_id=poule_id, team_id=tid or 0, team_name=team.get("name", ""),
                    position=s.get("rank"), played=s.get("played", 0),
                    won=s.get("wins", 0), drawn=s.get("draws", 0), lost=s.get("losses", 0),
                    goals_for=s.get("goals_for", 0), goals_against=s.get("goals_against", 0),
                    points=s.get("points", 0), updated_at=now,
                ))

        if matches and poule_id:
            for old in session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule_id)).all():
                session.delete(old)
            for m in matches:
                home = m.get("home") or {}
                away = m.get("away") or {}
                for side in [home, away]:
                    rpid = side.get("recent_poule_id")
                    tid  = side.get("id")
                    if rpid and tid and rpid not in current_poule_map:
                        current_poule_map[rpid] = tid
                score    = m.get("score") or {}
                is_final = m.get("status") == "final"
                loc      = (m.get("location") or {})
                facility = (loc.get("facility") or {})
                field    = (loc.get("field") or {})
                session.add(HockeyPouleMatch(
                    poule_id=poule_id, match_id=m.get("id"),
                    home_team_id=home.get("id"), home_team_name=home.get("name", ""),
                    away_team_id=away.get("id"), away_team_name=away.get("name", ""),
                    match_date=m.get("date"), status=m.get("status", ""),
                    home_score=score.get("home") if is_final else None,
                    away_score=score.get("away") if is_final else None,
                    round=m.get("round"),
                    location_name=facility.get("name"),
                    field_type=field.get("type"),
                    updated_at=now,
                ))

        poules_processed += 1

    captured_poule_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}
    pending_cmds = session.exec(
        select(VangerCmd).where(
            VangerCmd.cmd_type == "get_poule",
            col(VangerCmd.status).in_(["pending", "in_progress"]),
        )
    ).all()
    pending_poule_ids: set = set()
    for c in pending_cmds:
        try:
            pending_poule_ids.add(json.loads(c.params).get("poule_id"))
        except Exception:
            pass

    cmds_queued = 0
    for rpid, team_id in current_poule_map.items():
        if rpid in captured_poule_ids or rpid in pending_poule_ids:
            continue
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": rpid, "team_id": team_id, "label": comp_name + " #" + str(rpid)}),
            created_at=now,
        ))
        cmds_queued += 1

    return {
        "poules_processed":      poules_processed,
        "teams_found":           len(teams_found_set),
        "get_poule_cmds_queued": cmds_queued,
        "competition":           comp_name,
    }


def _call_competitions_list(raw: dict, session: Session):
    """get_competitions navigeert naar hockey.nl's /search/competition, wat
    behalve de echte /competitions/national-lijst (platte objecten met
    id/name/class_name/poule_id) soms ook een gemixte team/competitie/club-
    zoekresultatenlijst oplevert (elk item heeft dan "team"/"competition"/
    "club" gevuld, de rest null) - Ghost's response-capture kon dat voorheen
    niet onderscheiden (roadmap-melding: "10 competities gevonden zonder
    naam", en zie interceptor.js's isCompetitionList voor hetzelfde
    onderscheid aan de Scout-kant). Hier per item beide vormen herkennen."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        items = raw.get("competitions") or raw.get("data") or []
        if not isinstance(items, list):
            return None
    except Exception:
        return None

    target_season = _get_target_season(session)
    upserted = 0
    skipped  = 0
    for item in items:
        if not isinstance(item, dict):
            skipped += 1
            continue
        if isinstance(item.get("id"), int) and isinstance(item.get("class_name"), str) \
                and "federation_reference_id" not in item:
            comp_id, name, class_name = item.get("id"), item.get("name"), item.get("class_name") or ""
        else:
            comp = item.get("competition")
            comp_id    = comp.get("id") if isinstance(comp, dict) else None
            name       = comp.get("name") if isinstance(comp, dict) else None
            class_name = (comp.get("class_name") or "") if isinstance(comp, dict) else ""
        if not comp_id or not name:
            skipped += 1
            continue
        ht = "ZA" if "Zaal" in name else "VE"

        # Matchen op (naam, klasse, seizoen) i.p.v. een zelfgebouwde
        # naam|seizoen-sleutel - overal elders in de app is de external_id
        # naam|klasse|district|seizoen (4 delen), en get_competitions kent
        # het district van een landelijke competitie sowieso niet. Matchen op
        # de letterlijke external_id-string vond de al bestaande, echte rij
        # (met poules) dus nooit en maakte steeds een kale duplicaat aan
        # (roadmap-melding: "ONBEKEND · Geen poules"-rijen naast de echte).
        existing = session.exec(
            select(HockeyCompetition)
            .where(HockeyCompetition.name == name)
            .where(HockeyCompetition.class_name == class_name)
            .where(HockeyCompetition.season == target_season)
        ).first()
        if existing:
            _release_stale_hl_comp_id(session, comp_id, keep_id=existing.id)
            existing.hl_comp_id = comp_id
            existing.updated_at = now
            session.add(existing)
        else:
            _release_stale_hl_comp_id(session, comp_id, keep_id=None)
            session.add(HockeyCompetition(
                external_id=name + "|" + class_name + "||" + target_season,
                name=name,
                class_name=class_name,
                hockey_type=ht,
                season=target_season,
                hl_comp_id=comp_id,
                discovered_at=now,
                updated_at=now,
            ))
        upserted += 1

    session.commit()
    return {"competitions_found": len(items), "upserted": upserted, "skipped": skipped}


def _call_clubs_list_raw(raw_list: list, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    created = updated = 0
    for club_in in raw_list:
        if not isinstance(club_in, dict):
            continue
        ref_id = club_in.get("federation_reference_id") or club_in.get("external_id")
        if not ref_id:
            continue
        existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == ref_id)).first()
        if existing:
            if club_in.get("name"):          existing.name          = club_in["name"]
            if club_in.get("friendly_name"): existing.friendly_name = club_in["friendly_name"]
            existing.city      = club_in.get("city")
            existing.logo_url  = club_in.get("logo") or club_in.get("logo_url")
            existing.club_type = club_in.get("type") or club_in.get("club_type")
            existing.updated_at = now
            session.add(existing)
            updated += 1
        else:
            session.add(HockeyClub(
                external_id=ref_id,
                name=club_in.get("name", ""),
                friendly_name=club_in.get("friendly_name"),
                city=club_in.get("city"),
                logo_url=club_in.get("logo") or club_in.get("logo_url"),
                club_type=club_in.get("type") or club_in.get("club_type"),
                discovered_at=now,
                updated_at=now,
            ))
            created += 1
    return {"created": created, "updated": updated}


def _call_club_detail_raw(raw: dict, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ref_id = raw.get("federation_reference_id")
    if not ref_id:
        return None

    existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == ref_id)).first()
    club = existing or HockeyClub(external_id=ref_id, discovered_at=now)
    if raw.get("name"):          club.name          = raw["name"]
    if raw.get("friendly_name"): club.friendly_name = raw["friendly_name"]
    club.city     = raw.get("city")
    club.logo_url = raw.get("logo")
    club.address  = raw.get("address")
    club.zipcode  = raw.get("zipcode")
    club.phone    = raw.get("phone")
    club.email    = raw.get("email")
    club.website  = raw.get("website")
    club.tenue    = raw.get("tenue")
    club.district = raw.get("district")
    club.detail_loaded   = True
    club.updated_at      = now
    club.last_scanned_at = now
    _po = raw.get("payment_options")
    club.payment_options = json.dumps(_po, ensure_ascii=False) if isinstance(_po, list) else _po
    _ht = raw.get("hockey_types")
    club.hockey_types    = json.dumps(_ht, ensure_ascii=False) if isinstance(_ht, list) else _ht
    session.add(club)

    teams_created = teams_updated = 0
    for team_in in (raw.get("teams") or []):
        if not isinstance(team_in, dict):
            continue
        tid = team_in.get("id")
        if not tid:
            continue
        existing_team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == tid)).first()
        if existing_team:
            if team_in.get("name"):       existing_team.name       = team_in["name"]
            if team_in.get("short_name"): existing_team.short_name = team_in["short_name"]
            existing_team.logo_url            = team_in.get("logo")
            existing_team.hockey_type         = team_in.get("hockey_type", "")
            existing_team.category_group_name = team_in.get("category_group_name", "")
            if team_in.get("recent_poule_id") != existing_team.recent_poule_id:
                existing_team.recent_poule_id        = team_in.get("recent_poule_id")
                existing_team.no_new_poule_confirmed = False
                existing_team.season_pending         = False
            existing_team.updated_at      = now
            existing_team.last_scanned_at = now
            session.add(existing_team)
            teams_updated += 1
        else:
            session.add(HockeyTeam(
                team_id=tid,
                club_external_id=ref_id,
                name=team_in.get("name", ""),
                short_name=team_in.get("short_name", ""),
                logo_url=team_in.get("logo"),
                hockey_type=team_in.get("hockey_type", ""),
                category_group_name=team_in.get("category_group_name", ""),
                recent_poule_id=team_in.get("recent_poule_id"),
                discovered_at=now, updated_at=now, last_scanned_at=now,
            ))
            teams_created += 1

    return {"club": ref_id, "teams_created": teams_created, "teams_updated": teams_updated}
