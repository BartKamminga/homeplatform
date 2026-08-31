"""Gedeelde AppSetting-helper voor de vanger (refactor-plan hockey-inside
Fase 2d, RFTR-B2) - was letterlijk dubbel in routers/hockey_vanger.py en
services/hockey_vanger_scanplan.py."""

from datetime import datetime
from typing import Dict, Optional, Tuple

from sqlmodel import Session, select

from models.hockey_discovery import HockeyPoule
from models.settings import AppSetting

DISC_TARGET_SEASON = "disc_target_season"
NOTIFY_TEAM_IDS_KEY = "notify_team_ids"

ZAAL_WINDOW_START_DAY_KEY   = "zaal_window_start_day"
ZAAL_WINDOW_START_MONTH_KEY = "zaal_window_start_month"
ZAAL_WINDOW_END_DAY_KEY     = "zaal_window_end_day"
ZAAL_WINDOW_END_MONTH_KEY   = "zaal_window_end_month"


def _get_int_setting(session: Session, key: str, default: int) -> int:
    row = session.get(AppSetting, key)
    if row and row.value and row.value.lstrip("-").isdigit():
        return int(row.value)
    return default


def _get_str_setting(session: Session, key: str, default: str = "") -> str:
    row = session.get(AppSetting, key)
    return row.value if row and row.value else default


def _get_bool_setting(session: Session, key: str, default: bool) -> bool:
    """item 1019: vervangt de inline `row.value != "0" if row else <default>`-
    idioom die al 2x gedupliceerd stond (active_matchday_enabled in
    hockey_vanger_scanplan.py, de toggles in hockey_vanger_smartscan_control.py)."""
    row = session.get(AppSetting, key)
    return row.value != "0" if row else default


def get_notify_team_ids(session: Session) -> set:
    """item 1001: team_ids (hockey.nl) waarvoor een pushmelding moet gaan bij
    een afgeronde wedstrijd - komma-gescheiden setting, leeg = geen meldingen."""
    raw = _get_str_setting(session, NOTIFY_TEAM_IDS_KEY, "")
    return {p.strip() for p in raw.split(",") if p.strip()}


def get_target_season(session: Session) -> str:
    """item 842: was routers/hockey_capture.py's _get_target_season - een
    'private' router-helper die door 3 andere routers en 3 services werd
    geimporteerd (verkeerde afhankelijkheidsrichting voor de services)."""
    row = session.get(AppSetting, DISC_TARGET_SEASON)
    return row.value if row and row.value else "2026-2027"


def compute_poule_season_ranges(session: Session) -> Tuple[Dict[str, dict], Optional[int]]:
    """item 1019: geextraheerd uit routers/hockey_capture.py::infer_season_pending
    (was een inline closure daar) - min/max poule_id per al-gecapturede seizoen,
    zodat een willekeurig poule_id zonder 'm te scannen aan een seizoen kan
    worden toegewezen (poule_id's zijn monotoon oplopend over de tijd). Los van
    _infer_poule_season zodat een aanroeper die veel poule_id's achter elkaar
    classificeert (bv. team.poules[]-verwerking) de ranges 1x kan opbouwen
    i.p.v. per poule_id opnieuw te queryen."""
    poules = session.exec(select(HockeyPoule)).all()
    season_ranges: Dict[str, dict] = {}
    for p in poules:
        r = season_ranges.setdefault(p.season, {"min_id": p.poule_id, "max_id": p.poule_id})
        r["min_id"] = min(r["min_id"], p.poule_id)
        r["max_id"] = max(r["max_id"], p.poule_id)
    global_max = max((r["max_id"] for r in season_ranges.values()), default=None)
    return season_ranges, global_max


def infer_poule_season(
    poule_id: int, season_ranges: Dict[str, dict], target_season: str,
) -> str:
    """Classificeert poule_id naar het seizoen waarvan de bekende [min_id,
    max_id]-range 'm bevat; valt buiten elke bekende range (bv. hoger dan alles
    wat we kennen - een gloednieuwe poule) dan target_season als beste gok."""
    for season, r in season_ranges.items():
        if r["min_id"] <= poule_id <= r["max_id"]:
            return season
    return target_season


def get_zaal_window(session: Session) -> Tuple[int, int, int, int]:
    """item 1019: (start_day, start_month, end_day, end_month) van het
    zaalhockey-seizoensvenster, default eind november t/m begin maart (15/11
    t/m 15/3) - instelbaar omdat de exacte competitiestart per seizoen kan
    verschuiven."""
    return (
        _get_int_setting(session, ZAAL_WINDOW_START_DAY_KEY, 15),
        _get_int_setting(session, ZAAL_WINDOW_START_MONTH_KEY, 11),
        _get_int_setting(session, ZAAL_WINDOW_END_DAY_KEY, 15),
        _get_int_setting(session, ZAAL_WINDOW_END_MONTH_KEY, 3),
    )


def is_in_zaal_window(
    now: datetime, start_day: int, start_month: int, end_day: int, end_month: int,
) -> bool:
    """Pure venster-check die de jaarwisseling correct afhandelt (het venster
    loopt van november naar maart, dus OVER de jaargrens heen) - vergelijkt op
    (maand, dag) i.p.v. volledige datums, seizoen-/jaaronafhankelijk."""
    today = (now.month, now.day)
    start = (start_month, start_day)
    end   = (end_month, end_day)
    if start <= end:
        return start <= today <= end
    return today >= start or today <= end
