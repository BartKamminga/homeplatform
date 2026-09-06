"""Vanger scan-plan: tijdgestuurde, profiel-gebaseerde queuing (item 720).

item 1019 (Fase C-cutover, 31-08-2026): run_scan_plan_pass() dekte tot
vandaag 7 stappen (clublijst, per-club scans, nieuwe/lege poules, landelijke
competities, active-profielen, manual-profielen); de 6 discovery/cadans-
stappen daarvan zijn VERPLAATST naar services/hockey_vanger_schedule.py
(rebuild_schedule + promote_due_schedule_entries is nu de ENIGE bron voor
die concerns, aangeroepen direct na run_scan_plan_pass in dezelfde
periodieke cyclus - zie routers/hockey_vanger_smartscan_control.py::
_maybe_run_scan_plan_pass). run_scan_plan_pass zelf doet nu alleen nog
_reclaim_stale_in_progress (VangerCmd-hygiëne, geen ontdekking).

item 1085 (6-09-2026): de 6 _step_*-functies, _matchday_due_reason en de
active_matchday_enabled-toggle (item 968, sinds de cutover al zonder effect
op de echte scheduler) zijn hier verwijderd - alleen nog de helpers die
hockey_vanger_schedule.py hergebruikt blijven staan."""
import json
from datetime import datetime, time as dtime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from sqlmodel import Session, col, select

from models.hockey import HockeyPublication, HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, VangerCmd
from services.hockey_vanger_filters import _is_scoreless_youth
from services.hockey_vanger_settings import _get_bool_setting, _get_int_setting

STEP_MAX_CMDS = 10

# item 1019/1018: aparte aan/uit-schakelaar voor het overslaan van "gezonde"
# poules (geen onbekende starttijd binnen 7 dagen, geen gespeelde-maar-niet-
# finale wedstrijd) bij de dagelijkse fallback-cadans van actieve profielen.
# Default AAN (Bart, 31-08-2026: wilde de besparing, instelling is er om 'm
# zelf uit te zetten als het afbreukrisico - een gemiste verzetting van een
# verder gezonde, nabije wedstrijd - in de praktijk toch te groot blijkt).
# manual_weekly krijgt deze skip ALTIJD (geen instelling nodig) - dat raakt
# geen matchday-tracking.
SKIP_HEALTHY_DAILY_FALLBACK_KEY = "skip_healthy_daily_fallback"


def _skip_healthy_daily_fallback(session: Session) -> bool:
    return _get_bool_setting(session, SKIP_HEALTHY_DAILY_FALLBACK_KEY, True)


def _poule_health(session: Session, poule_ids: List[int], now: Optional[datetime] = None) -> Dict[int, dict]:
    """Bart, 30-08-2026: 'is er nog onbekende wedstrijdtijd binnen een week,
    of een gespeelde wedstrijd zonder uitslag - dat is een scan waard' +
    'wedstrijden zijn bezig (hoeven niet perse live te zijn)'. Puur uit
    match-data afgeleid (geen scan-geschiedenis/cadans nodig) - 1 gebatchte
    query voor alle meegegeven poules i.p.v. per poule, zodat de Discovery-
    boom (honderden poules) niet N+1 wordt. Verplaatst uit routers/
    hockey_capture.py (item 1019) zodat hockey_vanger_schedule.py 'm ook
    kan hergebruiken om gezonde poules over te slaan, i.p.v. de logica te
    dupliceren.

    unknown_start en overdue_result zijn BEWUST 2 losse velden i.p.v. 1
    gecombineerde 'needs_scan' (Bart, 30-08-2026, na een eerste acc-check:
    927 van de 1023 poules stonden op 'needs_scan' aan het begin van een
    nieuw seizoen, puur omdat hockey.nl de starttijden van de eerste ronden
    vaak pas 1-2 weken van tevoren publiceert - unknown_start is dan bijna
    overal waar, en overspoelt het echt selectieve signaal (overdue_result,
    slechts 199 wedstrijden op hetzelfde moment) als ze samen 1 vlag delen."""
    if not poule_ids:
        return {}
    match_duration_m = _get_int_setting(session, "match_duration_min", 90)
    now = now or datetime.utcnow()
    lookahead_end = (now + timedelta(days=7)).date()
    health: Dict[int, dict] = {}
    matches = session.exec(
        select(HockeyPouleMatch).where(col(HockeyPouleMatch.poule_id).in_(poule_ids))
    ).all()
    for m in matches:
        if not m.match_date:
            continue
        info = _match_dt_info(m.match_date)
        if not info:
            continue
        utc_naive, _is_today, is_midnight = info
        h = health.setdefault(m.poule_id, {"busy": False, "unknown_start": False, "overdue_result": False})
        if is_midnight:
            if now.date() <= utc_naive.date() <= lookahead_end:
                h["unknown_start"] = True
            continue
        end = utc_naive + timedelta(minutes=match_duration_m)
        if utc_naive <= now < end:
            h["busy"] = True
        if end < now and m.status != "final":
            h["overdue_result"] = True
    return health


