"""Tournix — fields."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from models.core import User
from models.tournix import TournixField

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class FieldCreate(BaseModel):
    name:    str
    club_id: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tournaments/{tid}/fields")
def list_fields(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(TournixField).where(TournixField.tournament_id == tid)).all()


@router.post("/tournaments/{tid}/fields", status_code=201)
def create_field(
    tid: str,
    body: FieldCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    field = TournixField(tournament_id=tid, **body.model_dump())
    session.add(field)
    session.commit()
    session.refresh(field)
    return field


@router.delete("/fields/{field_id}", status_code=204)
def delete_field(field_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    field = session.get(TournixField, field_id)
    if not field:
        raise HTTPException(404, "Veld niet gevonden")
    session.delete(field)
    session.commit()
