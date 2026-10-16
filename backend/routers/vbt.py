"""VBT (Virtual Bike Trainer) router — profiel/trainingsplan, ritten (met samples voor ghost en FIT) en Strava.

De API spreekt camelCase, net als de ritobjecten in de game (frontend/sites/vbt).
"""
from datetime import datetime
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
from models.vbt import VbtPlan, VbtProfile, VbtRide, VbtStravaLink
from services import vbt_strava as strava
from services.vbt_hr import VERSION as HR_VERSION, hr_metrics
from services.vbt_rides import naive_utc

router = APIRouter(prefix="/api/vbt", tags=["vbt"])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ProfileIn(CamelModel):
    ftp: Optional[int] = None
    settings: Optional[dict] = None
    plan_slug: Optional[str] = None
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
    elapsed: int = 0
    pauses: list = []
    events: list = []
    samples: list = []


SUMMARY_FIELDS = ["id", "client_id", "started_at", "kind", "course_key", "name", "wo_id", "duration", "distance", "avg_w", "max_w",
                  "avg_cad", "avg_hr", "kj", "elevation", "lap_time", "jumped", "pb", "score", "ftp", "in_progress", "elapsed", "pauses",
                  "strava_activity_id", "strava_status", "strava_error", "rpe", "readiness", "hr_metrics"]


def _ride_out(ride: VbtRide, with_samples: bool = False) -> dict:
    out = {to_camel(f): getattr(ride, f) for f in SUMMARY_FIELDS}
    out["startedAt"] = ride.started_at.isoformat() + ("Z" if ride.started_at.tzinfo is None else "")
    out["syncedAt"] = ride.synced_at.isoformat() + "Z" if ride.synced_at else None
    out["deletedAt"] = ride.deleted_at.isoformat() + "Z" if ride.deleted_at else None
    if with_samples:
        out["samples"] = ride.samples or []
        out["events"] = ride.events or []
    return out


def _own_ride(ride_id: str, user: User, session: Session) -> VbtRide:
    ride = session.get(VbtRide, ride_id)
    if not ride or ride.user_id != user.id:
        raise HTTPException(status_code=404, detail="Rit niet gevonden")
    return ride


# ── Profiel + trainingsplan ──────────────────────────────────────────────────

DEFAULT_PLAN = "ftp-builder"


def _profile_out(p: VbtProfile) -> dict:
    return {"ftp": p.ftp, "planSlug": p.plan_slug or DEFAULT_PLAN, "planStart": p.plan_start, "planDone": p.plan_done or {},
            "settings": p.settings or {}}


@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    p = session.get(VbtProfile, current_user.id) or VbtProfile(user_id=current_user.id)
    return _profile_out(p)