def _is_healthy(health: Dict[int, dict], poule_id: int) -> bool:
    """Gebruikt om de manual_weekly/daily_fallback-cadans over te slaan (item
    1018) - NIET hetzelfde als de "geen badge tonen"-conventie in routers/
    hockey_capture.py::list_poules. Een poule_id ONTBREKT in health zodra er
    geen enkele match met een bruikbare match_date bekend is - dat betekent
    "we weten nog niets", niet "bewezen gezond": zo'n poule moet gewoon
    gescand blijven worden totdat er wel matchdata binnenkomt (zelfde
    conservatieve houding als _has_remaining_matches/_next_match_within
    hierboven). Alleen een poule_id MET minstens 1 bekende match en beide
    vlaggen False is echt "gezond"."""
    if poule_id not in health:
        return False
    h = health[poule_id]
    return not h["unknown_start"] and not h["overdue_result"]


def _scan_profile_comp_ids(session: Session) -> Tuple[set, set]:
    """item 1022 (Bart, 31-08-2026: 'laten we visible en published ook
    meenemen'): scan_profile='active' krijgt de volle autoscan-behandeling
    (matchday-burst/daily_fallback/unknown_start_recheck) alleen als de
    competitie OOK publiek zichtbaar is - HockeyPublication.published EN
    HockeyPublicationComp.visible. Zonder deze check zou een concept-
    publicatie of een op onzichtbaar gezette competitie evenveel scan-
    capaciteit krijgen als een live publieke competitie.

    Een 'active' competitie die hier niet aan voldoet wordt niet losgelaten
    (dat liet 'm voor onbepaalde tijd stilvallen, zie item 1022) maar valt
    terug op DEZELFDE wekelijkse cadans als scan_profile='manual' - geen
    aparte 3e cadans nodig. published=False wint altijd van visible (een
    concept-publicatie maakt de losse zichtbaarheids-vlag binnenin
    irrelevant).

    new_or_empty (de allereerste ontdekkingsscan) hangt hier bewust niet
    van af - die is al onafhankelijk van scan_profile/publicatie.
    Landelijke (hl_comp_id-gekoppelde) competities zijn hier ook bewust
    buiten gelaten - _step_landelijke_competitions kent geen scan_profile-
    onderscheid en blijft dat voorlopig ongewijzigd houden (aparte,
    grotere afweging voor een volgende sessie).

    Bewust GEEN join op HockeyPublication (die zou een HockeyPublicationComp
    met een niet-resolvende publication_id stilzwijgend laten vallen, i.p.v.
    'm als active_eligible/manual mee te tellen) - een ontbrekende publicatie
    telt als published=True (geen aanname van onzichtbaarheid bij een
    kapotte/ontbrekende referentie, die zou normaal niet moeten voorkomen)."""
    links = session.exec(select(HockeyPublicationComp)).all()
    pub_ids = {link.publication_id for link in links}
    pubs_by_id = {p.id: p for p in session.exec(
        select(HockeyPublication).where(col(HockeyPublication.id).in_(pub_ids))
    ).all()} if pub_ids else {}

    manual_ids: set = set()
    active_eligible_ids: set = set()
    active_demoted_ids: set = set()
    for link in links:
        if link.scan_profile == "manual":
            manual_ids.add(link.competition_id)
        elif link.scan_profile == "active":
            pub = pubs_by_id.get(link.publication_id)
            published = pub.published if pub else True
            if published and link.visible:
                active_eligible_ids.add(link.competition_id)
            else:
                active_demoted_ids.add(link.competition_id)
    return active_eligible_ids, manual_ids | active_demoted_ids


