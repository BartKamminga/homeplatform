"""Ops-agent — definities voor de agent-registry (item 939), nieuw aangemaakt
uit de 27-context-inventarisatie (23 aug 2026) + roadmap-item 958.

Drie pijlers van hetzelfde ops-domein, samengebracht in 1 agent i.p.v. los
onder hockey_scan/roadmap te hangen: ongebruikelijke admin-activiteit (item
935), gaten in dagelijkse backups (item 936) en infra-status/CPU/schijf
(item 958). De Bugsink-foutenlijst uit item 958 ontbreekt hier bewust nog -
er is geen bestaande Bugsink-API-integratie in deze backend (geen client,
geen credentials in settings); dat is een losse vervolgstap zodra de
Bugsink-API-toegang is uitgezocht, niet iets om hier te gokken."""

from datetime import datetime, timedelta

from sqlmodel import col, select

from models.core import AuditLog
from models.settings import AppSetting
from routers.backup import list_daily_backups
from routers.infra import get_services
from services.agents.common import NONE_POST_PROCESS, make_roadmap_flag_post_process

_AUDIT_DIGEST_KEY = "audit_anomaly_digest"


def ds_audit_recent(session, params):
    hours = int(params.get("hours", 72))
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    rows = session.exec(
        select(AuditLog).where(col(AuditLog.created_at) >= cutoff).order_by(col(AuditLog.created_at).desc())
    ).all()

    by_action: dict = {}
    for r in rows:
        by_action.setdefault(r.action, []).append(r)
    action_counts = [
        {
            "action": action, "count": len(items),
            "users": sorted({i.user_id for i in items if i.user_id}),
            "sites": sorted({i.site for i in items if i.site}),
        }
        for action, items in by_action.items()
    ]
    action_counts.sort(key=lambda s: -s["count"])
    return {"window_hours": hours, "total_events": len(rows), "action_counts": action_counts}


def pp_audit_digest_note(session, body, current_user):
    if not body.digest_text:
        return {"action": "audit_digest_note", "ok": False, "reason": "digest_text ontbreekt"}
    row = session.get(AppSetting, _AUDIT_DIGEST_KEY)
    if not row:
        row = AppSetting(key=_AUDIT_DIGEST_KEY, value=body.digest_text)
    else:
        row.value = body.digest_text
        row.updated_at = datetime.utcnow()
    session.add(row)
    return {"action": "audit_digest_note", "ok": True}


def ds_backup_status(session, params):
    return list_daily_backups(_user=None)


def ds_infra_status(session, params):
    """Zelfde data als GET /api/admin/infra/services (runner-status, laatste
    backup, hardware CPU/schijf/geheugen). Bugsink-fouten ontbreken hier nog
    (zie moduledocstring)."""
    return get_services(_=None)


AGENT = {
    "label": "Ops-agent",
    "default_data_source":  "infra_status",
    "default_post_process": "none",
    "data_sources": {
        "audit_recent": {
            "label": "Recente audit-log-activiteit (item 935)",
            "params": [
                {"name": "hours", "type": "integer", "required": False, "desc": "Terugkijkvenster in uren (default 72)"},
            ],
            "desc": "Audit-log-events uit het venster, gegroepeerd per actie met betrokken gebruikers/sites - voor het signaleren van bulk-acties of ongebruikelijke patronen.",
            "fn": ds_audit_recent,
        },
        "backup_status": {
            "label": "Dagelijkse backups (item 936)",
            "params": [],
            "desc": "Lijst dagelijkse backup-bestanden met datum/grootte - voor het signaleren van gaten in de reeks.",
            "fn": ds_backup_status,
        },
        "infra_status": {
            "label": "Infra-status (item 958)",
            "params": [],
            "desc": "Runner-status, laatste backup en hardware (CPU/schijf/geheugen) - zelfde data als het admin-infrastructuurpaneel.",
            "fn": ds_infra_status,
        },
    },
    "post_processes": {
        "audit_digest_note": {
            "label": "Ops: audit-anomalie-samenvatting publiceren (item 935)",
            "result_fields": [
                {"name": "digest_text", "type": "string", "required": True,
                 "desc": "Samenvatting van ongebruikelijke/verdachte admin-activiteit"},
            ],
            "fn": pp_audit_digest_note,
        },
        "roadmap_auto_flag": make_roadmap_flag_post_process(
            "roadmap_auto_flag", "backup_health_watch (Ops-agent)", "agent-control"
        ),
        "ops_roadmap_flag": make_roadmap_flag_post_process(
            "ops_roadmap_flag", "Ops-agent", "agent-control"
        ),
        "none": NONE_POST_PROCESS,
    },
}
