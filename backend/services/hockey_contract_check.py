"""Item 1257: dagelijkse contract-check hockey.nl.

De backend roept hockey.nl nooit zelf aan - Ghost/Scout vangen de antwoorden
van app.hockeyweerelt.nl op via de VangerCmd-wachtrij. Deze check zet daarom
1x per 24 uur drie vaste testcommando's in de wachtrij (reason contract_check):
een regionale poule (get_poule; landelijke worden omgeleid naar een
competitiescan), een landelijke competitie (get_competition_detail) en een
club (scan_club). Elk resultaat voor zo'n vast doel - ook van een gewone scan -
wordt vergeleken met een opgeslagen basislijn van de VORM (paden + typen, geen
inhoud). Verdwenen velden of gewijzigde typen = melding (push + Sentry);
nieuwe velden worden alleen bijgehouden. Ook een parse_failed van welk
commando dan ook, en een check die >36 uur geen resultaat gaf, worden gemeld.

Staat (doelen, basislijnen, laatste uitkomsten) in 1 AppSetting als JSON."""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlmodel import Session, col, select

from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyTeam
from models.settings import AppSetting
from services.hockey_vanger_settings import _set_str_setting, get_target_season
from services.push import send_push

logger = logging.getLogger(__name__)

REASON = "contract_check"
STATE_KEY = "contract_check_state"
RUN_INTERVAL = timedelta(hours=24)
STALE_AFTER = timedelta(hours=36)
PARSE_FAILED_ALERT_EVERY = timedelta(hours=6)
KEY_FIELD = {"get_poule": "poule_id", "scan_club": "external_id", "get_competition_detail": "comp_id"}
MAX_LISTED = 8


# ── Vorm van een JSON-antwoord ────────────────────────────────────────────────

def _scalar_type(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, (int, float)):
        return "number"
    return "string" if isinstance(v, str) else type(v).__name__


def shape_of(value: Any, path: str = "$", out: Optional[dict] = None) -> dict:
    """{pad: [typen]} - lijstelementen worden samengevoegd onder pad[]."""
    out = {} if out is None else out
    if isinstance(value, dict):
        out.setdefault(path, set()).add("object")
        for k, v in value.items():
            shape_of(v, f"{path}.{k}", out)
    elif isinstance(value, list):
        out.setdefault(path, set()).add("list" if value else "list:empty")
        for v in value:
            shape_of(v, f"{path}[]", out)
    else:
        out.setdefault(path, set()).add(_scalar_type(value))
    if path == "$":
        return {p: sorted(t) for p, t in out.items()}
    return out


def _real(types) -> set:
    """Typen zonder 'leeg/onbekend' (null, lege lijst telt als lijst)."""
    return {"list" if t == "list:empty" else t for t in types} - {"null"}


def compare_shapes(baseline: dict, current: dict) -> dict:
    """removed/changed = contractbreuk, added = alleen ter info. Kinderen van
    een pad dat nu null of een lege lijst is, tellen niet als verdwenen."""
    hollow = [p for p, t in current.items() if set(t) <= {"null", "list:empty"}]

    def under_hollow(p: str) -> bool:
        return any(p.startswith(h + ".") or p.startswith(h + "[]") for h in hollow)

    removed = [p for p in baseline if p not in current and not under_hollow(p)]
    changed = [
        f"{p}: {'/'.join(sorted(_real(baseline[p])))} -> {'/'.join(sorted(_real(current[p])))}"
        for p in baseline if p in current
        and _real(baseline[p]) and _real(current[p]) and not (_real(baseline[p]) & _real(current[p]))
    ]
    base_hollow = [p for p, t in baseline.items() if set(t) <= {"null", "list:empty"}]
    added = [p for p in current if p not in baseline
             and not any(p.startswith(h + ".") or p.startswith(h + "[]") for h in base_hollow)]
    return {"removed": sorted(removed), "changed": sorted(changed), "added": sorted(added)}


# ── Staat ─────────────────────────────────────────────────────────────────────

def load_state(session: Session) -> dict:
    row = session.get(AppSetting, STATE_KEY)
    try:
        state = json.loads(row.value) if row and row.value else {}
    except ValueError:
        state = {}
    for k in ("targets", "baselines", "latest", "results", "parse_failed"):
        state.setdefault(k, {})
    return state


def save_state(session: Session, state: dict) -> None:
    _set_str_setting(session, STATE_KEY, json.dumps(state))
    session.commit()


def resolve_targets(session: Session) -> dict:
    """Vaste testdoelen, 1x gekozen en daarna bewaard (wisselende doelen geven
    valse alarmen door optionele velden)."""
    season = get_target_season(session)
    targets: dict = {}
    poules = session.exec(
        select(HockeyPoule)
        .join(HockeyCompetition, HockeyCompetition.id == HockeyPoule.competition_id)
        .where(HockeyPoule.season == season, col(HockeyCompetition.hl_comp_id).is_(None),
               col(HockeyPoule.last_scanned_at).is_not(None))
        .order_by(col(HockeyPoule.last_scanned_at).desc()).limit(50)
    ).all()
    for poule in poules:
        team = session.exec(select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule.poule_id)).first()
        if team:
            targets["get_poule"] = {"poule_id": poule.poule_id, "team_id": team.team_id,
                                    "label": f"Contract check: {team.name} - {poule.name}"}
            break
    comp = session.exec(
        select(HockeyCompetition)
        .where(HockeyCompetition.season == season, col(HockeyCompetition.hl_comp_id).is_not(None))
        .order_by(col(HockeyCompetition.id).desc())
    ).first()
    if comp:
        targets["get_competition_detail"] = {"comp_id": comp.hl_comp_id, "label": f"Contract check: {comp.name}"}
    club = session.exec(
        select(HockeyClub).where(col(HockeyClub.last_scanned_at).is_not(None))
        .order_by(col(HockeyClub.name).contains("Victoria").desc(), col(HockeyClub.last_scanned_at).desc())
    ).first()
    if club:
        targets["scan_club"] = {"external_id": club.external_id,
                                "label": f"Contract check: {club.friendly_name or club.name}"}
    return targets


