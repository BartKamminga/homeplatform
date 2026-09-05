"""Vanger raw-data-parsers + capture-verwerking (poule/club/competitie) -
verplaatst uit routers/hockey_vanger.py (item 696). Zet ruwe payloads van de
vanger-extensie om naar domeinmodellen (HockeyPoule/HockeyTeam/HockeyClub/...)."""

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlmodel import Session, col, select

from models.hockey_discovery import (
    HockeyCompetition, HockeyPoule, HockeyPouleMatch,
    HockeyPouleStanding, HockeyTeam, VangerCmd,
)
from routers.hockey_capture import LinkedPouleIn, MatchIn, PouleCaptureIn, StandingIn, TeamInPoule
from routers.hockey_clubs import ClubDetailIn, TeamIn
from services.hockey_club_capture_core import apply_club_detail, apply_clubs_list
from services.hockey_poule_capture_core import _derive_category, apply_poule_capture
from services.hockey_vanger_settings import compute_poule_season_ranges, get_target_season, infer_poule_season


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

        # item 1019: data.data.team.poules[] somt ALLE ooit aan dit team
        # gekoppelde poules op (huidige EN oude/andere-fase) - de huidige
        # (params["poule_id"]) hier al uitsluiten, de rest wordt pas verderop
        # (_call_poule_capture) op seizoen + period_name beoordeeld voordat
        # er iets mee gebeurt. Bewust hier al gefilterd op ontbrekend id,
        # anders zou een kapotte entry een crash bij het queuen veroorzaken.
        linked_poules: List[LinkedPouleIn] = []
        team_data = raw["data"]["data"].get("team") or {}
        for lp in team_data.get("poules") or []:
            lp_id = lp.get("id")
            if not lp_id or lp_id == params["poule_id"]:
                continue
            lp_comp = lp.get("competition") or {}
            linked_poules.append(LinkedPouleIn(id=lp_id, period_name=lp_comp.get("period_name")))

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
            period_name=comp.get("period_name"),
            team_id=team_data.get("id"),
            teams_in_poule=teams_list,
            standings_data=standings_list,
            matches_data=matches_list,
            linked_poules=linked_poules,
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

def _queue_next_phase_poules(session: Session, body: PouleCaptureIn, target_season: str) -> int:
    """item 1019: data.data.team.poules[] (body.linked_poules) kan een
    volgende-fase-poule voor HETZELFDE team onthullen (bv. Voorcompetitie ->
    Nov tm Jun) - maar bevat vooral OUDE/historische poules van vorige
    seizoenen (bevestigd: een ander period_name betekent niet automatisch een
    nieuwe fase, zie roadmap-melding poule 175841). Daarom eerst het seizoen
    van elke gekoppelde poule inschatten (via de bestaande poule_id-range-
    logica, zonder 'm te hoeven scannen) en pas bij een match met het
    doelseizoen het period_name vergelijken - alleen een AFWIJKEND period_name
    binnen het huidige seizoen is een genuine nieuwe fase. Dekt geen zaal (een
    zaalteam is een apart team_id/HockeyTeam-record, verschijnt nooit in de
    poules-lijst van het veldteam) - dat loopt via het aparte zaal-tijdvak-
    mechanisme in hockey_vanger_filters.py."""
    if not body.linked_poules or not body.team_id:
        return 0
    from routers.hockey_vanger_cmd_queue import add_vanger_cmd  # lokale import: voorkomt circulaire import op module-niveau

    captured_poule_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}
    pending_cmds = session.exec(
        select(VangerCmd).where(
            VangerCmd.cmd_type == "get_poule",
            col(VangerCmd.status).in_(["pending", "in_progress"]),
        )
    ).all()
    pending_poule_ids = {json.loads(c.params).get("poule_id") for c in pending_cmds}

    season_ranges, _global_max = compute_poule_season_ranges(session)

    queued = 0
    for lp in body.linked_poules:
        if lp.id in captured_poule_ids or lp.id in pending_poule_ids:
            continue
        if infer_poule_season(lp.id, season_ranges, target_season) != target_season:
            continue
        if lp.period_name == body.period_name:
            continue
        add_vanger_cmd(
            session, "get_poule", {"poule_id": lp.id, "team_id": body.team_id, "label": body.competition_name},
            reason="next_phase_discovery",
        )
        queued += 1
    return queued


def _call_poule_capture(body: PouleCaptureIn, session: Session):
    target_season = get_target_season(session)
    result = apply_poule_capture(session, body, target_season)
    _queue_next_phase_poules(session, body, target_season)
    return {
        "teams":          len(body.teams_in_poule),
        "standings":      result.standings_saved,
        "matches_total":  result.matches_saved,
        "matches_played": result.matches_played,
        "competition":    body.competition_name,
        "season":         body.season,
        "newly_finished": result.newly_finished,
    }


