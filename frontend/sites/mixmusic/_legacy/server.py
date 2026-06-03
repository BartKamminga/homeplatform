#!/usr/bin/env python3
"""
Mix Music - Flask Server
Draait in Docker op Synology NAS.
Serveert de muziekmap als HTTP API voor de browser.
"""

import os
import json
import urllib.parse
from pathlib import Path
from flask import Flask, jsonify, send_file, abort, request, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="")

MUSIC_DIR = Path(os.environ.get("MUSIC_DIR", "/music"))
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


def scan_tracks():
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


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "music_dir": str(MUSIC_DIR), "exists": MUSIC_DIR.exists()})


@app.route("/api/tracks")
def api_tracks():
    tracks = scan_tracks()
    return jsonify(tracks)


@app.route("/music/<path:filename>")
def serve_music(filename):
    filename = urllib.parse.unquote(filename)
    filepath = MUSIC_DIR / filename

    # Beveiligingscheck: pad mag niet buiten MUSIC_DIR komen
    try:
        filepath.resolve().relative_to(MUSIC_DIR.resolve())
    except ValueError:
        abort(403)

    if not filepath.exists() or filepath.suffix.lower() not in MUSIC_EXTENSIONS:
        abort(404)

    mime = MIME_TYPES.get(filepath.suffix.lower(), "audio/mpeg")

    # Range request afhandeling (voor seek in browser)
    range_header = request.headers.get("Range")
    file_size = filepath.stat().st_size

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
            with open(filepath, "rb") as f:
                f.seek(byte_start)
                remaining = length
                chunk = 65536
                while remaining > 0:
                    data = f.read(min(chunk, remaining))
                    if not data:
                        break
                    yield data
                    remaining -= len(data)

        from flask import Response
        resp = Response(
            generate(),
            status=206,
            mimetype=mime,
            direct_passthrough=True,
        )
        resp.headers["Content-Range"] = f"bytes {byte_start}-{byte_end}/{file_size}"
        resp.headers["Content-Length"] = str(length)
        resp.headers["Accept-Ranges"] = "bytes"
        return resp

    return send_file(filepath, mimetype=mime, conditional=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    print(f"Mix Music server gestart op http://0.0.0.0:{port}")
    print(f"Muziekmap: {MUSIC_DIR} ({'gevonden' if MUSIC_DIR.exists() else 'NIET GEVONDEN'})")
    app.run(host="0.0.0.0", port=port, debug=False)
