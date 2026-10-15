"""Dossiers router (item 1355) - per gebruiker eigen dossiers."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from core.exceptions import AppError
from core.logging import log_action
from models.core import User
import services.dossier_export as export_svc
import services.dossier_files as files
import services.dossiers as svc

router = APIRouter(prefix="/api/dossiers", tags=["dossiers"])


class DossierIn(BaseModel):
    name: str
    summary: Optional[str] = None
    mail_criteria: Optional[str] = None
    status: str = "active"  # "proposed" als Claude het dossier in een mailronde aanmaakt


class DossierPatch(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None
    mail_criteria: Optional[str] = None
    status: Optional[str] = None


class EntryIn(BaseModel):
    kind: str = "note"
    title: str
    body: Optional[str] = None
    source_url: Optional[str] = None
    occurred_at: Optional[datetime] = None
    external_ref: Optional[str] = None
    review: Optional[str] = None  # "proposed" voor een mailvoorstel van Claude
    reason: Optional[str] = None


class EntryPatch(BaseModel):
    dossier_id: Optional[str] = None  # verplaatsen naar een ander dossier
    kind: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    source_url: Optional[str] = None
    occurred_at: Optional[datetime] = None
    pinned: Optional[bool] = None


class RefsIn(BaseModel):
    refs: list[str]


class ReviewIn(BaseModel):
    decision: str  # accept | reject


def _dossier_out(session: Session, dossier) -> dict:
    return {
        "id": dossier.id, "name": dossier.name, "slug": dossier.slug, "summary": dossier.summary,
        "mail_criteria": dossier.mail_criteria, "status": dossier.status,
        "created_at": dossier.created_at, "updated_at": dossier.updated_at,
        **svc.counts(session, dossier),
    }


# --- Dossiers ---------------------------------------------------------------

@router.get("")
def list_dossiers(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return [_dossier_out(session, d) for d in svc.list_dossiers(session, user)]


@router.post("", status_code=201)
def create_dossier(body: DossierIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    dossier = svc.create_dossier(session, user, body.name, body.summary, body.mail_criteria, body.status)
    log_action(session, "dossiers.create", site="dossiers", user_id=user.id, payload={"dossier_id": dossier.id})
    return _dossier_out(session, dossier)


@router.get("/inbox")
def inbox(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    data = svc.inbox(session, user)
    return {"dossiers": [_dossier_out(session, d) for d in data["dossiers"]], "entries": data["entries"]}


@router.post("/refs/check")
def check_refs_all(body: RefsIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return svc.check_refs_all(session, user, body.refs)


@router.get("/search")
def search(q: str, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return [
        {**svc.entry_to_dict(entry), "dossier_name": dossier.name, "dossier_slug": dossier.slug}
        for entry, dossier in svc.search_all(session, user, q)
    ]


@router.get("/{dossier_id}")
def get_dossier(dossier_id: str, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return _dossier_out(session, svc.get_dossier(session, user, dossier_id))


@router.patch("/{dossier_id}")
def update_dossier(
    dossier_id: str, body: DossierPatch,
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    return _dossier_out(session, svc.update_dossier(session, user, dossier_id, **body.model_dump()))


@router.get("/{dossier_id}/export", response_class=PlainTextResponse)
def export(dossier_id: str, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return export_svc.export_markdown(session, user, dossier_id)


# --- Entries ----------------------------------------------------------------

@router.get("/{dossier_id}/entries")
def list_entries(
    dossier_id: str, q: Optional[str] = None, kind: Optional[str] = None, review: Optional[str] = None,
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    return [svc.entry_to_dict(e) for e in svc.list_entries(session, user, dossier_id, q, kind, review)]


@router.post("/{dossier_id}/entries", status_code=201)
def add_entry(
    dossier_id: str, body: EntryIn,
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    entry, created = svc.add_entry(session, user, dossier_id, **body.model_dump())
    return {**svc.entry_to_dict(entry), "created": created}


@router.post("/{dossier_id}/refs/check")
def check_refs(
    dossier_id: str, body: RefsIn,
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    return svc.check_refs(session, user, dossier_id, body.refs)


@router.post("/{dossier_id}/upload", status_code=201)
async def upload(
    dossier_id: str, uploads: list[UploadFile] = File(...),
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    """Meerdere bestanden tegelijk; per bestand een resultaat (een fout bij één
    bestand stopt de rest niet)."""
    results = []
    for upload_file in uploads:
        content = await upload_file.read()
        try:
            entry, created = files.save_file(
                session, user, dossier_id, upload_file.filename, content, upload_file.content_type,
            )
            results.append({**svc.entry_to_dict(entry), "created": created})
        except AppError as err:
            results.append({"original_filename": upload_file.filename, "error": err.detail})
    log_action(session, "dossiers.upload", site="dossiers", user_id=user.id,
               payload={"dossier_id": dossier_id, "files": [r.get("original_filename") for r in results]})
    return results


@router.patch("/entries/{entry_id}")
def update_entry(
    entry_id: str, body: EntryPatch,
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    return svc.entry_to_dict(svc.update_entry(session, user, entry_id, **body.model_dump()))


@router.post("/entries/{entry_id}/review")
def review_entry(
    entry_id: str, body: ReviewIn,
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    return svc.entry_to_dict(svc.review_entry(session, user, entry_id, body.decision))


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: str, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    svc.delete_entry(session, user, entry_id)


@router.get("/entries/{entry_id}/download")
def download(entry_id: str, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    path, entry = files.file_for_download(session, user, entry_id)
    return FileResponse(str(path), filename=entry.original_filename, media_type=entry.content_type)