# ── Meldingen ─────────────────────────────────────────────────────────────────

def _alert(title: str, body: str) -> None:
    logger.error("hockey.nl contract check: %s - %s", title, body)
    try:
        send_push(user_id=None, title=title, body=body, url="/hockey-inside/", site="hockey-inside")
    except Exception:
        logger.exception("contract check: push mislukt")


def _listed(items: list) -> str:
    more = f" (+{len(items) - MAX_LISTED} more)" if len(items) > MAX_LISTED else ""
    return ", ".join(items[:MAX_LISTED]) + more


# ── Dagelijkse run en verwerking van resultaten ───────────────────────────────

def maybe_run_contract_check(session: Session, now: datetime, force: bool = False) -> int:
    """Max 1x per 24 uur: doelen aanvullen, testcommando's inplannen en melden
    als een doel al >36 uur geen resultaat gaf. Geeft het aantal nieuwe cmd's."""
    from routers.hockey_vanger_cmd_queue import add_vanger_cmd  # lokale import: router importeert deze service

    state = load_state(session)
    last_run = state.get("last_run")
    if not force and last_run and now - datetime.fromisoformat(last_run) < RUN_INTERVAL:
        return 0
    state["last_run"] = now.isoformat()

    for cmd_type, target in resolve_targets(session).items():
        if cmd_type not in state["targets"]:
            state["targets"][cmd_type] = {**target, "since": now.isoformat()}

    stale = []
    for cmd_type, target in state["targets"].items():
        checked = state["results"].get(cmd_type, {}).get("checked_at") or target.get("since")
        if checked and now - datetime.fromisoformat(checked) > STALE_AFTER:
            stale.append(target.get("label", cmd_type))
    if stale:
        _alert("hockey.nl check did not run", f"No result for 36+ hours: {_listed(stale)}. Is Ghost running?")

    added = 0
    for cmd_type, target in state["targets"].items():
        params = {k: v for k, v in target.items() if k != "since"}
        added += 1 if add_vanger_cmd(session, cmd_type, params, reason=REASON).get("added") else 0
    save_state(session, state)
    return added


def _is_target(state: dict, cmd_type: str, params: dict) -> bool:
    target = state["targets"].get(cmd_type)
    field = KEY_FIELD.get(cmd_type)
    return bool(target and field and str(params.get(field)) == str(target.get(field)))


def on_cmd_result(session: Session, cmd_type: str, params: dict, raw: Any, parse_failed: bool,
                  now: Optional[datetime] = None) -> Optional[str]:
    """Na elk geslaagd vanger-resultaat. Geeft de uitkomst voor een testdoel
    terug (baseline_set/ok/additions/breach), anders None."""
    now = now or datetime.utcnow()
    state = load_state(session)

    if parse_failed:
        last = state["parse_failed"].get(cmd_type, {}).get("alerted_at")
        state["parse_failed"][cmd_type] = {"at": now.isoformat(), "label": params.get("label"),
                                           "alerted_at": last}
        if not last or now - datetime.fromisoformat(last) > PARSE_FAILED_ALERT_EVERY:
            state["parse_failed"][cmd_type]["alerted_at"] = now.isoformat()
            _alert("hockey.nl data could not be read",
                   f"{cmd_type} for '{params.get('label') or '?'}' no longer parses - the response shape probably changed.")

    if not _is_target(state, cmd_type, params):
        if parse_failed:
            save_state(session, state)
        return None

    current = shape_of(raw)
    state["latest"][cmd_type] = current
    baseline = state["baselines"].get(cmd_type)
    if baseline is None:
        state["baselines"][cmd_type] = current
        outcome, diff = "baseline_set", {"removed": [], "changed": [], "added": []}
    else:
        diff = compare_shapes(baseline, current)
        breach = diff["removed"] or diff["changed"] or parse_failed
        outcome = "breach" if breach else ("additions" if diff["added"] else "ok")
        previous = state["results"].get(cmd_type, {})
        if breach and (previous.get("outcome") != "breach"
                       or previous.get("removed") != diff["removed"] or previous.get("changed") != diff["changed"]):
            parts = [f"removed: {_listed(diff['removed'])}" if diff["removed"] else "",
                     f"changed: {_listed(diff['changed'])}" if diff["changed"] else ""]
            _alert("hockey.nl response shape changed",
                   f"{state['targets'][cmd_type].get('label', cmd_type)} - " + "; ".join(p for p in parts if p))
    state["results"][cmd_type] = {"outcome": outcome, "checked_at": now.isoformat(), **diff}
    save_state(session, state)
    return outcome


def accept_current_shape(session: Session, cmd_type: Optional[str] = None) -> list[str]:
    """Na een bewuste wijziging: de laatst geziene vorm wordt de nieuwe basislijn."""
    state = load_state(session)
    accepted = []
    for key in ([cmd_type] if cmd_type else list(state["latest"])):
        if key in state["latest"]:
            state["baselines"][key] = state["latest"][key]
            state["results"].setdefault(key, {}).update(outcome="accepted", removed=[], changed=[], added=[])
            accepted.append(key)
    save_state(session, state)
    return accepted
