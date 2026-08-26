"""BeatCrades-agent — definities voor de agent-registry (item 939), nieuw
aangemaakt uit de 27-context-inventarisatie (23 aug 2026).

Drie taken: veilige disk-sync-acties automatisch uitvoeren (item 922),
tool-update-signalering (item 923) en mislukte downloads groeperen/herstarten
(item 924). Hergebruikt bestaande downloader-logica direct (zelfde patroon als
roadmap_agent die routers.roadmap.update_item hergebruikt) i.p.v. deze te
herschrijven."""

from datetime import datetime

from sqlmodel import col, select

from core.settings import settings
from models.downloader import DownloadCrade, DownloadJob
from routers.downloader import SyncExecuteIn, _build_sync_actions, sync_execute, tool_versions
from services.agents.common import NONE_POST_PROCESS

# Alleen niet-destructieve, makkelijk terug te draaien acties mogen automatisch -
# add_from_disk (naam kan fout gegokt zijn) en reorganize_dir (verplaatst data)
# blijven altijd handmatige bevestiging vereisen (zie roadmap-item 922, risico-notitie).
_SAFE_AUTO_TYPES = {"create_dir", "mark_missing", "clear_output"}


def ds_sync_preview(session, params):
    actions = _build_sync_actions(session, settings.DOWNLOAD_DIR)
    return {
        "download_root": settings.DOWNLOAD_DIR,
        "actions": [a.model_dump() for a in actions],
        "safe_auto_types": sorted(_SAFE_AUTO_TYPES),
    }


def pp_sync_confirm(session, body, current_user):
    if not body.sync_action_ids:
        return {"action": "beatcrades_sync_confirm", "ok": False, "reason": "sync_action_ids ontbreekt"}
    actions = _build_sync_actions(session, settings.DOWNLOAD_DIR)
    by_id = {a.id: a for a in actions}
    safe_ids = [
        aid for aid in body.sync_action_ids
        if aid in by_id and by_id[aid].type in _SAFE_AUTO_TYPES
    ]
    if not safe_ids:
        return {"action": "beatcrades_sync_confirm", "ok": False, "reason": "geen van de gekozen acties is auto-safe"}
    result = sync_execute(SyncExecuteIn(action_ids=safe_ids), session=session, user=current_user)
    return {"action": "beatcrades_sync_confirm", "ok": True, "executed": safe_ids, "results": result.results}


def ds_tool_versions(session, params):
    return tool_versions(user=None)


def pp_update_notify(session, body, current_user):
    # Puur advies - geen automatische update, alleen een melding via het
    # generieke notification-veld op AgentResultIn.
    return {"action": "beatcrades_update_notify", "ok": True}


def ds_failed_jobs(session, params):
    jobs = session.exec(select(DownloadJob).where(DownloadJob.status == "error")).all()
    crades = {c.id: c for c in session.exec(select(DownloadCrade)).all()}
    return {
        "failed_jobs": [
            {
                "crade_id": j.crade_id,
                "crade_name": crades[j.crade_id].name if j.crade_id in crades else None,
                "job_id": j.id, "url": j.url, "error": j.error,
                "updated_at": j.updated_at.isoformat(),
            }
            for j in jobs
        ]
    }


def pp_retry_queue(session, body, current_user):
    """Zelfde DB-mutatie als de bestaande handmatige herstart-knop (routers.
    downloader.restart_crade), nu voor een selectie. Het daadwerkelijk starten
    van de download loopt via "kickoff" (report_agent_result draait dit na de
    commit als achtergrondtaak, niet blokkerend op de HTTP-response)."""
    if not body.crade_ids:
        return {"action": "beatcrades_retry_queue", "ok": False, "reason": "crade_ids ontbreekt"}
    restarted, kickoff = [], []
    for crade_id in body.crade_ids:
        job = session.exec(
            select(DownloadJob).where(DownloadJob.crade_id == crade_id)
            .order_by(col(DownloadJob.created_at).desc()).limit(1)
        ).first()
        if not job or job.status == "downloading":
            continue
        job.status = "queued"
        job.error = None
        job.progress_log = None
        job.last_progress_at = None
        job.updated_at = datetime.utcnow()
        session.add(job)
        restarted.append(crade_id)
        kickoff.append(job.id)
    return {"action": "beatcrades_retry_queue", "ok": True, "restarted": restarted, "kickoff": kickoff}


AGENT = {
    "label": "BeatCrades-agent",
    "default_data_source":  "failed_jobs",
    "default_post_process": "none",
    "data_sources": {
        "sync_preview": {
            "label": "Disk-sync-voorstel",
            "params": [],
            "desc": "Voorgestelde sync-acties (create_dir/mark_missing/clear_output/reorganize_dir/add_from_disk) - zelfde data als GET /api/beatcrades/sync/preview.",
            "fn": ds_sync_preview,
        },
        "tool_versions": {
            "label": "Tool-versies (beatportdl/yt-dlp)",
            "params": [],
            "desc": "Geinstalleerde versie vs. laatste GitHub-release voor beatportdl en yt-dlp.",
            "fn": ds_tool_versions,
        },
        "failed_jobs": {
            "label": "Mislukte downloads",
            "params": [],
            "desc": "Alle download_jobs met status=error, inclusief foutmelding en bijbehorende crade.",
            "fn": ds_failed_jobs,
        },
    },
    "post_processes": {
        "beatcrades_sync_confirm": {
            "label": "BeatCrades: veilige sync-acties uitvoeren (item 922)",
            "result_fields": [
                {"name": "sync_action_ids", "type": "lijst van strings", "required": True,
                 "desc": "id's uit de sync_preview-databron - alleen create_dir/mark_missing/clear_output worden echt uitgevoerd, de rest wordt genegeerd"},
            ],
            "fn": pp_sync_confirm,
        },
        "beatcrades_update_notify": {
            "label": "BeatCrades: melding over verouderde tool",
            "result_fields": [
                {"name": "notification", "type": "string", "required": True,
                 "desc": "Welke tool verouderd is en naar welke versie geupdatet kan worden"},
            ],
            "fn": pp_update_notify,
        },
        "beatcrades_retry_queue": {
            "label": "BeatCrades: geselecteerde mislukte downloads herstarten (item 924)",
            "result_fields": [
                {"name": "crade_ids", "type": "lijst van strings", "required": True,
                 "desc": "download_crades.id van de crades die herstart mogen worden"},
            ],
            "fn": pp_retry_queue,
        },
        "none": NONE_POST_PROCESS,
    },
}
