"""BeatCrades — watch_progress: scant downloadmap voor real-time voortgang bij beatportdl.

beatportdl buffert alle stdout tot het klaar is. De watcher compenseert dit door
elke 10 s het aantal audio-bestanden op disk te tellen en de playlist-naam te
detecteren uit de mapstructuur.
"""

import asyncio
import logging
import os
from datetime import datetime

from routers.downloader_helpers import update_job

logger = logging.getLogger("homeplatform.beatcrades.beatport.watcher")

_AUDIO_EXTS = frozenset([".flac", ".mp3", ".wav", ".m4a", ".ogg", ".opus", ".webm"])

TYPE_DIRS = frozenset([
    "playlists", "releases", "tracks", "charts", "mixes", "labels", "artists",
])


async def watch_progress(
    download_dir: str,
    job_id: str,
    stop: asyncio.Event,
    before_dirs: set,
) -> None:
    """Scan download_dir elke 10 s en schrijf voortgang naar de DB.

    Stopt zodra stop gezet is.
    """
    while not stop.is_set():
        await asyncio.sleep(10)
        if stop.is_set():
            break
        try:
            count = 0
            detected_name = None

            for root, _dirs, files in os.walk(download_dir):
                for f in files:
                    if os.path.splitext(f)[1].lower() in _AUDIO_EXTS:
                        count += 1
                try:
                    rel = os.path.relpath(root, download_dir).replace("\\", "/")
                    parts = [p for p in rel.split("/") if p and p != "."]
                    if len(parts) >= 2 and parts[0].lower() in TYPE_DIRS:
                        detected_name = parts[1].replace("_", " ")
                    elif len(parts) == 1 and parts[0].lower() not in TYPE_DIRS:
                        detected_name = parts[0].replace("_", " ")
                except Exception:
                    pass

            msg_parts = []
            if detected_name:
                msg_parts.append(f"📀 {detected_name}")
            if count > 0:
                num = "nummer" if count == 1 else "nummers"
                msg_parts.append(f"♬ {count} {num} gedownload")
            elif not msg_parts:
                msg_parts.append("Beatportdl gestart, wachten op eerste output…")

            update_job(job_id, progress_log="\n".join(msg_parts), last_progress_at=datetime.utcnow())
        except Exception:
            pass
