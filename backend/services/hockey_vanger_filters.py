"""Vanger-queue-filter helpers (leeftijd/geslacht/categorie) - verplaatst uit
routers/hockey_vanger.py (item 696)."""

import re

from sqlmodel import Session, col, select

from models.hockey_discovery import HockeyCompetition, HockeyTeam
from models.settings import AppSetting

_AGE_RE         = re.compile(r"[JM][OZ](1[1-8])-")
_AGE_RE_GENERIC = re.compile(r"[JMjm][OZoz](\d+)-")

DISC_FILTER_AGE    = "disc_queue_age_groups"
DISC_FILTER_CLUB   = "disc_queue_club"
DISC_FILTER_CAT    = "disc_queue_category"
DISC_FILTER_HT     = "disc_queue_hockey_type"
DISC_FILTER_GENDER = "disc_queue_gender"

_GENDER_PREFIX = {"Jongens": "J", "Meisjes": "M", "Heren": "H", "Dames": "D"}

# Competitienamen ("Gold Cup Dames", "Landelijk Jongens O18") hebben geen
# teamnaam-prefix zoals "H8"/"JO16-1" om op te matchen (_derive_category in
# routers/hockey_capture.py) - hier classificeren we daarom op sleutelwoorden.
_COMP_AGE_RE = re.compile(r"\bO\d{1,2}\b", re.IGNORECASE)


def _derive_competition_category(name: str) -> str:
    """Best-effort Niveau-classificatie voor een competitienaam.

    "heren"/"dames" wordt EERST gecheckt (roadmap-melding: "Heren O25 NK Zaal"
    kwam door een Junioren-only filter heen omdat _COMP_AGE_RE ook op "O25"
    matcht - senioren-reserve/masters-competities bevatten vaak een O-getal
    zonder jeugd te zijn, dus een expliciet heren/dames-woord moet voorrang
    krijgen boven de generieke leeftijd-regex)."""
    n = (name or "").lower()
    if "dames" in n or "heren" in n:
        return "Senioren"
    if "jongens" in n or "meisjes" in n or _COMP_AGE_RE.search(name or ""):
        return "Junioren"
    return ""


def _derive_competition_gender(name: str) -> str:
    n = (name or "").lower()
    for label, word in _GENDER_PREFIX.items():
        if label.lower() in n:
            return label
    return ""


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


def _is_scoreless_youth(short_name: str) -> bool:
    """O7 t/m O10 (jongste jeugd, veld en zaal) houden geen score bij - deze teams
    worden nooit gescand/gequeued, ongeacht ingestelde filters (item 724)."""
    return _age_in_range(short_name, 7, 10)


def _cmd_matches_filter(session: Session, cmd_type: str, params: dict, ages, club, cats, hts, genders) -> bool:
    """Bepaalt of een cmd bij de huidige queue-filter past - gebruikt bij het
    OPPAKKEN (dequeue) van cmds, niet bij het aanmaken ervan (item 727): cmds die
    niet passen blijven gewoon 'pending' in de lijst staan, maar worden overgeslagen
    zodat ze niet verwerkt worden zolang het filter ze uitsluit."""
    if cmd_type == "get_poule":
        team_id = params.get("team_id")
        if not team_id:
            return True
        team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == team_id)).first()
        if not team:
            return True
        if cats and team.category_group_name not in cats:
            return False
        if hts and team.hockey_type not in hts:
            return False
        if club and team.club_external_id != club:
            return False
        if ages and _age_group_of(team.short_name) not in ages:
            return False
        if genders:
            prefixes = {_GENDER_PREFIX[g] for g in genders if g in _GENDER_PREFIX}
            if prefixes and not any((team.short_name or "").startswith(p) for p in prefixes):
                return False
        return True
    if cmd_type == "get_competition_detail":
        # Landelijke competities (bv. "Gold Cup Dames") hebben geen team_id om op
        # te filteren zoals get_poule - zonder deze tak viel dit altijd terug op
        # de generieke `return True` hieronder, waardoor senioren-competities
        # nooit als "buiten filter" werden gemarkeerd (zie roadmap-melding).
        comp_id = params.get("comp_id")
        comp = session.exec(
            select(HockeyCompetition).where(HockeyCompetition.hl_comp_id == comp_id)
        ).first() if comp_id else None
        label = params.get("label") or (comp.name if comp else "")
        # roadmap-melding: als de hl_comp_id-lookup faalt (stale/dubbel id)
        # werd deze hockey_type-check stilzwijgend overgeslagen ("if comp and
        # ...") waardoor een Zaal-competitie zonder resolvende comp alsnog
        # door een Veld-only filter kwam. Val terug op dezelfde z-prefix-
        # conventie als elders (hockey_vanger_ingest.py) als comp niet resolvet.
        hockey_type = comp.hockey_type if (comp and comp.hockey_type) else (
            "ZA" if label.strip().lower().startswith("z") else "VE"
        )
        if hts and hockey_type not in hts:
            return False
        if cats and _derive_competition_category(label) not in cats:
            return False
        if genders and _derive_competition_gender(label) not in genders:
            return False
        return True
    if cmd_type == "scan_club":
        # item 732: club-scans zijn niet poule-/team-specifiek, dus die gaan altijd
        # door de filter heen - anders blijft een handmatige "herscan"-klik vanuit
        # Discovery-clubs onterecht als "buiten filter" liggen.
        return True
    return True
