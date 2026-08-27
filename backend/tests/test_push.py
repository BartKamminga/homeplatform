"""Tests voor item 891: web push subscribe/unsubscribe + send_push."""

from unittest.mock import patch

from sqlmodel import select

from models.push import PushSubscription
from routers.push import subscribe, unsubscribe, SubscribeIn, SubscribeKeys, UnsubscribeIn
from services.push import send_push


def test_subscribe_creates_a_row(session, admin_user):
    body = SubscribeIn(endpoint="https://push.example/abc", keys=SubscribeKeys(p256dh="pk", auth="ak"), site="hockey-inside")
    result = subscribe(body=body, session=session, user=admin_user)
    assert result["ok"] is True

    sub = session.exec(select(PushSubscription).where(PushSubscription.endpoint == "https://push.example/abc")).first()
    assert sub is not None
    assert sub.user_id == admin_user.id
    assert sub.site == "hockey-inside"


def test_subscribe_is_idempotent_for_same_endpoint(session, admin_user):
    body = SubscribeIn(endpoint="https://push.example/dup", keys=SubscribeKeys(p256dh="pk1", auth="ak1"), site="fiets")
    subscribe(body=body, session=session, user=admin_user)

    body2 = SubscribeIn(endpoint="https://push.example/dup", keys=SubscribeKeys(p256dh="pk2", auth="ak2"), site="poulebord")
    subscribe(body=body2, session=session, user=admin_user)

    rows = session.exec(select(PushSubscription).where(PushSubscription.endpoint == "https://push.example/dup")).all()
    assert len(rows) == 1
    assert rows[0].site == "poulebord"
    assert rows[0].p256dh == "pk2"


def test_unsubscribe_removes_own_subscription(session, admin_user):
    session.add(PushSubscription(user_id=admin_user.id, site="fiets", endpoint="https://push.example/x", p256dh="pk", auth="ak"))
    session.commit()

    unsubscribe(body=UnsubscribeIn(endpoint="https://push.example/x"), session=session, user=admin_user)

    assert session.exec(select(PushSubscription).where(PushSubscription.endpoint == "https://push.example/x")).first() is None


def test_send_push_returns_zero_without_vapid_keys(session, admin_user):
    session.add(PushSubscription(user_id=admin_user.id, site="fiets", endpoint="https://push.example/y", p256dh="pk", auth="ak"))
    session.commit()

    with patch("services.push.settings") as mock_settings:
        mock_settings.VAPID_PUBLIC_KEY = ""
        mock_settings.VAPID_PRIVATE_KEY = ""
        sent = send_push(admin_user.id, "Titel", "Tekst")

    assert sent == 0


def test_send_push_calls_webpush_per_subscription(session, admin_user, engine):
    session.add(PushSubscription(user_id=admin_user.id, site="fiets", endpoint="https://push.example/z", p256dh="pk", auth="ak"))
    session.commit()

    with (
        patch("services.push.settings") as mock_settings,
        patch("services.push.engine", engine),
        patch("services.push.webpush") as mock_webpush,
    ):
        mock_settings.VAPID_PUBLIC_KEY = "pub"
        mock_settings.VAPID_PRIVATE_KEY = "priv"
        mock_settings.VAPID_SUBJECT = "mailto:x@example.com"
        sent = send_push(admin_user.id, "Titel", "Tekst", url="/fiets/")

    assert sent == 1
    mock_webpush.assert_called_once()
    call_kwargs = mock_webpush.call_args.kwargs
    assert call_kwargs["subscription_info"]["endpoint"] == "https://push.example/z"
    assert call_kwargs["vapid_claims"]["sub"] == "mailto:x@example.com"
