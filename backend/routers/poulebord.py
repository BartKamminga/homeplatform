"""Poulebord - publieke endpoints: bezoekteller (beacon) en gedeelde boards
(opslaan/openen via een korte code). De standen en wedstrijden zelf komen uit
Hockey Discovery (/api/hockey/public/...).

Item 1268: los van Tournix. Eigen URL-ruimte /api/poulebord/...; de oude paden
/api/tournix/public/{beacon,boards} blijven tijdelijk bestaan (legacy_router)
voor browsers die nog een oude Poulebord-build in de cache hebben. De
Tournix-leesroutes (fases, fase-standen, poule-wedstrijden, zoeken) zijn weg -
er staan geen Tournix-toernooien meer live (#685)."""

import json
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session

from core.analytics import client_ip, hash_ip, log_site_event
from core.database import get_session
from models.poulebord import PoulebordBoard

router = APIRouter(prefix="/api/poulebord", tags=["poulebord"])
# TODO(1269): weghalen samen met de Tournix-archivering.
legacy_router = APIRouter(prefix="/api/tournix", tags=["poulebord"], include_in_schema=False)

BOARD_CODE_CHARS = string.ascii_lowercase + string.digits


class BoardCreate(BaseModel):
    name:      str
    club:      str       = ""
    pins:      list      = []
    pool_pins: list      = []


def _board_out(board: PoulebordBoard) -> dict:
    return {
        "id":        board.id,
        "name":      board.name,
        "club":      board.club,
        "pins":      json.loads(board.pins),
        "pool_pins": json.loads(board.pool_pins),
    }


def _new_board_code(session: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(BOARD_CODE_CHARS) for _ in range(6))
        if not session.get(PoulebordBoard, code):
            return code
    raise RuntimeError("Geen unieke code gevonden")


def poulebord_beacon(request: Request):
    """Log a page view from the poulebord frontend."""
    log_site_event(
        "poulebord", "page_view",
        ip_hash=hash_ip(client_ip(request)),
        user_agent=request.headers.get("User-Agent", ""),
    )
    return {"ok": True}


def create_board(body: BoardCreate, session: Session = Depends(get_session)):
    if not body.name.strip():
        raise HTTPException(400, "Naam is verplicht")
    board = PoulebordBoard(
        id=_new_board_code(session),
        name=body.name.strip(),
        club=body.club,
        pins=json.dumps(body.pins),
        pool_pins=json.dumps(body.pool_pins),
    )
    session.add(board)
    session.commit()
    session.refresh(board)
    return _board_out(board)


def get_board_by_code(code: str, session: Session = Depends(get_session)):
    board = session.get(PoulebordBoard, code)
    if not board:
        raise HTTPException(404, "Board niet gevonden")
    return _board_out(board)


for _r in (router, legacy_router):
    _r.add_api_route("/public/beacon", poulebord_beacon, methods=["POST"])
    _r.add_api_route("/public/boards", create_board, methods=["POST"], status_code=201)
    _r.add_api_route("/public/boards/{code}", get_board_by_code, methods=["GET"])
