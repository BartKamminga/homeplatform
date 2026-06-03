"""
Mix Music router
Serveert muziekbestanden vanaf een gemounte map.
Ondersteunt Range requests voor seek in de browser.
"""

import os
import urllib.parse
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/mixmusic", tags=["mixmusic"])

MUSIC_DIR = Path(os.environ.get("MUSIC_DIR", "/app/music"))
MUSIC_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma"}

MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".wma": "audio/x-ms-wma",
}


class Track(BaseModel):
    name: str
    file: str
    ext: str
    folder: str
    size: int


def scan_tracks() -> list[dict]:
    tracks = []
    if not MUSIC_DIR.exists():
        return tracks
    for ext in MUSIC_EXTENSIONS:
        for f in sorted(MUSIC_DIR.rglob(f"*{ext}")):
            try:
                rel = f.relative_to(MUSIC_DIR)
                parts = rel.parts
                tracks.append({
                    "name": f.stem,
                    "file": str(rel).replace("\\", "/"),
                    "ext": ext[1:].upper(),
                    "folder": str(parts[0]) if len(parts) > 1 else "",
                    "size": f.stat().st_size,
                })
            except Exception:
                continue
    tracks.sort(key=lambda t: (t["folder"].lower(), t["name"].lower()))
    return tracks


@router.get("/health")
def health():
    return {
        "status": "ok",
        "music_dir": str(MUSIC_DIR),
        "exists": MUSIC_DIR.exists(),
    }


@router.get("/tracks", response_model=list[Track])
def get_tracks():
    return scan_tracks()


@router.get("/stream/{filepath:path}")
async def stream_music(filepath: str, request: Request):
    filepath = urllib.parse.unquote(filepath)
    music_path = MUSIC_DIR / filepath

    # Beveiligingscheck: pad mag niet buiten MUSIC_DIR komen
    try:
        music_path.resolve().relative_to(MUSIC_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Toegang geweigerd")

    if not music_path.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")

    if music_path.suffix.lower() not in MUSIC_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Bestandstype niet ondersteund")

    mime = MIME_TYPES.get(music_path.suffix.lower(), "audio/mpeg")
    file_size = music_path.stat().st_size

    # Range request afhandeling (voor seek in browser)
    range_header = request.headers.get("Range")

    if range_header:
        byte_start, byte_end = 0, file_size - 1
        try:
            range_val = range_header.replace("bytes=", "")
            parts = range_val.split("-")
            if parts[0]:
                byte_start = int(parts[0])
            if parts[1]:
                byte_end = int(parts[1])
        except Exception:
            pass

        length = byte_end - byte_start + 1

        def generate():
            with open(music_path, "rb") as f:
                f.seek(byte_start)
                remaining = length
                chunk = 65536
                while remaining > 0:
                    data = f.read(min(chunk, remaining))
                    if not data:
                        break
                    yield data
                    remaining -= len(data)

        return StreamingResponse(
            generate(),
            status_code=206,
            media_type=mime,
            headers={
                "Content-Range": f"bytes {byte_start}-{byte_end}/{file_size}",
                "Content-Length": str(length),
                "Accept-Ranges": "bytes",
            },
        )

    return FileResponse(
        path=music_path,
        media_type=mime,
        headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
    )
