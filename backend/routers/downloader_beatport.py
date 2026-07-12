"""BeatCrades — beatportdl: voorbereiding, read-loop filters en resultaatverwerking.

beatportdl is een Go-binary die:
- altijd buffert (geen TTY → geen real-time output tijdens download)
- altijd exit 1 geeft door EOF in interactieve modus (dit is normaal gedrag)
- downloads organiseert in type-mappen: downloads_dir/Playlists/<naam>/ of Releases/<naam>/
"""

import asyncio
import logging
import os
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from core.settings import settings
from routers.downloader_helpers import update_job, rename_crade

logger = logging.getLogger("homeplatform.beatcrades.beatport")


# ── Constanten ────────────────────────────────────────────────────────────────

# Regels die beatportdl in interactieve modus uitvoert — niet tonen aan de gebruiker
NOISE_LINES = ("enter url or search query", "error reading input string")

# beatportdl plaatst downloads in type-mappen; de echte naam zit één niveau dieper
TYPE_DIRS = frozenset([
    "playlists", "releases", "tracks", "charts", "mixes", "labels", "artists",
])

_AUDIO_EXTS = frozenset([".flac", ".mp3", ".wav", ".m4a", ".ogg", ".opus", ".webm"])

# Go-panic herkenning
_GO_PANIC_RE = re.compile(r"^goroutine \d+", re.MULTILINE)

# beatportdl heeft GEEN playlist-niveau header (alleen per-track regels);
# naam-detectie gebeurt via de mapstructuur (_content_name).


# ── Voorbereiding ─────────────────────────────────────────────────────────────

@dataclass
class BeatportContext:
    work_dir: str
    before_dirs: set = field(default_factory=set)
    cmd: list = field(default_factory=list)


