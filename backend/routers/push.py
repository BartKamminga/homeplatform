"""Web Push - abonneren/opzeggen (item 891). Verzending zelf zit in
services/push.py (send_push), dat losstaat van dit router-bestand zodat elke
plek in de backend het generiek kan aanroepen."""

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.push import PushSubscription
from services.push import send_push

router = APIRouter(prefix="/api/push", tags=["push"])


class SubscribeKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeIn(BaseModel):
    endpoint: str
    keys: SubscribeKeys
    site: str = "platform"


class UnsubscribeIn(BaseModel):
    endpoint: str


@router.post("/subscribe")
def subscribe(
    body: SubscribeIn,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    existing = session.exec(
        select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
    ).first()
    if existing:
        existing.user_id = user.id
        existing.site = body.site
        existing.p256dh = body.keys.p256dh
        existing.auth = body.keys.auth
        session.add(existing)
        session.commit()
        return {"ok": True}

    session.add(PushSubscription(
        user_id=user.id, site=body.site,
        endpoint=body.endpoint, p256dh=body.keys.p256dh, auth=body.keys.auth,
    ))
    session.commit()
    return {"ok": True}


@router.post("/unsubscribe")
def unsubscribe(
    body: UnsubscribeIn,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    sub = session.exec(
        select(PushSubscription)
        .where(PushSubscription.endpoint == body.endpoint)
        .where(PushSubscription.user_id == user.id)
    ).first()
    if sub:
        session.delete(sub)
        session.commit()
    return {"ok": True}


class TestPushIn(BaseModel):
    title: str = "Test-melding"
    body: str = "Als je dit ziet, werkt push!"


@router.post("/test")
def send_test_push(body: TestPushIn, user: User = Depends(get_current_user)):
    """Stuurt een test-push naar de ingelogde gebruiker zelf - handig om de
    subscribe-flow te verifieren zonder op een echte trigger te wachten."""
    sent = send_push(user.id, body.title, body.body)
    return {"sent": sent}
