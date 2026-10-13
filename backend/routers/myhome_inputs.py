"""MyHome invoer - bronnen (tekeningen/foto's) en verbeteringen in gewone taal (item 1314).

Bestanden zelf gaan via /api/uploads (categorie "myhome"); hier wordt alleen het record vastgelegd.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.myhome import HomeNote, HomeSource
from services.myhome import get_owned_home

router = APIRouter(prefix="/api/myhome", tags=["myhome"])

SOURCE_KINDS = {"drawing", "photo", "document"}
NOTE_STATUSES = {"open", "applied", "rejected"}


class SourceIn(BaseModel):
    kind: str = "drawing"
    title: str
    file_path: str
    floor_key: Optional[str] = None


class NoteIn(BaseModel):
    text: str


class NotePatch(BaseModel):
    status: Optional[str] = None
    response: Optional[str] = None


def _source_dict(s: HomeSource) -> dict:
    return {
        "id": s.id, "kind": s.kind, "title": s.title, "floor_key": s.floor_key,
        "file_path": s.file_path, "url": f"/api/uploads/{s.file_path}",
        "created_at": s.created_at.isoformat(),
    }


def _note_dict(n: HomeNote) -> dict:
    return {
        "id": n.id, "text": n.text, "status": n.status, "response": n.response,
        "created_at": n.created_at.isoformat(),
        "resolved_at": n.resolved_at.isoformat() if n.resolved_at else None,
    }


@router.get("/homes/{home_id}/sources")
def list_sources(home_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    get_owned_home(session, home_id, user.id)
    rows = session.exec(
        select(HomeSource).where(HomeSource.home_id == home_id).order_by(HomeSource.created_at)
    ).all()
    return [_source_dict(s) for s in rows]


@router.post("/homes/{home_id}/sources", status_code=201)
def add_source(home_id: str, body: SourceIn, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    get_owned_home(session, home_id, user.id)
    if body.kind not in SOURCE_KINDS:
        raise HTTPException(status_code=422, detail=f"Unknown source kind: {body.kind}")
    if not body.file_path.startswith(f"myhome/{user.id}/"):
        raise HTTPException(status_code=422, detail="Upload the file first via /api/uploads?category=myhome")
    src = HomeSource(home_id=home_id, **body.model_dump())
    session.add(src)
    session.commit()
    session.refresh(src)
    return _source_dict(src)


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(source_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    src = session.get(HomeSource, source_id)
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    get_owned_home(session, src.home_id, user.id)
    session.delete(src)
    session.commit()


@router.get("/homes/{home_id}/notes")
def list_notes(home_id: str, status: Optional[str] = None, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    get_owned_home(session, home_id, user.id)
    q = select(HomeNote).where(HomeNote.home_id == home_id)
    if status:
        q = q.where(HomeNote.status == status)
    return [_note_dict(n) for n in session.exec(q.order_by(HomeNote.created_at.desc())).all()]


@router.post("/homes/{home_id}/notes", status_code=201)
def add_note(home_id: str, body: NoteIn, user: User = Depends(get_current_user),
             session: Session = Depends(get_session)):
    get_owned_home(session, home_id, user.id)
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text is empty")
    note = HomeNote(home_id=home_id, text=text)
    session.add(note)
    session.commit()
    session.refresh(note)
    return _note_dict(note)


@router.patch("/notes/{note_id}")
def update_note(note_id: str, body: NotePatch, user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    note = session.get(HomeNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    get_owned_home(session, note.home_id, user.id)
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        if data["status"] not in NOTE_STATUSES:
            raise HTTPException(status_code=422, detail=f"Unknown status: {data['status']}")
        note.resolved_at = None if data["status"] == "open" else datetime.utcnow()
    for k, v in data.items():
        setattr(note, k, v)
    session.add(note)
    session.commit()
    return _note_dict(note)