def _is_autoscan_eligible(session: Session, competition_id: int) -> bool:
    """Doel-specifieke variant van _scan_profile_comp_ids (net als
    _team_for_poule vs _team_by_poule) - voor de reactieve rebuild_schedule_
    for_target (1 competitie), waar de volledige set opbouwen overkill is."""
    link = session.exec(
        select(HockeyPublicationComp)
        .where(HockeyPublicationComp.competition_id == competition_id)
        .where(HockeyPublicationComp.scan_profile == "active")
    ).first()
    if not link:
        return False
    pub = session.get(HockeyPublication, link.publication_id)
    published = pub.published if pub else True
    return bool(published and link.visible)


def _pending_poule_ids(session: Session) -> set:
    active = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    return {json.loads(c.params).get("poule_id") for c in active if c.cmd_type == "get_poule"}


def _pending_club_ext_ids(session: Session) -> set:
    active = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    return {json.loads(c.params).get("external_id") for c in active if c.cmd_type == "scan_club"}


def _team_by_poule(session: Session) -> Dict[int, HockeyTeam]:
    result: Dict[int, HockeyTeam] = {}
    for t in session.exec(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))).all():
        if _is_scoreless_youth(t.short_name):
            continue
        result.setdefault(t.recent_poule_id, t)
    return result


def _team_for_poule(session: Session, poule_id: int) -> Optional[HockeyTeam]:
    """Doel-specifieke variant van _team_by_poule (Bart, 30-08-2026: 'ik
    neem aan dat je alleen de relevante delen herbouwt?') - een gerichte
    query voor 1 poule i.p.v. eerst de HELE ~3700-team-tabel in een dict op
    te bouwen om er dan 1 uit te pakken (0.487s vs 0.001s, gemeten op acc).
    Zelfde filtering/eerste-match-wint-semantiek als _team_by_poule."""
    for t in session.exec(select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule_id)).all():
        if _is_scoreless_youth(t.short_name):
            continue
        return t
    return None


def _match_dt_info(raw: str) -> Optional[Tuple[datetime, bool, bool]]:
    """Parseer match_date. Retourneert (utc_naive_dt, is_vandaag, is_middernacht_placeholder)."""
    try:
        dt = datetime.fromisoformat(raw)
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is not None:
        now_local = datetime.now(dt.tzinfo)
        is_today = dt.date() == now_local.date()
        is_midnight = dt.timetz().replace(tzinfo=None) == dtime(0, 0)
        utc_naive = dt.astimezone(timezone.utc).replace(tzinfo=None)
    else:
        is_today = dt.date() == datetime.utcnow().date()
        is_midnight = dt.time() == dtime(0, 0)
        utc_naive = dt
    return utc_naive, is_today, is_midnight


def _has_remaining_matches(matches, now: datetime) -> bool:
    """True zolang er nog een wedstrijd kan komen: een bekende toekomstige
    datum, OF nog helemaal geen (parseerbare) datum - dat kan alsnog een
    toekomstige wedstrijd worden. Alleen False als er minstens 1 wedstrijd
    bekend is EN ze allemaal al geweest zijn - dan is het seizoen voor deze
    poule/competitie voorbij en heeft een dagelijkse heartbeat-scan (item
    1016, Bart 30-08-2026) geen zin meer: er valt niets nieuws te ontdekken."""
    if not matches:
        return True
    for m in matches:
        if not m.match_date:
            return True
        info = _match_dt_info(m.match_date)
        if not info:
            return True
        utc_naive, _is_today, _is_midnight = info
        if utc_naive >= now:
            return True
    return False


