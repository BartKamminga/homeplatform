"""Hockey vanger — poule-scan-queue en club-scan-queue leesendpoints -
opgesplitst uit hockey_vanger.py (refactor-plan hockey-inside Fase 3, RFTR-B3)."""

from typing import Dict

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import HockeyClub, HockeyPoule, HockeyTeam, HockeyTeamPoule
from routers.hockey_capture import _get_target_season
from services.hockey_vanger_filters import _age_group_of, _age_sort_key, _get_queue_filter, apply_team_filter

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])


@router.get("/youth-queue")
def get_youth_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Alias for /poule-queue — kept for backward compatibility."""
    return get_poule_queue(session=session, _=_)


@router.get("/youth-queue/next")
def get_youth_queue_next(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Alias for /poule-queue/next — kept for backward compatibility."""
    return get_poule_queue_next(session=session, _=_)


@router.get("/poule-queue")
def get_poule_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Generieke poule-queue — filter volledig vanuit AppSettings."""
    target_season = _get_target_season(session)
    ages, club, cats, hts, genders = _get_queue_filter(session)

    q = apply_team_filter(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None)), cats, hts, genders)
    q = q.order_by(col(HockeyTeam.short_name))
    teams_with = session.exec(q).all()

    by_poule: Dict[int, list] = {}
    for t in teams_with:
        if not t.recent_poule_id:
            continue
        pid = t.recent_poule_id
        if pid not in by_poule:
            by_poule[pid] = []
        by_poule[pid].append(t)

    # item 993: extra (niet-primaire) poules van een team's 2e competitie
    # (item 990) ontbraken hier - een al gevangen 2e poule werd daardoor
    # nooit als 'gevangen' (groen) getoond, ook al stond de data allang in
    # de database.
    extra_rows = session.exec(select(HockeyTeamPoule).where(HockeyTeamPoule.season == target_season)).all()
    if extra_rows:
        extra_teams_q = apply_team_filter(
            select(HockeyTeam).where(col(HockeyTeam.team_id).in_({r.team_id for r in extra_rows})),
            cats, hts, genders,
        )
        extra_teams_by_id = {t.team_id: t for t in session.exec(extra_teams_q).all()}
        for r in extra_rows:
            t = extra_teams_by_id.get(r.team_id)
            if not t:
                continue
            by_poule.setdefault(r.poule_id, []).append(t)

    seen: Dict[int, dict] = {}
    for pid, team_list in by_poule.items():
        rep = team_list[0]
        clubs_ordered: list = []
        clubs_set: set = set()
        for t in team_list:
            if t.club_external_id not in clubs_set:
                clubs_ordered.append(t.club_external_id)
                clubs_set.add(t.club_external_id)
        seen[pid] = {
            "poule_id":         pid,
            "team_id":          rep.team_id,
            "team_name":        rep.name,
            "short_name":       rep.short_name,
            "club_external_id": rep.club_external_id,
            "hockey_type":      rep.hockey_type,
            "has_poule":        True,
            "captured":         False,
            "stale":            False,
            "clubs_in_poule":   clubs_ordered,
        }

    if seen:
        captured_poules = session.exec(
            select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(list(seen.keys())))
        ).all()
        captured_map: Dict[int, str] = {p.poule_id: p.season for p in captured_poules}
        for pid, info in seen.items():
            if pid in captured_map:
                info["captured"] = True
                info["stale"]    = captured_map[pid] != target_season
            else:
                info["captured"] = False
                info["stale"]    = False

    result = list(seen.values())
    age_key = _age_sort_key("short_name")
    result.sort(key=lambda x: (-age_key(x), x["short_name"]))
    total      = len(result)
    n_captured = sum(1 for r in result if r["captured"] and not r["stale"])
    n_stale    = sum(1 for r in result if r["stale"])

    q2 = apply_team_filter(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_(None)), cats, hts, genders)
    q2 = q2.order_by(col(HockeyTeam.short_name))
    teams_waiting = session.exec(q2).all()

    waiting = [
        {
            "poule_id":         None,
            "team_id":          t.team_id,
            "team_name":        t.name,
            "short_name":       t.short_name,
            "club_external_id": t.club_external_id,
            "hockey_type":      t.hockey_type,
            "has_poule":        False,
            "captured":         False,
            "stale":            False,
        }
        for t in teams_waiting
    ]

    filter_active = bool(ages or club)
    if filter_active:
        filtered = [r for r in result if
            (not ages or _age_group_of(r["short_name"]) in ages) and
            (not club or r["club_external_id"] == club
             or club in r.get("clubs_in_poule", []))
        ]
        f_cap   = sum(1 for r in filtered if r["captured"] and not r["stale"])
        f_stale = sum(1 for r in filtered if r["stale"])
    else:
        filtered = result
        f_cap    = n_captured
        f_stale  = n_stale

    return {
        "total":             total,
        "captured":          n_captured,
        "missing":           total - n_captured - n_stale,
        "stale":             n_stale,
        "waiting":           len(waiting),
        "target_season":     target_season,
        "poules":            result + waiting,
        "filter_active":     filter_active,
        "filtered_poules":   filtered if filter_active else [],
        "filtered_total":    len(filtered),
        "filtered_captured": f_cap,
        "filtered_missing":  len(filtered) - f_cap - f_stale,
        "filtered_stale":    f_stale,
    }


@router.get("/poule-queue/next")
def get_poule_queue_next(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Volgende niet-gecaptured poule item (hoog leeftijdsgetal eerst)."""
    target_season = _get_target_season(session)
    ages, club, cats, hts, genders = _get_queue_filter(session)

    captured_ids = {p.poule_id for p in session.exec(
        select(HockeyPoule).where(HockeyPoule.season == target_season)
    ).all()}

    q = apply_team_filter(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None)), cats, hts, genders)
    q = q.order_by(col(HockeyTeam.short_name))
    teams = session.exec(q).all()

    skip_ids = {
        t.recent_poule_id
        for t in teams
        if t.recent_poule_id and (t.no_new_poule_confirmed or t.season_pending)
    }

    seen: set = set()
    candidates = []
    for t in teams:
        if not t.recent_poule_id:
            continue
        pid = t.recent_poule_id
        if pid in captured_ids or pid in seen or pid in skip_ids:
            continue
        seen.add(pid)
        candidates.append({
            "poule_id":         pid,
            "team_id":          t.team_id,
            "team_name":        t.name,
            "short_name":       t.short_name,
            "club_external_id": t.club_external_id,
            "hockey_type":      t.hockey_type,
        })

    # item 993: extra (niet-primaire) poules (item 990) meenemen als kandidaat.
    extra_rows = session.exec(
        select(HockeyTeamPoule)
        .where(HockeyTeamPoule.season == target_season)
        .where(HockeyTeamPoule.no_new_poule_confirmed == False)  # noqa: E712
        .where(HockeyTeamPoule.season_pending == False)  # noqa: E712
    ).all()
    extra_teams_by_id: Dict[int, HockeyTeam] = {}
    if extra_rows:
        extra_teams_q = apply_team_filter(
            select(HockeyTeam).where(col(HockeyTeam.team_id).in_({r.team_id for r in extra_rows})),
            cats, hts, genders,
        )
        extra_teams_by_id = {t.team_id: t for t in session.exec(extra_teams_q).all()}
        for r in extra_rows:
            t = extra_teams_by_id.get(r.team_id)
            pid = r.poule_id
            if not t or pid in captured_ids or pid in seen:
                continue
            seen.add(pid)
            candidates.append({
                "poule_id":         pid,
                "team_id":          t.team_id,
                "team_name":        t.name,
                "short_name":       t.short_name,
                "club_external_id": t.club_external_id,
                "hockey_type":      t.hockey_type,
            })

    if ages:
        candidates = [c for c in candidates if _age_group_of(c["short_name"]) in ages]
    if club:
        club_poule_ids = {
            t.recent_poule_id for t in teams
            if t.club_external_id == club and t.recent_poule_id
        }
        club_poule_ids |= {
            r.poule_id for r in extra_rows
            if (t := extra_teams_by_id.get(r.team_id)) and t.club_external_id == club
        }
        candidates = [c for c in candidates if c["poule_id"] in club_poule_ids]

    if not candidates:
        return {"done": True}

    candidates.sort(key=lambda x: -_age_sort_key("short_name")(x))
    return {"done": False, **candidates[0]}


