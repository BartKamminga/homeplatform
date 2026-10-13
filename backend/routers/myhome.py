"""MyHome router - huismodel beheren en de open v1-API (item 1314).

Alles is per eigenaar. Uitlezen kan met een gewone login-token of met een persoonlijke API-key (hp_...).
Invoer (bronnen en tekstuele verbeteringen) zit in routers/myhome_inputs.py.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.myhome import Home, HomeDevice, HomeFloor, HomeNote, HomeRoom, HomeSource
from services.myhome import (
    LINK_STATUSES, ROOM_KINDS, adopt_area_devices, export_home, get_owned_home, replace_layout,
)

router = APIRouter(prefix="/api/myhome", tags=["myhome"])


class HomeIn(BaseModel):
    name: str
    garden_orientation: Optional[str] = None
    notes: Optional[str] = None
    meta: Optional[dict] = None


class HomePatch(BaseModel):
    name: Optional[str] = None
    garden_orientation: Optional[str] = None
    notes: Optional[str] = None
    meta: Optional[dict] = None


class LayoutIn(BaseModel):
    floors: list[dict]


class RoomPatch(BaseModel):
    name: Optional[str] = None
    polygon: Optional[list[list[float]]] = None
    label_at: Optional[list[float]] = None
    meta: Optional[dict] = None
    kind: Optional[str] = None
    ha_area: Optional[str] = None
    link_status: Optional[str] = None
    notes: Optional[str] = None


@router.get("/homes")
def list_homes(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    homes = session.exec(select(Home).where(Home.user_id == user.id).order_by(Home.created_at)).all()
    return [{"id": h.id, "name": h.name, "updated_at": h.updated_at.isoformat()} for h in homes]


@router.post("/homes", status_code=201)
def create_home(body: HomeIn, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    home = Home(user_id=user.id, **body.model_dump())
    session.add(home)
    session.commit()
    session.refresh(home)
    return export_home(session, home)


@router.get("/homes/{home_id}")
def get_home(home_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return export_home(session, get_owned_home(session, home_id, user.id))


@router.patch("/homes/{home_id}")
def update_home(home_id: str, body: HomePatch, user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    home = get_owned_home(session, home_id, user.id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(home, k, v)
    home.updated_at = datetime.utcnow()
    session.add(home)
    session.commit()
    return export_home(session, home)


@router.delete("/homes/{home_id}", status_code=204)
def delete_home(home_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    home = get_owned_home(session, home_id, user.id)
    for model in (HomeDevice, HomeRoom, HomeFloor, HomeSource, HomeNote):
        for row in session.exec(select(model).where(model.home_id == home.id)).all():
            session.delete(row)
    session.delete(home)
    session.commit()


@router.put("/homes/{home_id}/layout")
def put_layout(home_id: str, body: LayoutIn, user: User = Depends(get_current_user),
               session: Session = Depends(get_session)):
    """Vervangt verdiepingen + ruimtes in een keer (bv. na het uitlezen van een plattegrond)."""
    home = get_owned_home(session, home_id, user.id)
    replace_layout(session, home, body.floors)
    return export_home(session, home)


@router.patch("/rooms/{room_id}")
def update_room(room_id: str, body: RoomPatch, user: User = Depends(get_current_user),
                session: Session = Depends(get_session)):
    room = session.get(HomeRoom, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    home = get_owned_home(session, room.home_id, user.id)
    data = body.model_dump(exclude_unset=True)
    if "kind" in data and data["kind"] not in ROOM_KINDS:
        raise HTTPException(status_code=422, detail=f"Unknown room kind: {data['kind']}")
    if "link_status" in data and data["link_status"] not in LINK_STATUSES:
        raise HTTPException(status_code=422, detail=f"Unknown link status: {data['link_status']}")
    if "polygon" in data and (len(data["polygon"]) < 3 or any(len(p) != 2 for p in data["polygon"])):
        raise HTTPException(status_code=422, detail="A room needs at least 3 corner points [x, z]")
    for k, v in data.items():
        setattr(room, k, v)
    if room.link_status == "linked" and room.ha_area and {"ha_area", "link_status"} & data.keys():
        adopt_area_devices(session, room)
    home.updated_at = datetime.utcnow()
    session.add(room)
    session.add(home)
    session.commit()
    return export_home(session, home)


# ---------------------------------------------------------------------------
# Open API v1 - alleen lezen, stabiel contract voor Hue/HA/tado-koppelingen
# ---------------------------------------------------------------------------

@router.get("/v1/homes")
def v1_list_homes(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return list_homes(user, session)


@router.get("/v1/homes/{home_id}")
def v1_get_home(home_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return export_home(session, get_owned_home(session, home_id, user.id))


@router.get("/v1/homes/{home_id}/rooms")
def v1_list_rooms(home_id: str, floor: Optional[str] = None, kind: Optional[str] = None,
                  ha_area: Optional[str] = None, user: User = Depends(get_current_user),
                  session: Session = Depends(get_session)):
    """Platte lijst ruimtes, te filteren op verdieping (key), soort of HA-ruimte."""
    data = export_home(session, get_owned_home(session, home_id, user.id))
    rooms = [r for f in data["floors"] for r in f["rooms"]]
    if floor:
        rooms = [r for r in rooms if r["floor"] == floor]
    if kind:
        rooms = [r for r in rooms if r["kind"] == kind]
    if ha_area:
        rooms = [r for r in rooms if (r["ha_area"] or "").lower() == ha_area.lower()]
    return rooms
