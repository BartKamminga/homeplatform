"""VBT — eigen routes (item 1365): /api/vbt/routes. De GPX wordt in de browser omgezet naar secties
(meter, helling, bocht); de server bewaart en controleert alleen de vorm."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.vbt import VbtRoute
from services import vbt_mapillary as mly

router = APIRouter(prefix="/api/vbt", tags=["vbt"])
MAX_SECTIONS = 3000          # ~300 km bij secties van 100 m


class RouteIn(BaseModel):
    name: str = PField(min_length=1, max_length=120)
    source: str = "gpx"
    segments: List[List[float]]
    curves: List[float] = []
    points: Optional[List[List[float]]] = None        # [lat, lon] per sectie (Real Ride)


def _out(r: VbtRoute, full: bool = False) -> dict:
    out = {"id": r.id, "slug": "gpx-" + r.id, "name": r.name, "source": r.source, "distance": r.distance,
           "elevation": r.elevation, "avgGrade": round(r.elevation / max(1, r.distance) * 100, 1), "mine": True,
           "hasPoints": bool(r.points), "photoCount": len(r.photos or [])}
    if full:
        out["segments"] = r.segments or []
        out["curves"] = r.curves or []
    return out


def _own(route_id: str, user: User, session: Session) -> VbtRoute:
    r = session.get(VbtRoute, route_id)
    if not r or r.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Route niet gevonden")
    return r


@router.get("/routes")
def list_routes(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    rows = session.exec(select(VbtRoute).where(VbtRoute.owner_id == current_user.id).order_by(VbtRoute.name)).all()
    return [_out(r) for r in rows]


@router.get("/routes/{route_id}")
def get_route(route_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return _out(_own(route_id, current_user, session), full=True)


@router.post("/routes")
def create_route(body: RouteIn, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    segs = body.segments
    if not segs or len(segs) > MAX_SECTIONS or any(len(s) != 2 or not 1 <= s[0] <= 1000 or abs(s[1]) > 30 for s in segs):
        raise HTTPException(status_code=422, detail="Ongeldige route: secties [meter 1-1000, helling max 30%]")
    if body.points is not None and len(body.points) != len(segs):
        raise HTTPException(status_code=422, detail="Aantal punten past niet bij de secties")
    if body.curves and len(body.curves) != len(segs):
        raise HTTPException(status_code=422, detail="Aantal bochten past niet bij de secties")
    distance = round(sum(s[0] for s in segs))
    elevation = round(sum(max(0, s[0] * s[1] / 100) for s in segs))
    r = VbtRoute(owner_id=current_user.id, name=body.name.strip(), source=body.source[:20],
                 segments=[[round(s[0], 1), round(s[1], 2)] for s in segs],
                 curves=[round(max(-8, min(8, c)), 2) for c in body.curves], distance=distance, elevation=elevation,
                 points=[[round(p[0], 6), round(p[1], 6)] for p in body.points] if body.points else None)
    session.add(r)
    session.commit()
    session.refresh(r)
    return _out(r, full=True)


@router.delete("/routes/{route_id}")
def delete_route(route_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    session.delete(_own(route_id, current_user, session))
    session.commit()
    return {"ok": True}


# ── Real Ride: straatfoto's (Mapillary) langs de route ─────────────────────────────────────────

@router.get("/realride")
def realride_status(_: User = Depends(get_current_user)):
    return {"configured": mly.configured()}


@router.post("/routes/{route_id}/photos")
async def find_route_photos(route_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    r = _own(route_id, current_user, session)
    if not mly.configured():
        raise HTTPException(status_code=503, detail="Mapillary is niet ingesteld (MAPILLARY_TOKEN)")
    if not r.points:
        raise HTTPException(status_code=422, detail="Deze route heeft geen coordinaten; importeer de GPX opnieuw")
    r.photos = await mly.find_photos(r.points)
    session.add(r)
    session.commit()
    return {"photoCount": len(r.photos), "sections": len(r.points)}


@router.get("/routes/{route_id}/photos")
async def route_photos(route_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    r = _own(route_id, current_user, session)
    if not r.photos:
        return []
    urls = await mly.photo_urls([p[1] for p in r.photos]) if mly.configured() else {}
    return [{"i": i, "id": pid, "angle": a, **urls[pid]} for i, pid, a in r.photos if pid in urls]