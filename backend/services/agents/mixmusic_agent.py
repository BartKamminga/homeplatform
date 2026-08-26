"""MixMusic-agent — definities voor de agent-registry (item 939), nieuw
aangemaakt uit de 27-context-inventarisatie (23 aug 2026).

Drie losstaande taken: genre-suggesties voor ongetagde tracks (item 919),
controle van de groeps-uitsluitingslijst (item 920) en een leesbare
luistergedrag-samenvatting (item 921). Alle drie zijn platformbreed (geen
user/group-scope) - dit is onderhoud, geen per-gebruiker weergave."""

import os
from datetime import datetime

from sqlalchemy import func as sqla_func
from sqlmodel import select

from models.mixmusic import TrackExcluded, TrackHeart, TrackMeta
from models.settings import AppSetting
from services.agents.common import NONE_POST_PROCESS

_DIGEST_KEY = "mixmusic_stats_digest"


def ds_untagged_tracks(session, params):
    metas = session.exec(select(TrackMeta)).all()
    untagged = [m for m in metas if not m.genres]
    folder_genre_hints: dict = {}
    for m in metas:
        if not m.genres:
            continue
        folder = os.path.dirname(m.file_path)
        folder_genre_hints.setdefault(folder, {})
        for g in m.genres:
            folder_genre_hints[folder][g] = folder_genre_hints[folder].get(g, 0) + 1

    return {
        "untagged": [
            {"file_path": m.file_path, "display_name": m.display_name, "folder": os.path.dirname(m.file_path)}
            for m in untagged
        ],
        "folder_genre_hints": folder_genre_hints,
    }


def pp_genre_apply(session, body, current_user):
    if not body.mixmusic_updates:
        return {"action": "mixmusic_genre_apply", "ok": False, "reason": "mixmusic_updates ontbreekt"}
    applied = []
    for upd in body.mixmusic_updates:
        file_path = upd.get("file_path")
        genres = upd.get("genres")
        if not file_path or not genres:
            continue
        meta = session.exec(select(TrackMeta).where(TrackMeta.file_path == file_path)).first()
        if not meta:
            meta = TrackMeta(file_path=file_path)
        meta.genres = genres
        meta.updated_at = datetime.utcnow()
        session.add(meta)
        applied.append(file_path)
    return {"action": "mixmusic_genre_apply", "ok": True, "applied": applied}


def ds_exclude_review(session, params):
    excluded = session.exec(select(TrackExcluded)).all()
    metas_by_fp = {m.file_path: m for m in session.exec(select(TrackMeta)).all()}
    rows = [
        {
            "file_path": ex.file_path, "group_id": ex.group_id,
            "rating": metas_by_fp[ex.file_path].rating if ex.file_path in metas_by_fp else None,
            "play_count": metas_by_fp[ex.file_path].play_count if ex.file_path in metas_by_fp else 0,
        }
        for ex in excluded
    ]
    return {"excluded_tracks": rows}


def pp_exclude_notify(session, body, current_user):
    # Puur advies (risicovol/groepsbreed om zelf uit te sluiten) - de eigenlijke
    # melding loopt via het generieke notification-veld op AgentResultIn.
    return {"action": "mixmusic_exclude_notify", "ok": True}


def ds_listening_stats(session, params):
    metas = session.exec(select(TrackMeta)).all()
    top_played = sorted(metas, key=lambda m: m.play_count or 0, reverse=True)[:10]

    genre_counts: dict = {}
    for m in metas:
        for g in (m.genres or []):
            genre_counts[g] = genre_counts.get(g, 0) + 1

    heart_rows = session.exec(
        select(TrackHeart.file_path, sqla_func.count(TrackHeart.id))
        .group_by(TrackHeart.file_path)
        .order_by(sqla_func.count(TrackHeart.id).desc())
        .limit(10)
    ).all()

    return {
        "top_played": [
            {"file_path": m.file_path, "display_name": m.display_name, "play_count": m.play_count}
            for m in top_played
        ],
        "genre_counts": genre_counts,
        "heart_hotspots": [{"file_path": fp, "heart_count": cnt} for fp, cnt in heart_rows],
    }


def pp_digest_publish(session, body, current_user):
    if not body.digest_text:
        return {"action": "mixmusic_digest_publish", "ok": False, "reason": "digest_text ontbreekt"}
    row = session.get(AppSetting, _DIGEST_KEY)
    if not row:
        row = AppSetting(key=_DIGEST_KEY, value=body.digest_text)
    else:
        row.value = body.digest_text
        row.updated_at = datetime.utcnow()
    session.add(row)
    return {"action": "mixmusic_digest_publish", "ok": True}


AGENT = {
    "label": "MixMusic-agent",
    "default_data_source":  "untagged_tracks",
    "default_post_process": "none",
    "data_sources": {
        "untagged_tracks": {
            "label": "Tracks zonder genre",
            "params": [],
            "desc": "Alle tracks zonder genre, plus genre-verdeling per mapnaam van al wel getagde tracks (voor suggestie op basis van gelijkende tracks).",
            "fn": ds_untagged_tracks,
        },
        "exclude_review": {
            "label": "Uitsluitingslijst controleren",
            "params": [],
            "desc": "Uitgesloten tracks gekruist met hun rating/play_count - signaleert per-ongeluk-uitgesloten (hoge rating/play_count) tracks.",
            "fn": ds_exclude_review,
        },
        "listening_stats": {
            "label": "Luistergedrag-samenvatting",
            "params": [],
            "desc": "Meest gespeeld, genre-verdeling en hartjes-hotspots over de hele bibliotheek.",
            "fn": ds_listening_stats,
        },
    },
    "post_processes": {
        "mixmusic_genre_apply": {
            "label": "MixMusic: genre-suggesties toepassen",
            "result_fields": [
                {"name": "mixmusic_updates", "type": "lijst van {file_path, genres}", "required": True,
                 "desc": "Per track de voorgestelde genre(s) - wordt direct op mixmusic_track_meta.genres gezet"},
            ],
            "fn": pp_genre_apply,
        },
        "mixmusic_exclude_notify": {
            "label": "MixMusic: melding over uitsluitingslijst",
            "result_fields": [
                {"name": "notification", "type": "string", "required": True,
                 "desc": "Welke tracks mogelijk per ongeluk (niet) uitgesloten zijn, en waarom"},
            ],
            "fn": pp_exclude_notify,
        },
        "mixmusic_digest_publish": {
            "label": "MixMusic: luistergedrag-samenvatting publiceren",
            "result_fields": [
                {"name": "digest_text", "type": "string", "required": True,
                 "desc": "Leesbare samenvatting voor het dashboard"},
            ],
            "fn": pp_digest_publish,
        },
        "none": NONE_POST_PROCESS,
    },
}