@router.put("/profile")
def put_profile(body: ProfileIn, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    p = session.get(VbtProfile, current_user.id) or VbtProfile(user_id=current_user.id)
    if body.ftp is not None:
        if not 50 <= body.ftp <= 600:
            raise HTTPException(status_code=422, detail="FTP moet tussen 50 en 600 W liggen")
        p.ftp = body.ftp
    if body.plan_slug is not None:
        if not session.exec(select(VbtPlan).where(VbtPlan.slug == body.plan_slug)).first():
            raise HTTPException(status_code=422, detail="Onbekend trainingsplan")
        p.plan_slug = body.plan_slug
    if body.settings is not None:
        if len(str(body.settings)) > 4000:
            raise HTTPException(status_code=422, detail="Instellingen te groot")
        p.settings = {**(p.settings or {}), **body.settings}     # samenvoegen: losse instellingen apart opslaan
    if body.plan_start is not None:
        p.plan_start = body.plan_start
    if body.plan_done is not None:
        p.plan_done = body.plan_done
    p.updated_at = datetime.utcnow()
    session.add(p)
    session.commit()
    return _profile_out(p)


# ── Ritten ───────────────────────────────────────────────────────────────────

@router.get("/rides")
def list_rides(limit: int = 50, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    rides = session.exec(
        select(VbtRide).where(VbtRide.user_id == current_user.id, VbtRide.deleted_at.is_(None))
        .order_by(VbtRide.started_at.desc()).limit(min(limit, 200))
    ).all()
    # oudere ritten (van voor item 1351) eenmalig aanvullen met de hartslag/vermogen-cijfers
    stale = [r for r in rides if not r.in_progress and (r.hr_metrics or {}).get("v") != HR_VERSION]
    for r in stale:
        r.hr_metrics = hr_metrics(r.samples or [])
        session.add(r)
    if stale:
        session.commit()
    return [_ride_out(r) for r in rides]


@router.post("/rides")
def save_ride(body: RideIn, request: Request, current_user: User = Depends(get_current_user),
              session: Session = Depends(get_session)):
    # idempotent: dezelfde rit nog een keer (outbox-retry na een netwerkfout) -> de bestaande teruggeven.
    # Staat hij er als live backup (in_progress), dan wordt die nu afgerond met de volledige rit.
    existing = None
    if body.client_id:
        existing = session.exec(select(VbtRide).where(VbtRide.client_id == body.client_id)).first()
        if existing:
            if existing.user_id != current_user.id:
                raise HTTPException(status_code=409, detail="client_id is al in gebruik")
            # afgeronde rit: alleen bijwerken als dit een voortzetting is (meer samples), anders is het een herhaling
            if not existing.in_progress and len(body.samples) <= len(existing.samples or []):
                return _ride_out(existing)
    data = body.model_dump()
    data["started_at"] = naive_utc(data["started_at"])
    if existing:
        ride = existing
        for k, v in data.items():
            setattr(ride, k, v)
        ride.in_progress = False
    else:
        ride = VbtRide(user_id=current_user.id, **data)
    ride.hr_metrics = hr_metrics(ride.samples or [])
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
        select(VbtRide).where(VbtRide.user_id == user_id, VbtRide.course_key == course_key, VbtRide.deleted_at.is_(None),
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


# Feedback na de rit (item 1304): hoe zwaar (RPE 1-10) en hoe je je voelt; later basis voor het adaptieve plan
READINESS = {"fresh", "ok", "tired", "wrecked"}


class FeedbackIn(CamelModel):
    rpe: Optional[int] = None
    readiness: Optional[str] = None


@router.patch("/rides/{ride_id}/feedback")
def ride_feedback(ride_id: str, body: FeedbackIn, current_user: User = Depends(get_current_user),
                  session: Session = Depends(get_session)):
    ride = _own_ride(ride_id, current_user, session)
    data = body.model_dump(exclude_unset=True)
    if "rpe" in data and data["rpe"] is not None and not 1 <= data["rpe"] <= 10:
        raise HTTPException(status_code=422, detail="RPE moet tussen 1 en 10 liggen")
    if "readiness" in data and data["readiness"] is not None and data["readiness"] not in READINESS:
        raise HTTPException(status_code=422, detail="Onbekende readiness")
    for k, v in data.items():
        setattr(ride, k, v)
    session.add(ride)
    session.commit()
    return _ride_out(ride)


# Verwijderen = naar de prullenbak (terug te zetten); er gaat nooit een rit definitief verloren
@router.delete("/rides/{ride_id}")
def delete_ride(ride_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    ride = _own_ride(ride_id, current_user, session)
    ride.deleted_at = datetime.utcnow()
    session.add(ride)
    session.commit()
    return {"ok": True, "trash": True}


@router.get("/rides-trash")
def list_trash(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    rides = session.exec(select(VbtRide).where(VbtRide.user_id == current_user.id, VbtRide.deleted_at.is_not(None))
                         .order_by(VbtRide.deleted_at.desc())).all()
    return [_ride_out(r) for r in rides]


@router.post("/rides/{ride_id}/restore")
def restore_ride(ride_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    ride = _own_ride(ride_id, current_user, session)
    ride.deleted_at = None
    session.add(ride)
    session.commit()
    return _ride_out(ride)


# ── Strava ───────────────────────────────────────────────────────────────────

@router.get("/strava")
def strava_status(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    link = session.get(VbtStravaLink, current_user.id)
    return {"configured": strava.configured(), "connected": bool(link),
            "athleteName": link.athlete_name if link else None,
            "athleteId": link.athlete_id if link else None,
            "connectedAt": link.created_at.isoformat() + "Z" if link else None,
            "canUpload": bool(link and link.scope and "activity:write" in link.scope)}


@router.get("/strava/connect")
def strava_connect(next: Optional[str] = None, current_user: User = Depends(get_current_user)):
    # next = pagina om na het koppelen naar terug te gaan (VBT of Mijn account)
    if not strava.configured():
        raise HTTPException(status_code=503, detail="Strava is nog niet geconfigureerd (STRAVA_CLIENT_ID/SECRET)")
    return {"url": strava.authorize_url(current_user.id, next)}


@router.get("/strava/callback")
async def strava_callback(state: str, code: Optional[str] = None, scope: Optional[str] = None,
                          error: Optional[str] = None, session: Session = Depends(get_session)):
    # Browser-redirect vanaf Strava: geen JWT-header, de gebruiker zit in de ondertekende state
    user_id, back = strava.user_from_state(state)
    if error or not code:
        return RedirectResponse(strava.with_result(back, "denied"))
    if not scope or "activity:write" not in scope:
        return RedirectResponse(strava.with_result(back, "scope"))
    await strava.exchange_code(code, user_id, scope, session)
    return RedirectResponse(strava.with_result(back, "connected"))


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
