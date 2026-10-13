"""VBT (Virtual Bike Trainer) router — profiel/trainingsplan, ritten (met samples voor ghost en FIT) en Strava.

De API spreekt camelCase, net als de ritobjecten in de game (frontend/sites/vbt).
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import Session, select

from core.analytics import client_ip, hash_ip, log_site_event
from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.vbt import VbtProfile, VbtRide, VbtStravaLink
from services import vbt_strava as strava

router = APIRouter(prefix="/api/vbt", tags=["vbt"])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ProfileIn(CamelModel):
    ftp: Optional[int] = None
    plan_start: Optional[str] = None
    plan_done: Optional[dict] = None


class RideIn(CamelModel):
    client_id: Optional[str] = None
    started_at: datetime
    kind: str = "free"
    course_key: str
    name: str = "Free Ride"
    wo_id: Optional[str] = None
    duration: int = 0
    distance: int = 0
    avg_w: int = 0
    max_w: int = 0
    avg_cad: int = 0
    avg_hr: int = 0
    kj: int = 0
    elevation: int = 0
    lap_time: Optional[float] = None
    jumped: bool = False
    score: Optional[int] = None
    ftp: Optional[int] = None
    samples: list = []


SUMMARY_FIELDS = ["id", "client_id", "started_at", "kind", "course_key", "name", "wo_id", "duration", "distance", "avg_w", "max_w",
                  "avg_cad", "avg_hr", "kj", "elevation", "lap_time", "jumped", "pb", "score", "ftp",
                  "strava_activity_id", "strava_status", "strava_error"]


def _ride_out(ride: VbtRide, with_samples: bool = False) -> dict:
    out = {to_camel(f): getattr(ride, f) for f in SUMMARY_FIELDS}
    out["startedAt"] = ride.started_at.isoformat() + ("Z" if ride.started_at.tzinfo is None else "")
    if with_samples:
        out["samples"] = ride.samples or []
    return out


def _own_ride(ride_id: str, user: User, session: Session) -> VbtRide:
    ride = session.get(VbtRide, ride_id)
    if not ride or ride.user_id != user.id:
        raise HTTPException(status_code=404, detail="Rit niet gevonden")
    return ride


# ── Profiel + trainingsplan ──────────────────────────────────────────────────

@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    p = session.get(VbtProfile, current_user.id) or VbtProfile(user_id=current_user.id)
    return {"ftp": p.ftp, "planStart": p.plan_start, "planDone": p.plan_done or {}}


@router.put("/profile")
def put_profile(body: ProfileIn, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    p = session.get(VbtProfile, current_user.id) or VbtProfile(user_id=current_user.id)
    if body.ftp is not None:
        if not 50 <= body.ftp <= 600:
            raise HTTPException(status_code=422, detail="FTP moet tussen 50 en 600 W liggen")
        p.ftp = body.ftp
    if body.plan_start is not None:
        p.plan_start = body.plan_start
    if body.plan_done is not None:
        p.plan_done = body.plan_done
    p.updated_at = datetime.utcnow()
    session.add(p)
    session.commit()
    return {"ftp": p.ftp, "planStart": p.plan_start, "planDone": p.plan_done or {}}


# ── Ritten ───────────────────────────────────────────────────────────────────

@router.get("/rides")
def list_rides(limit: int = 50, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    rides = session.exec(
        select(VbtRide).where(VbtRide.user_id == current_user.id)
        .order_by(VbtRide.started_at.desc()).limit(min(limit, 200))
    ).all()
    return [_ride_out(r) for r in rides]


@router.post("/rides")
def save_ride(body: RideIn, request: Request, current_user: User = Depends(get_current_user),
              session: Session = Depends(get_session)):
    # idempotent: dezelfde rit nog een keer (outbox-retry na een netwerkfout) -> de bestaande teruggeven
    if body.client_id:
        existing = session.exec(select(VbtRide).where(VbtRide.client_id == body.client_id)).first()
        if existing:
            if existing.user_id != current_user.id:
                raise HTTPException(status_code=409, detail="client_id is al in gebruik")
            return _ride_out(existing)
    data = body.model_dump()
    if data["started_at"].tzinfo:   # opslaan als naïeve UTC, net als de rest van de database
        data["started_at"] = data["started_at"].astimezone(timezone.utc).replace(tzinfo=None)
    ride = VbtRide(user_id=current_user.id, **data)
    # PB = snelste volle ronde op dit parcours zonder sprongen
    if ride.lap_time and not ride.jumped:
        best = _best_lap(current_user.id, ride.course_key, session)
        ride.pb = best is None or ride.lap_time < best.lap_time
    session.add(ride)
    session.commit()
    session.refresh(ride)
    try:
        log_site_event("vbt", "api_call", ip_hash=hash_ip(client_ip(request)),
                       user_agent=request.headers.get("User-Agent", ""), endpoint="/api/vbt/rides")
    except Exception:
        pass
    return _ride_out(ride)


def _best_lap(user_id: str, course_key: str, session: Session) -> Optional[VbtRide]:
    return session.exec(
        select(VbtRide).where(VbtRide.user_id == user_id, VbtRide.course_key == course_key,
                              VbtRide.lap_time.is_not(None), VbtRide.jumped.is_(False))
        .order_by(VbtRide.lap_time.asc())
    ).first()


@router.get("/rides/best-lap")
def best_lap(course: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    best = _best_lap(current_user.id, course, session)
    return _ride_out(best, with_samples=True) if best else None


@router.get("/rides/{ride_id}")
def get_ride(ride_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return _ride_out(_own_ride(ride_id, current_user, session), with_samples=True)


@router.delete("/rides/{ride_id}")
def delete_ride(ride_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    session.delete(_own_ride(ride_id, current_user, session))
    session.commit()
    return {"ok": True}


# ── Strava ───────────────────────────────────────────────────────────────────

@router.get("/strava")
def strava_status(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    link = session.get(VbtStravaLink, current_user.id)
    return {"configured": strava.configured(), "connected": bool(link),
            "athleteName": link.athlete_name if link else None}


@router.get("/strava/connect")
def strava_connect(current_user: User = Depends(get_current_user)):
    if not strava.configured():
        raise HTTPException(status_code=503, detail="Strava is nog niet geconfigureerd (STRAVA_CLIENT_ID/SECRET)")
    return {"url": strava.authorize_url(current_user.id)}


@router.get("/strava/callback")
async def strava_callback(state: str, code: Optional[str] = None, scope: Optional[str] = None,
                          error: Optional[str] = None, session: Session = Depends(get_session)):
    # Browser-redirect vanaf Strava: geen JWT-header, de gebruiker zit in de ondertekende state
    user_id = strava.user_from_state(state)
    if error or not code:
        return RedirectResponse("/vbt/?strava=denied")
    if not scope or "activity:write" not in scope:
        return RedirectResponse("/vbt/?strava=scope")
    await strava.exchange_code(code, user_id, scope, session)
    return RedirectResponse("/vbt/?strava=connected")


@router.delete("/strava")
async def strava_disconnect(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    link = session.get(VbtStravaLink, current_user.id)
    if link:
        await strava.deauthorize(link, session)
    return {"connected": False}


@router.post("/rides/{ride_id}/strava")
async def strava_upload(ride_id: str, fit: UploadFile = File(...), description: str = Form(""),
                        current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    ride = _own_ride(ride_id, current_user, session)
    link = session.get(VbtStravaLink, current_user.id)
    if not link:
        raise HTTPException(status_code=409, detail="Nog geen Strava-koppeling")
    if ride.strava_activity_id:
        return _ride_out(ride)
    data = await fit.read()
    res = await strava.upload_fit(link, session, data, fit.filename or "vbt.fit",
                                  f"VBT · {ride.name}", description, f"vbt-{ride.id}")
    ride.strava_upload_id = res.get("id_str") or str(res.get("id"))
    ride.strava_status = "error" if res.get("error") else "uploading"
    ride.strava_error = res.get("error")
    session.add(ride)
    session.commit()
    return _ride_out(ride)


@router.get("/rides/{ride_id}/strava")
async def strava_upload_status(ride_id: str, current_user: User = Depends(get_current_user),
                               session: Session = Depends(get_session)):
    ride = _own_ride(ride_id, current_user, session)
    link = session.get(VbtStravaLink, current_user.id)
    if ride.strava_status == "uploading" and ride.strava_upload_id and link:
        res = await strava.upload_status(link, session, ride.strava_upload_id)
        if res.get("activity_id"):
            ride.strava_activity_id = str(res["activity_id"])
            ride.strava_status = "done"
        elif res.get("error"):
            ride.strava_status = "error"
            ride.strava_error = res["error"]
        session.add(ride)
        session.commit()
    return _ride_out(ride)
