from datetime import datetime
from typing import Optional
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from models.core import new_uuid


class PushSubscription(SQLModel, table=True):
    """Web Push-abonnement (item 891) - 1 rij per browser/toestel-installatie
    die notificaties heeft toegestaan. endpoint is uniek per abonnement (de
    push-dienst - Google FCM, Mozilla, etc. - genereert 'm per subscribe-call);
    p256dh/auth zijn de encryptiesleutels die de browser daarbij teruggeeft en
    die send_push() nodig heeft om de payload te versleutelen."""
    __tablename__ = "push_subscriptions"
    __table_args__ = (
        UniqueConstraint("endpoint", name="ux_push_subscriptions_endpoint"),
    )

    id:         str            = Field(default_factory=new_uuid, primary_key=True)
    user_id:    str            = Field(index=True, foreign_key="users.id")
    site:       str            = Field(index=True)  # welke site heeft geabonneerd (hockey-inside, ...)
    endpoint:   str
    p256dh:     str
    auth:       str
    created_at: datetime       = Field(default_factory=datetime.utcnow)
    last_used_at: Optional[datetime] = None