def _next_match_within(matches, now: datetime, days: int) -> bool:
    """True als er een wedstrijd binnen `days` dagen valt - bekend (met of
    zonder starttijd, dat kan alsnog binnen de periode vallen) of nog
    helemaal geen wedstrijd bekend (conservatief: kan nog van alles komen).
    Gebruikt om de dagelijkse fallback over te slaan tijdens een rustige
    periode (Bart 30-08-2026): zolang de eerstvolgende wedstrijd nog ver
    weg is, valt er toch niets te ontdekken via een dagelijkse
    heartbeat-scan - de cadans hervat vanzelf zodra die wedstrijd
    dichterbij komt."""
    if not matches:
        return True
    horizon = now + timedelta(days=days)
    for m in matches:
        if not m.match_date:
            return True
        info = _match_dt_info(m.match_date)
        if not info:
            return True
        utc_naive, _is_today, _is_midnight = info
        if now <= utc_naive <= horizon:
            return True
    return False


def _reclaim_stale_in_progress(session: Session, now: datetime) -> int:
    """Roadmap-melding (29-08-2026, live wedstrijddag): cmd-queue/next zet een
    cmd meteen op in_progress zodra Scout/Ghost 'm ophaalt, vóór er ook maar
    iets verwerkt is. Crasht/herstart Scout/Ghost daarna (bv. een hockey.nl-
    timeout die niet netjes afgevangen wordt) dan wordt nooit meer /result
    aangeroepen - de cmd blijft voor altijd in_progress hangen, en blokkeert
    zijn poule/club permanent voor herscannen (_pending_poule_ids/
    _pending_club_ext_ids tellen in_progress net zo goed mee als pending).
    Elke pass: cmd's die te lang in_progress staan terugzetten naar failed,
    zodat hun poule/club de eerstvolgende pass weer opnieuw gequeued kan
    worden. Timeout ruim boven een normale doorlooptijd (~15-30s per cmd)."""
    timeout_min = _get_int_setting(session, "stale_cmd_timeout_min", 10)
    cutoff = now - timedelta(minutes=timeout_min)
    stale = session.exec(
        select(VangerCmd).where(VangerCmd.status == "in_progress").where(VangerCmd.started_at < cutoff)
    ).all()
    for cmd in stale:
        cmd.status = "failed"
        cmd.error = f"Timeout - geen resultaat ontvangen binnen {timeout_min} min (Scout/Ghost waarschijnlijk gecrasht of herstart)"
        cmd.finished_at = now
        session.add(cmd)
    return len(stale)


MANUAL_SCAN_WEEKDAYS = 5  # maandag t/m vrijdag (0..4) - _manual_scan_weekday spreidt de load hierover


def _manual_scan_weekday(competition_id: int) -> int:
    """Welke werkdag (0=maandag..4=vrijdag) een scan_profile='manual'-competitie
    krijgt toegewezen voor haar wekelijkse herscan - gedeeld tussen het
    scan-plan zelf en de kalender-weergave, zodat ze nooit uit de pas lopen."""
    return competition_id % MANUAL_SCAN_WEEKDAYS


def run_scan_plan_pass(session: Session) -> dict:
    """item 1019 (Fase C, cutover, 31-08-2026): dekte tot vandaag 7 stappen -
    club_list, new_or_empty_poules, club_scan, landelijke_competities,
    active_profielen en manual_weekly zijn per de cutover VERPLAATST naar
    het scanschema (services/hockey_vanger_schedule.py::rebuild_schedule +
    promote_due_schedule_entries, aangeroepen direct na deze functie in
    routers/hockey_vanger_smartscan_control.py::_maybe_run_scan_plan_pass -
    zelfde periodieke cyclus, geen nieuw tijdsgat). Alleen _reclaim_stale_
    in_progress (VangerCmd-hygiene, geen ontdekking) blijft hier - de 6
    _step_*-functies (en _matchday_due_reason) zijn verwijderd (item 1085)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    steps = {
        "reclaimed_stale": _reclaim_stale_in_progress(session, now),
    }
    added = sum(steps.values())
    session.commit()
    return {"added": added, "steps": steps}
