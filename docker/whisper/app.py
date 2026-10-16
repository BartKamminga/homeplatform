"""Whisper-dienst (item 1355) - spraak naar tekst voor Dossiers, draait op G4 zodat g5 (prod) er geen last van heeft.

Alleen bereikbaar op het thuisnetwerk en afgeschermd met een token (header X-Whisper-Token).
Audio wordt niet bewaard: tijdelijk bestand, transcriberen, weggooien.

POST /transcribe  multipart 'audio' (+ optioneel 'language', default nl)
  -> {"text": "...", "segments": [{"start": 0.0, "end": 4.2, "text": "..."}], "duration": 812.3, "language": "nl"}
GET  /health      -> {"ok": true, "model": "small"}
"""
import os
import secrets
import tempfile

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
TOKEN = os.environ.get("WHISPER_TOKEN", "")
THREADS = int(os.environ.get("WHISPER_THREADS", "3"))  # G4 heeft 4 cores; 1 vrij houden voor acc/bugsink

app = FastAPI(title="HomePlatform Whisper")
model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8", cpu_threads=THREADS,
                     download_root="/models")


def _check(token: str | None) -> None:
    if not TOKEN or not token or not secrets.compare_digest(token, TOKEN):
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.post("/transcribe")
def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("nl"),
    x_whisper_token: str | None = Header(default=None),
):
    _check(x_whisper_token)
    suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(audio.file.read())
        tmp.flush()
        segments, info = model.transcribe(tmp.name, language=language or None, vad_filter=True, beam_size=5)
        parts = [{"start": round(s.start, 1), "end": round(s.end, 1), "text": s.text.strip()} for s in segments]
    return {
        "text": " ".join(p["text"] for p in parts),
        "segments": parts,
        "duration": round(info.duration, 1),
        "language": info.language,
    }
