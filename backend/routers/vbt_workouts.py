"""VBT — workoutbibliotheek, trainingsplannen en climbs (/api/vbt/workouts, /api/vbt/plans, /api/vbt/climbs),
inclusief .zwo-import."""
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, or_, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.vbt import VbtPlan, VbtPlanItem, VbtWorkout
from services import vbt_workouts as svc

router = APIRouter(prefix="/api/vbt", tags=["vbt"])
MAX_FILES = 50


@router.get("/plans")
def list_plans(_: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return [{"slug": p.slug, "name": p.name, "sourceUrl": p.source_url}
            for p in session.exec(select(VbtPlan).order_by(VbtPlan.name)).all()]


@router.get("/plans/{slug}")
def get_plan(slug: str, _: User = Depends(get_current_user), session: Session = Depends(get_session)):
    plan = session.exec(select(VbtPlan).where(VbtPlan.slug == slug)).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan niet gevonden")
    return svc.plan_out(session, plan)


@router.get("/climbs")
def list_climbs(_: User = Depends(get_current_user)):
    return svc.list_climbs()


@router.get("/climbs/{slug}")
def get_climb(slug: str, _: User = Depends(get_current_user)):
    climb = svc.get_climb(slug)
    if not climb:
        raise HTTPException(status_code=404, detail="Climb niet gevonden")
    return climb


def _visible(user: User):
    return or_(VbtWorkout.owner_id.is_(None), VbtWorkout.owner_id == user.id)


@router.get("/workouts")
def list_workouts(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    rows = session.exec(select(VbtWorkout).where(_visible(current_user))
                        .order_by(VbtWorkout.source, VbtWorkout.name)).all()
    return [svc.workout_out(w, current_user.id) for w in rows]


@router.get("/workouts/{workout_id}")
def get_workout(workout_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    wo = session.get(VbtWorkout, workout_id)
    if not wo or (wo.owner_id and wo.owner_id != current_user.id):
        raise HTTPException(status_code=404, detail="Workout niet gevonden")
    return svc.workout_out(wo, current_user.id)


@router.post("/workouts/import")
async def import_zwo(files: List[UploadFile] = File(...), current_user: User = Depends(get_current_user),
                     session: Session = Depends(get_session)):
    """Eén of meer .zwo-bestanden inlezen als eigen workouts (dubbele worden overgeslagen)."""
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=422, detail=f"Maximaal {MAX_FILES} bestanden per keer")
    imported, skipped = [], []
    for f in files:
        raw = await f.read(svc.MAX_ZWO_BYTES + 1)
        try:
            parsed = svc.parse_zwo(raw)
        except svc.ZwoError as exc:
            skipped.append({"file": f.filename, "reason": str(exc)})
            continue
        wo, created = svc.upsert_workout(session, parsed["name"], parsed["steps"], "zwo",
                                         owner_id=current_user.id, description=parsed["description"])
        if created:
            imported.append(svc.workout_out(wo, current_user.id))
        else:
            skipped.append({"file": f.filename, "reason": "staat al in je bibliotheek"})
    session.commit()
    return {"imported": imported, "skipped": skipped}


@router.delete("/workouts/{workout_id}")
def delete_workout(workout_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    wo = session.get(VbtWorkout, workout_id)
    if not wo or wo.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Workout niet gevonden (alleen eigen imports zijn te verwijderen)")
    if session.exec(select(VbtPlanItem).where(VbtPlanItem.workout_id == wo.id)).first():
        raise HTTPException(status_code=409, detail="Workout zit in een plan")
    session.delete(wo)
    session.commit()
    return {"ok": True}
