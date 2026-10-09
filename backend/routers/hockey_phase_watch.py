"""Item 1254: volglijst 'wacht op nieuwe fase' / 'wacht op zaal-indeling' -
aanzetten per competitie-koppeling (Publicatie -> Competities) en het
voortgangsoverzicht (Vanger). Logica in services/hockey_phase_watch.py; los
bestand omdat hockey_publication.py al ~500 regels is."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user, require_admin
from core.database import get_session
from models.hockey import HockeyPublicationComp
from services.hockey_phase_watch import KINDS, scope_status, set_watch, watched_scopes

router = APIRouter(prefix="/api/hockey", tags=["hockey-phase-watch"])


class WatchToggle(BaseModel):
    kind: str
    on:   bool


@router.put("/publications/{pid}/competitions/{link_id}/watch")
def toggle_watch(pid: str, link_id: str, body: WatchToggle, session: Session = Depends(get_session), _=Depends(require_admin)):
    if body.kind not in KINDS:
        raise HTTPException(400, "Onbekende soort")
    lnk = session.get(HockeyPublicationComp, link_id)
    if not lnk or lnk.publication_id != pid:
        raise HTTPException(404, "Koppeling niet gevonden")
    set_watch(session, lnk, body.kind, body.on, datetime.utcnow())
    session.commit()
    return {
        "watch_next_phase": lnk.watch_next_phase_since is not None,
        "watch_zaal":       lnk.watch_zaal_since is not None,
    }


@router.get("/vanger/phase-watch")
def list_phase_watch(session: Session = Depends(get_session), _=Depends(get_current_user)):
    now = datetime.utcnow()
    return [scope_status(session, scope, now) for scope in watched_scopes(session)]