def _call_club_detail(body: ClubDetailIn, session: Session):
    result = apply_club_detail(session, body)
    return {
        "teams_found":       len(body.teams),
        "teams_added":       result.teams_created,
        "teams_new_poule":   result.teams_new_poule,
        "teams_disappeared": result.teams_disappeared,
    }


def _call_clubs_list(clubs: list, session: Session):
    result = apply_clubs_list(session, clubs)
    return {
        "clubs_found":   result.clubs_found,
        "clubs_added":   result.clubs_created,
        "clubs_updated": result.clubs_updated,
    }


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
    newly_finished: list = []  # item 1001/1013: zelfde "net final geworden"-detectie als apply_poule_capture

    # item 1075: standings-team-lookup vooraf 1x gebatchd over ALLE poules in
    # deze response i.p.v. per standings-rij een losse select (was dubbel
    # geneste N+1: poules x teams-per-poule). existing_teams_by_id wordt
    # verderop bijgewerkt zodra een nieuw team wordt aangemaakt, zodat een
    # team_id dat in meerdere poules van dezelfde response voorkomt niet
    # dubbel aangemaakt wordt (zelfde effect als de autoflush die de oude,
    # per-rij query hier eerder al aan gaf).
    standings_team_ids = {
        tid for pd in poules_list for s in (pd.get("standings") or [])
        if (tid := (s.get("team") or {}).get("id"))
    }
    existing_teams_by_id = {
        t.team_id: t for t in session.exec(
            select(HockeyTeam).where(col(HockeyTeam.team_id).in_(standings_team_ids))
        ).all()
    } if standings_team_ids else {}

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
                # flush vóór het toekennen: forceert het "loskoppelen" van het
                # oude hl_comp_id vóór de nieuwe toekenning, anders kan SQLite
                # de update-volgorde omdraaien en de unique constraint breken
                # (roadmap-melding 29-08-2026: meerdere poules binnen dezelfde
                # landelijke competitie-detail-response claimen hetzelfde
                # hl_comp_id, elk met hun eigen ext_id door seizoen-verschillen).
                session.flush()
                comp_row.hl_comp_id = hl_cid
            comp_row.updated_at = now
            session.add(comp_row)
        else:
            _release_stale_hl_comp_id(session, hl_cid, keep_id=None)
            session.flush()
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
            # zelfde flush-fix als apply_poule_capture (item 1010) - deze
            # standings/matches-upsert is hier gedupliceerd i.p.v. gedeeld,
            # dus kreeg de fix daar niet automatisch mee.
            session.flush()
            for s in standings:
                team = s.get("team") or {}
                tid  = team.get("id")
                if tid:
                    teams_found_set.add(tid)
                    ht_row = existing_teams_by_id.get(tid)
                    if not ht_row:
                        ht_row = HockeyTeam(
                            team_id=tid,
                            club_external_id=team.get("federation_reference_id") or "",
                            name=team.get("name", ""),
                            short_name=team.get("short_name") or team.get("name", ""),
                            logo_url=team.get("logo"),
                            hockey_type=team.get("hockey_type") or "VE",
                            category_group_name=_derive_category(team.get("name", "")),
                            discovered_at=now, updated_at=now,
                        )
                        session.add(ht_row)
                        existing_teams_by_id[tid] = ht_row
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
            old_status_by_match_id = {
                m.match_id: m.status
                for m in session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule_id)).all()
            }
            for old in session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule_id)).all():
                session.delete(old)
            session.flush()
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
                # Bart, 5-09-2026: zelfde fix als in apply_poule_capture -
                # de raw data bevat het score-veld ook tijdens een lopende
                # wedstrijd, niet alleen bij status=final. Altijd opslaan.
                session.add(HockeyPouleMatch(
                    poule_id=poule_id, match_id=m.get("id"),
                    home_team_id=home.get("id"), home_team_name=home.get("name", ""),
                    away_team_id=away.get("id"), away_team_name=away.get("name", ""),
                    match_date=m.get("date"), status=m.get("status", ""),
                    home_score=score.get("home"),
                    away_score=score.get("away"),
                    round=m.get("round"),
                    location_name=facility.get("name"),
                    field_type=field.get("type"),
                    updated_at=now,
                ))
                if is_final and old_status_by_match_id.get(m.get("id")) != "final":
                    newly_finished.append({
                        "poule_id": poule_id,
                        "home_team_id": home.get("id"), "home_team_name": home.get("name", ""),
                        "away_team_id": away.get("id"), "away_team_name": away.get("name", ""),
                        "home_score": score.get("home"), "away_score": score.get("away"),
                    })

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
        "newly_finished":        newly_finished,
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

    target_season = get_target_season(session)
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
            session.flush()
            existing.hl_comp_id = comp_id
            existing.updated_at = now
            session.add(existing)
        else:
            _release_stale_hl_comp_id(session, comp_id, keep_id=None)
            session.flush()
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