def prepare(url: str, download_dir: str, job_id: str) -> Optional[BeatportContext]:
    """Maak temp workdir + config aan voor beatportdl.

    Retourneert None als voorbereiding mislukt (job is dan al op 'error' gezet).
    """
    config_dir = settings.BEATPORTDL_CONFIG_DIR
    if not config_dir:
        update_job(job_id, status="error", error="BEATPORTDL_CONFIG_DIR niet geconfigureerd.")
        return None

    base_config = os.path.join(config_dir, "beatportdl-config.yml")
    if not os.path.exists(base_config):
        update_job(job_id, status="error",
                   error=f"Hernoem je config naar 'beatportdl-config.yml' in {config_dir}")
        return None

    work_dir = None
    try:
        work_dir = tempfile.mkdtemp(prefix=f"bdl_{job_id}_")

        # Lees basis-config als key:value paren (negeert comments/lege regels).
        # Schrijf schone YAML zonder comments om encoding-problemen te vermijden.
        cfg: dict[str, str] = {}
        with open(base_config, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                if ":" in stripped:
                    key, _, val = stripped.partition(":")
                    cfg[key.strip()] = val.strip()

        # Overschrijf downloads_directory met onze job-specifieke map
        cfg["downloads_directory"] = download_dir
        # show_progress vereist een TTY; via pipe komen alleen garbled ANSI-codes door.
        # Forceer false zodat beatportdl leesbare tekst-output geeft.
        cfg["show_progress"] = "false"

        with open(os.path.join(work_dir, "beatportdl-config.yml"), "w", encoding="utf-8") as f:
            for key, val in cfg.items():
                # Quotes als de waarde YAML-special chars bevat
                if any(c in val for c in ':#{}[]|>&*!,"\''):
                    f.write(f'{key}: "{val.replace(chr(34), chr(92)+chr(34))}"\n')
                else:
                    f.write(f"{key}: {val}\n")

        creds_src = os.path.join(config_dir, "beatportdl-credentials.json")
        if os.path.exists(creds_src):
            shutil.copy2(creds_src, os.path.join(work_dir, "beatportdl-credentials.json"))

    except Exception as e:
        if work_dir:
            shutil.rmtree(work_dir, ignore_errors=True)
        update_job(job_id, status="error", error=f"Kan beatportdl config niet laden: {e}")
        return None

    # Snapshot van bestaande submappen — zo detecteren we welke beatportdl aanmaakt
    before_dirs: set = set()
    if os.path.exists(download_dir):
        before_dirs = {
            e for e in os.listdir(download_dir)
            if os.path.isdir(os.path.join(download_dir, e))
        }

    return BeatportContext(
        work_dir=work_dir,
        before_dirs=before_dirs,
        cmd=["beatportdl", url],
    )


# ── Resultaatverwerking ───────────────────────────────────────────────────────

def handle_result(
    *,
    job_id: str,
    crade_id: Optional[str],
    crade_name: Optional[str],
    url: str,
    fmt: str,
    proc,
    lines: list[str],
    error_hints: list[str],
    detected_name: Optional[str],
    work_dir: str,
    before_dirs: set,
    download_dir: str,
) -> None:
    """Sluit een beatportdl-run af: credentials bijwerken, crade hernoemen, job afsluiten."""

    # Credentials terugkopieren — beatportdl vernieuwt ze bij sessie-refresh
    creds_new = os.path.join(work_dir, "beatportdl-credentials.json")
    if os.path.exists(creds_new):
        shutil.copy2(
            creds_new,
            os.path.join(settings.BEATPORTDL_CONFIG_DIR, "beatportdl-credentials.json"),
        )

    # beatportdl eindigt altijd met exit 1 door EOF — succes als er geen echte fouten zijn
    real_errors = [h for h in error_hints if "error reading input string" not in h.lower()]
    succeeded = proc.returncode == 0 or not real_errors

    if succeeded:
        output_path = _first_new_dir(download_dir, before_dirs)
        new_name    = detected_name or _content_name(download_dir, before_dirs)

        update_job(job_id, status="done", output_path=output_path)
        logger.info("Download klaar [%s] crade=%r → %s", job_id, crade_name, output_path)

        if new_name:
            logger.info("Playlist-naam: %r (uit output: %r)", new_name, detected_name)
            if crade_id:
                # beatportdl organiseert zijn eigen mappen; alleen de DB-naam bijwerken
                rename_crade(crade_id, new_name, move_dir=False)

        _write_info_file(download_dir, crade_name, url, fmt)
    else:
        error = _build_error(proc, lines, real_errors)
        update_job(job_id, status="error", error=error[:1500])
        logger.error("Download mislukt [%s] exit=%d: %s", job_id, proc.returncode, error[:300])


# ── Interne hulpfuncties ──────────────────────────────────────────────────────

async def watch_progress(download_dir: str, job_id: str, stop: asyncio.Event, before_dirs: set) -> None:
    """Scan de downloadmap elke 10 s en rapporteer voortgang aan de UI.

    beatportdl buffert alles → geen real-time output. In plaats daarvan tellen
    we audio-bestanden op disk zodat de gebruiker toch voortgang ziet.
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

                # Detecteer naam uit mapstructuur: downloads_dir/Playlists/Naam/
                try:
                    rel   = os.path.relpath(root, download_dir).replace("\\", "/")
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


def _first_new_dir(download_dir: str, before_dirs: set) -> Optional[str]:
    """Geeft de eerste nieuw aangemaakte top-level map terug (voor output_path)."""
    try:
        after = {e for e in os.listdir(download_dir) if os.path.isdir(os.path.join(download_dir, e))}
        new = sorted(after - before_dirs)
        return new[0] if new else None
    except OSError:
        return None


def _content_name(download_dir: str, before_dirs: set) -> Optional[str]:
    """Zoek de echte playlist/release-naam; kijk BINNEN type-mappen (Playlists/, Releases/…).

    Werkt ook bij restarts waarbij de type-map al bestond: zoekt dan naar de
    meest recentelijk gewijzigde submap binnen bestaande type-mappen.
    """
    try:
        after = {e for e in os.listdir(download_dir) if os.path.isdir(os.path.join(download_dir, e))}
    except OSError:
        return None

    new = sorted(after - before_dirs)

    # Stap 1: nieuwe type-mappen (eerste download)
    for d in new:
        if d.lower() in TYPE_DIRS:
            type_path = os.path.join(download_dir, d)
            try:
                subs = sorted(e for e in os.listdir(type_path)
                              if os.path.isdir(os.path.join(type_path, e)))
                if subs:
                    return subs[0].replace("_", " ").strip()
            except OSError:
                pass
        else:
            return d.replace("_", " ").strip()

    # Stap 2: bestaande type-mappen (restart) — pak de meest recent gewijzigde submap
    for d in sorted(before_dirs):
        if d.lower() not in TYPE_DIRS:
            continue
        type_path = os.path.join(download_dir, d)
        try:
            subs = [
                (e, os.path.getmtime(os.path.join(type_path, e)))
                for e in os.listdir(type_path)
                if os.path.isdir(os.path.join(type_path, e))
            ]
            if subs:
                newest = max(subs, key=lambda x: x[1])[0]
                return newest.replace("_", " ").strip()
        except OSError:
            pass

    return None


def _write_info_file(download_dir: str, crade_name: Optional[str], url: str, fmt: str) -> None:
    try:
        with open(os.path.join(download_dir, "BeatCrades.info"), "w", encoding="utf-8") as f:
            f.write(f"name: {crade_name or 'onbekend'}\n")
            f.write(f"url: {url}\n")
            f.write(f"format: {fmt}\n")
            f.write(f"downloaded: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n")
    except Exception as exc:
        logger.warning("Kan BeatCrades.info niet schrijven: %s", exc)


def _build_error(proc, lines: list[str], real_errors: list[str]) -> str:
    if _is_go_panic(lines):
        reason = _panic_reason(lines)
        return (
            f"Beatportdl is gecrasht (panic): {reason}\n"
            "Controleer je Beatport-sessie en klik op ↺ om opnieuw te starten."
        )
    if real_errors:
        return (f"[exit {proc.returncode}]\n" + "\n".join(real_errors[-10:])).strip()
    return (f"[exit {proc.returncode}]\n" + "\n".join(lines[-10:])).strip()


def _is_go_panic(lines: list[str]) -> bool:
    return any(_GO_PANIC_RE.match(l) for l in lines)


def _panic_reason(lines: list[str]) -> str:
    for line in lines:
        if "panic:" in line.lower():
            return line.strip()
    for line in lines:
        ll = line.lower()
        if any(k in ll for k in ("tls", "connection reset", "eof", "timeout", "deadline exceeded", "i/o timeout")):
            return line.strip()
    return "Onverwachte crash (beatportdl panic)"
