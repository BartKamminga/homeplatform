"""Fiets-agent — definities voor de agent-registry (item 939/941).

Databron: dezelfde ruwe data als de fiets debug-pagina (per-uur brondata,
score-opbouw, source-disagreement). Post-process: een AI-score per uur,
opgeslagen naast de bestaande deterministisch berekende score in
UserPreference.extra, zodat de fiets-app 'm ernaast kan tonen (item 942)."""

import asyncio

from sqlmodel import select

from core.settings import settings
from models.core import UserPreference
from routers.fiets import _PREF_KEYS
from services import fiets as fiets_svc
from services.agents.common import NONE_POST_PROCESS


def _get_user_pref_row(session, user_id):
    return session.exec(select(UserPreference).where(UserPreference.user_id == user_id)).first()


def ds_debug_view(session, params):
    user_id = params.get("user_id")
    if not user_id:
        return {"note": "geen user_id meegegeven in de taak-params"}
    row = _get_user_pref_row(session, user_id)
    extra = (row.extra or {}) if row else {}
    prefs = {out: extra[key] for key, out in _PREF_KEYS.items() if extra.get(key) is not None}
    lat = extra.get("fiets_lat", settings.FIETS_LAT)
    lon = extra.get("fiets_lon", settings.FIETS_LON)
    result = asyncio.run(fiets_svc.build_debug_view(lat, lon, prefs))
    return {"user_id": user_id, "debug_view": result}


def pp_ai_score_graph(session, body, current_user):
    if not body.user_id:
        return {"action": "ai_score_graph", "ok": False, "reason": "user_id ontbreekt"}
    if not body.ai_scores:
        return {"action": "ai_score_graph", "ok": False, "reason": "ai_scores ontbreekt"}
    row = _get_user_pref_row(session, body.user_id)
    if not row:
        return {"action": "ai_score_graph", "ok": False, "reason": "gebruiker heeft nog geen voorkeuren-rij"}
    row.extra = {**(row.extra or {}), "fiets_ai_score": body.ai_scores}
    session.add(row)
    return {"action": "ai_score_graph", "ok": True, "user_id": body.user_id, "points": len(body.ai_scores)}


AGENT = {
    "label": "Fiets-agent",
    # Geen zinnig routine-standaard zonder een specifieke user_id - buiten een
    # gekozen taak/context doet deze agent dus niets (alleen heartbeat).
    "default_data_source":  None,
    "default_post_process": "none",
    "data_sources": {
        "debug_view": {
            "label": "Debug-pagina data (ruwe bron + score-opbouw per uur)",
            "params": [
                {"name": "user_id", "type": "string", "required": True, "desc": "Voor welke gebruiker (users.id)"},
            ],
            "desc": "Zelfde data als GET /api/fiets/debug: per uur ruwe bronwaarden (KNMI/GFS/ICON), "
                    "geblende waarden, low_confidence-vlag, en de berekende score-opbouw.",
            "fn": ds_debug_view,
        },
    },
    "post_processes": {
        "ai_score_graph": {
            "label": "Fiets: AI-score-grafiek opslaan",
            "result_fields": [
                {"name": "ai_scores", "type": "lijst van {time, ai_score}", "required": True,
                 "desc": "Per-uur AI-score (0-100), opgeslagen naast de bestaande berekende score"},
            ],
            "fn": pp_ai_score_graph,
        },
        "none": NONE_POST_PROCESS,
    },
}
