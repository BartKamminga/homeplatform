"""VBT-workouts en trainingsplannen: .zwo-bestanden inlezen, plannen seeden en uitserveren in het
formaat dat de game verwacht. Stap = {d: seconden, a: %FTP begin, b: %FTP eind, c: cadans?, free?}."""
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional

from sqlmodel import Session, select

from models.vbt import VbtPlan, VbtPlanItem, VbtWorkout

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "vbt"
MAX_ZWO_BYTES = 512 * 1024
MAX_STEPS = 2000
MAX_DURATION = 6 * 3600


class ZwoError(ValueError):
    pass


def duration_of(steps: list) -> int:
    return int(sum(s["d"] for s in steps))


def content_hash(name: str, steps: list) -> str:
    return hashlib.sha256(json.dumps([name, steps], sort_keys=True).encode()).hexdigest()[:32]


# ── .zwo (Zwift-workoutbestand) ──────────────────────────────────────────────

def _pct(el, *names, default=None) -> Optional[float]:
    for n in names:
        v = el.get(n)
        if v is not None:
            f = float(v)
            return round(f * 100 if f <= 5 else f, 1)   # .zwo gebruikt fracties van FTP (0.73)
    return default


def _int(el, name) -> Optional[int]:
    v = el.get(name)
    return int(float(v)) if v not in (None, "") else None


def _step(d, a, b=None, c=None, **extra) -> dict:
    step = {"d": int(d), "a": a, "b": a if b is None else b}
    if c:
        step["c"] = c
    step.update(extra)
    return step


def parse_zwo(raw: bytes) -> dict:
    if len(raw) > MAX_ZWO_BYTES:
        raise ZwoError("bestand is te groot")
    if b"<!DOCTYPE" in raw or b"<!ENTITY" in raw:
        raise ZwoError("DOCTYPE/ENTITY wordt niet ondersteund")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise ZwoError(f"geen geldige XML ({exc})") from exc
    if root.tag != "workout_file":
        raise ZwoError("geen Zwift-workout (workout_file ontbreekt)")
    sport = (root.findtext("sportType") or "bike").strip().lower()
    if sport != "bike":
        raise ZwoError(f"sportType {sport} wordt niet ondersteund")
    body = root.find("workout")
    if body is None:
        raise ZwoError("<workout> ontbreekt")

    steps = []
    for el in body:
        tag, d, cad = el.tag, _int(el, "Duration"), _int(el, "Cadence")
        if tag in ("Warmup", "Cooldown", "Ramp"):
            steps.append(_step(d, _pct(el, "PowerLow", "Power", default=50), _pct(el, "PowerHigh", "Power", default=50), cad))
        elif tag in ("SteadyState", "SolidState"):
            steps.append(_step(d, _pct(el, "Power", "PowerLow", default=60), None, cad))
        elif tag == "IntervalsT":
            on = _step(_int(el, "OnDuration"), _pct(el, "OnPower", "PowerOnHigh", "PowerOnLow", default=100), None, cad)
            off = _step(_int(el, "OffDuration"), _pct(el, "OffPower", "PowerOffLow", "PowerOffHigh", default=50), None,
                        _int(el, "CadenceResting"))
            steps.extend(dict(s) for _ in range(_int(el, "Repeat") or 1) for s in (on, off))
        elif tag == "FreeRide":
            steps.append(_step(d, 60, None, cad, free=True))
        elif tag == "MaxEffort":
            steps.append(_step(d, 150, None, cad))
        else:
            continue   # textevents e.d. negeren
        if len(steps) > MAX_STEPS:
            raise ZwoError("te veel intervallen")

    steps = [s for s in steps if s["d"] and s["d"] > 0]
    if not steps:
        raise ZwoError("geen intervallen gevonden")
    if duration_of(steps) > MAX_DURATION:
        raise ZwoError("workout is langer dan 6 uur")
    name = (root.findtext("name") or "").strip() or "Imported workout"
    return {"name": name[:120], "description": (root.findtext("description") or "").strip()[:2000] or None,
            "steps": steps}


# ── Opslaan (ontdubbeld) ─────────────────────────────────────────────────────

def upsert_workout(session: Session, name: str, steps: list, source: str, owner_id: Optional[str] = None,
                   description: Optional[str] = None, source_url: Optional[str] = None) -> tuple[VbtWorkout, bool]:
    h = content_hash(name, steps)
    existing = session.exec(select(VbtWorkout).where(VbtWorkout.content_hash == h,
                                                     VbtWorkout.owner_id == owner_id)).first()
    if existing:
        return existing, False
    wo = VbtWorkout(name=name, description=description, steps=steps, duration=duration_of(steps),
                    source=source, source_url=source_url, owner_id=owner_id, content_hash=h)
    session.add(wo)
    session.flush()
    return wo, True


# ── Plannen ──────────────────────────────────────────────────────────────────

def seed_plan(session: Session, filename: str) -> VbtPlan:
    """Plan uit data/vbt/<filename> in de database zetten; idempotent (bestaande items worden bijgewerkt)."""
    data = json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))
    plan = session.exec(select(VbtPlan).where(VbtPlan.slug == data["slug"])).first()
    if not plan:
        plan = VbtPlan(slug=data["slug"], name=data["name"])
    plan.name, plan.source_url, plan.day_offsets = data["name"], data.get("sourceUrl"), data["dayOffsets"]
    session.add(plan)
    session.flush()
    for it in data["items"]:
        workout_id = None
        if it["kind"] == "workout":
            wo, _ = upsert_workout(session, it["name"], it["steps"], data["slug"], description=it.get("description"),
                                   source_url=it.get("sourceUrl") or data.get("sourceUrl"))
            workout_id = wo.id
        item = session.get(VbtPlanItem, it["key"]) or VbtPlanItem(key=it["key"], plan_id=plan.id, week=it["week"], day=it["day"])
        item.plan_id, item.week, item.day, item.kind = plan.id, it["week"], it["day"], it["kind"]
        item.workout_id = workout_id
        item.duration = it["duration"] if it["kind"] == "free" else None
        session.add(item)
    session.commit()
    return plan


def workout_out(wo: VbtWorkout, user_id: Optional[str] = None) -> dict:
    return {"id": wo.id, "name": wo.name, "description": wo.description, "duration": wo.duration,
            "source": wo.source, "sourceUrl": wo.source_url, "steps": wo.steps or [],
            "mine": bool(user_id and wo.owner_id == user_id)}


def plan_out(session: Session, plan: VbtPlan) -> dict:
    """Zelfde vorm als het oude ftp-builder.js: weeks = [[dag, ...], ...] met per dag de workout erin."""
    items = session.exec(select(VbtPlanItem).where(VbtPlanItem.plan_id == plan.id)
                         .order_by(VbtPlanItem.week, VbtPlanItem.day)).all()
    weeks: dict[int, list] = {}
    for it in items:
        wo = session.get(VbtWorkout, it.workout_id) if it.workout_id else None
        day = {"id": it.key, "week": it.week, "day": it.day, "workoutId": it.workout_id,
               "rest": it.kind == "rest", "free": it.kind == "free",
               "name": wo.name if wo else ("Rest" if it.kind == "rest" else "Flexible Free Ride"),
               "steps": wo.steps if wo else [], "duration": wo.duration if wo else (it.duration or 0)}
        weeks.setdefault(it.week, []).append(day)
    return {"slug": plan.slug, "name": plan.name, "source": plan.source_url, "dayOffsets": plan.day_offsets,
            "weeks": [weeks[w] for w in sorted(weeks)]}