@router.get("/club-scan-queue")
def get_club_scan_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Clubs waarvan teams no_new_poule_confirmed of season_pending hebben."""
    _, _, cats, hts, genders = _get_queue_filter(session)
    q = apply_team_filter(select(HockeyTeam).where(
        (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)  # noqa: E712
    ), cats, hts, genders)
    teams = session.exec(q).all()

    counts: Dict[str, int] = {}
    for t in teams:
        counts[t.club_external_id] = counts.get(t.club_external_id, 0) + 1

    if not counts:
        return {"total": 0, "clubs": []}

    clubs = session.exec(
        select(HockeyClub).where(col(HockeyClub.external_id).in_(list(counts.keys())))
    ).all()

    result = [
        {
            "club_external_id": c.external_id,
            "name":             c.name,
            "friendly_name":    c.friendly_name,
            "city":             c.city,
            "pending_teams":    counts[c.external_id],
        }
        for c in clubs
    ]
    result.sort(key=lambda x: (-x["pending_teams"], x["friendly_name"] or x["name"]))
    return {"total": len(result), "clubs": result}


@router.get("/club-scan-queue/next")
def get_club_scan_queue_next(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Volgende club om te scannen (meeste pending teams eerst)."""
    _, _, cats, hts, genders = _get_queue_filter(session)
    q = apply_team_filter(select(HockeyTeam).where(
        (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)  # noqa: E712
    ), cats, hts, genders)
    teams = session.exec(q).all()

    if not teams:
        return {"done": True}

    counts: Dict[str, int] = {}
    for t in teams:
        counts[t.club_external_id] = counts.get(t.club_external_id, 0) + 1

    best_id = max(counts, key=lambda k: counts[k])
    club = session.exec(select(HockeyClub).where(HockeyClub.external_id == best_id)).first()
    if not club:
        return {"done": True}

    return {
        "done":             False,
        "club_external_id": club.external_id,
        "name":             club.name,
        "friendly_name":    club.friendly_name,
        "city":             club.city,
        "pending_teams":    counts[best_id],
    }
