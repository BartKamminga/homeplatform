"""Generieke Web Push-verzending (item 891) - losstaand van agent-control,
door elke plek in de backend aan te roepen die iemand wil laten weten dat
er iets is gebeurd, ongeacht of de gebruiker de app op dat moment open
heeft staan."""

import json
import logging
from typing import Optional

from pywebpush import WebPushException, webpush
from sqlmodel import Session, select

from core.database import engine
from core.settings import settings
from models.push import PushSubscription

logger = logging.getLogger("homeplatform.push")


def send_push(
    user_id: Optional[str],
    title: str,
    body: str,
    url: Optional[str] = None,
    site: Optional[str] = None,
) -> int:
    """Stuurt een push-melding naar alle abonnementen van user_id (of van
    iedereen als user_id=None), optioneel beperkt tot 1 site. Geeft het
    aantal daadwerkelijk verzonden meldingen terug. Verwijdert abonnementen
    die de push-dienst als niet-meer-geldig meldt (410/404)."""
    if not (settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY):
        logger.warning("send_push overgeslagen - VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY niet geconfigureerd")
        return 0

    payload = json.dumps({"title": title, "body": body, "url": url or "/"})
    sent = 0

    with Session(engine) as session:
        query = select(PushSubscription)
        if user_id:
            query = query.where(PushSubscription.user_id == user_id)
        if site:
            query = query.where(PushSubscription.site == site)
        subs = session.exec(query).all()

        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_SUBJECT},
                )
                sent += 1
            except WebPushException as exc:
                status = exc.response.status_code if exc.response is not None else None
                if status in (404, 410):
                    session.delete(sub)
                    session.commit()
                else:
                    logger.warning("send_push mislukt voor %s: %s", sub.id, exc)

    return sent
