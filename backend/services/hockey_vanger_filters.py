"""Vanger-queue-filter helpers (leeftijd/geslacht/categorie) - verplaatst uit
routers/hockey_vanger.py (item 696)."""

import re

from sqlmodel import Session, col

from models.hockey_discovery import HockeyTeam
from models.settings import AppSetting

_AGE_RE         = re.compile(r"[JM][OZ](1[1-8])-")
_AGE_RE_GENERIC = re.compile(r"[JMjm][OZoz](\d+)-")

DISC_FILTER_AGE    = "disc_queue_age_groups"
DISC_FILTER_CLUB   = "disc_queue_club"
DISC_FILTER_CAT    = "disc_queue_category"
DISC_FILTER_HT     = "disc_queue_hockey_type"
DISC_FILTER_GENDER = "disc_queue_gender"

_GENDER_PREFIX = {"Jongens": "J", "Meisjes": "M", "Heren": "H", "Dames": "D"}


def _is_target_age(short_name: str) -> bool:
    return bool(_AGE_RE.search(short_name or ""))


def _age_group_of(short_name: str) -> str:
    m = _AGE_RE_GENERIC.search(short_name or "")
    return "O" + m.group(1) if m else "?"


def _get_queue_filter(session: Session):
    age_row    = session.get(AppSetting, DISC_FILTER_AGE)
    club_row   = session.get(AppSetting, DISC_FILTER_CLUB)
    cat_row    = session.get(AppSetting, DISC_FILTER_CAT)
    ht_row     = session.get(AppSetting, DISC_FILTER_HT)
    gender_row = session.get(AppSetting, DISC_FILTER_GENDER)
    ages    = [a for a in (age_row.value    if age_row    else "").split(",") if a]
    club    = (club_row.value or None)       if club_row   else None
    cats    = [c for c in (cat_row.value    if cat_row    else "Junioren").split(",") if c]
    hts     = [h for h in (ht_row.value     if ht_row     else "VE"      ).split(",") if h]
    genders = [g for g in (gender_row.value if gender_row else ""         ).split(",") if g]
    return ages, club, cats, hts, genders


def _apply_gender_filter(q, genders):
    """Filter op geslacht via LIKE-prefix op short_name (J/M/H/D)."""
    if not genders:
        return q
    conds = [col(HockeyTeam.short_name).like(f"{_GENDER_PREFIX[g]}%")
             for g in genders if g in _GENDER_PREFIX]
    if not conds:
        return q
    combined = conds[0]
    for c in conds[1:]:
        combined = combined | c
    return q.where(combined)


def _age_in_range(short_name: str, age_min: int, age_max: int) -> bool:
    m = _AGE_RE_GENERIC.search(short_name or "")
    if not m:
        return False
    age = int(m.group(1))
    return age_min <= age <= age_max
