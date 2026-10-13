"""VBT — live backup tijdens de rit (POST /api/vbt/rides/live).

De game stuurt elke ~15 s alleen de nieuwe samples. De server bewaart de rit als in_progress; bij de finish
rondt POST /api/vbt/rides (met hetzelfde client_id) hem af. Valt het apparaat helemaal weg, dan staat de rit
tot de laatste sync gewoon in het overzicht.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.vbt import VbtRide
from routers.vbt import CamelModel
from services.vbt_rides import naive_utc, summarize

router = APIRouter(prefix="/api/vbt", tags=["vbt"])
MAX_SAMPLES_PER_CALL = 3600


class LiveIn(CamelModel):
    client_id: str
    started_at: datetime
    kind: str = "free"
    course_key: str
    name: str = "Free Ride"
    wo_id: Optional[str] = None
    ftp: Optional[int] = None
    jumped: bool = False
    from_index: int = 0          # vanaf welke sample deze batch begint (= wat de server al had)
    resume: bool = False         # oude rit hervat: afgeronde rit weer openzetten
    samples: list = []


@router.post("/rides/live")
def live_sync(body: LiveIn, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if len(body.samples) > MAX_SAMPLES_PER_CALL:
        raise HTTPException(status_code=422, detail="Te veel samples in één batch")
    ride = session.exec(select(VbtRide).where(VbtRide.client_id == body.client_id)).first()
    if ride and ride.user_id != current_user.id:
        raise HTTPException(status_code=409, detail="client_id is al in gebruik")
    if ride and not ride.in_progress:
        if not body.resume:
            return {"received": len(ride.samples or []), "inProgress": False}   # al afgerond: niets meer doen
        ride.in_progress = True                                               # hervat: weer live
    if not ride:
        ride = VbtRide(user_id=current_user.id, client_id=body.client_id, started_at=naive_utc(body.started_at),
                       kind=body.kind, course_key=body.course_key, name=body.name, wo_id=body.wo_id, ftp=body.ftp,
                       in_progress=True, samples=[])
    have = list(ride.samples or [])
    if body.from_index > len(have):
        # er mist een stuk (vorige batch kwam niet aan): niets toevoegen, de game stuurt opnieuw vanaf 'received'
        return {"received": len(have), "inProgress": True}
    have = have[:body.from_index] + body.samples
    ride.samples = have
    ride.jumped = ride.jumped or body.jumped
    for k, v in summarize(have).items():
        setattr(ride, k, v)
    ride.synced_at = datetime.utcnow()
    session.add(ride)
    session.commit()
    return {"received": len(have), "inProgress": True}
