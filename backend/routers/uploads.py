import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlmodel import Session

from core.database import get_session
from core.auth import get_current_user
from models.core import User

router = APIRouter(prefix="/api/uploads", tags=["uploads"])
print(f">>> UPLOAD_ROOT at import: {os.getenv('UPLOAD_ROOT')}")
UPLOAD_ROOT = os.getenv("UPLOAD_ROOT", "/app/uploads")
UPLOAD_ROOT = os.getenv("UPLOAD_ROOT", "/app/uploads")
if not os.path.isabs(UPLOAD_ROOT):
    UPLOAD_ROOT = os.path.abspath(UPLOAD_ROOT)
print(f">>> UPLOAD_ROOT absolute: {UPLOAD_ROOT}")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB = 10
print(f">>> UPLOAD_ROOT resolved: {UPLOAD_ROOT}")


def get_upload_path(category: str, user_id: str, filename: str) -> str:
    """Geeft het absolute pad terug voor een upload."""
    safe_category = category.replace("/", "").replace("..", "")
    safe_filename = filename.replace("/", "").replace("..", "")
    return os.path.join(UPLOAD_ROOT, safe_category, user_id, safe_filename)


def get_relative_path(category: str, user_id: str, filename: str) -> str:
    """Geeft het relatieve pad terug (opgeslagen in database)."""
    return f"{category}/{user_id}/{filename}"


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    category: str = "general",
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Upload een bestand naar de NAS."""
    print(f"UPLOAD_ROOT = {UPLOAD_ROOT}")
    print(">>> upload_file aangeroepen")
    print(f">>> UPLOAD_ROOT: {UPLOAD_ROOT}")
    print(f">>> category: {category}")

    # Valideer bestandstype
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Bestandstype niet toegestaan: {file.content_type}. Toegestaan: {', '.join(ALLOWED_TYPES)}",
        )

    # Lees bestand en valideer grootte
    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400, detail=f"Bestand te groot. Maximum is {MAX_SIZE_MB}MB"
        )

    # Genereer unieke bestandsnaam
    ext = os.path.splitext(file.filename or "upload")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"

    # Maak map aan en sla op
    abs_path = get_upload_path(category, user.id, filename)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

    with open(abs_path, "wb") as f:
        f.write(content)

    rel_path = get_relative_path(category, user.id, filename)

    return {
        "path": rel_path,
        "url": f"/api/uploads/{rel_path}",
        "filename": filename,
        "size": len(content),
        "content_type": file.content_type,
    }


@router.get("/{category}/{user_id}/{filename}")
async def get_file(
    category: str,
    user_id: str,
    filename: str,
):
    """Haal een geupload bestand op (publiek leesbaar, upload vereist auth)."""
    abs_path = get_upload_path(category, user_id, filename)

    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")

    return FileResponse(abs_path)


@router.delete("/{category}/{user_id}/{filename}")
async def delete_file(
    category: str,
    user_id: str,
    filename: str,
    user: User = Depends(get_current_user),
):
    """Verwijder een geupload bestand."""
    # Alleen eigen bestanden verwijderen
    if user_id != user.id:
        raise HTTPException(status_code=403, detail="Geen toegang")

    abs_path = get_upload_path(category, user_id, filename)

    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")

    os.remove(abs_path)
    return {"ok": True}
