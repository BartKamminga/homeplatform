import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from core.auth import get_current_user
from core.settings import settings
from models.core import User

router = APIRouter(prefix="/api/uploads", tags=["uploads"])
logger = logging.getLogger(__name__)

UPLOAD_ROOT = Path(settings.UPLOAD_ROOT).resolve()
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_SIZE_MB = 10


def _safe_path(category: str, user_id: str, filename: str) -> Path:
    """Geeft absoluut pad terug; gooit 400 bij path traversal poging."""
    candidate = (UPLOAD_ROOT / category / user_id / filename).resolve()
    if not str(candidate).startswith(str(UPLOAD_ROOT)):
        raise HTTPException(status_code=400, detail="Ongeldig pad")
    return candidate


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    category: str = "general",
    user: User = Depends(get_current_user),
):
    ext = Path(file.filename or "upload").suffix.lower() or ".jpg"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Bestandsextensie niet toegestaan: {ext}")
    if file.content_type not in ALLOWED_TYPES:
        allowed = ", ".join(ALLOWED_TYPES)
        raise HTTPException(status_code=400, detail=f"Bestandstype niet toegestaan: {file.content_type}. Toegestaan: {allowed}")

    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Bestand te groot. Maximum is {MAX_SIZE_MB}MB")

    ext = Path(file.filename or "upload").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"

    abs_path = _safe_path(category, user.id, filename)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(content)

    rel_path = f"{category}/{user.id}/{filename}"
    logger.info("Upload: %s door user %s", rel_path, user.id)

    return {
        "path": rel_path,
        "url": f"/api/uploads/{rel_path}",
        "filename": filename,
        "size": len(content),
        "content_type": file.content_type,
    }


@router.get("/{category}/{user_id}/{filename}")
async def get_file(category: str, user_id: str, filename: str):
    abs_path = _safe_path(category, user_id, filename)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    return FileResponse(str(abs_path))


@router.delete("/{category}/{user_id}/{filename}")
async def delete_file(
    category: str,
    user_id: str,
    filename: str,
    user: User = Depends(get_current_user),
):
    if user_id != user.id:
        raise HTTPException(status_code=403, detail="Geen toegang")

    abs_path = _safe_path(category, user_id, filename)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")

    abs_path.unlink()
    return {"ok": True}
