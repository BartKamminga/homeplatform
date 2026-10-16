"""Outbox (item 1355): mail zonder dossier die actie vraagt, met inschatting en conceptantwoord."""
from datetime import datetime

from sqlmodel import Session, col, select

from core.exceptions import AppError
from models.core import User
from models.dossiers import OutboxItem
from services.dossiers import add_entry

VALUES = {"high": 0, "medium": 1, "low": 2}
URGENCIES = {"today": 0, "week": 1, "later": 2, "none": 3}
ACTIONS = {"reply", "read", "forward", "none"}
STATUSES = {"open", "done", "dismissed"}


def _validate(fields: dict) -> None:
    checks = (("value", VALUES), ("urgency", URGENCIES), ("action", ACTIONS), ("status", STATUSES))
    for key, allowed in checks:
        if fields.get(key) is not None and fields[key] not in allowed:
            raise AppError(f"{key} must be one of {sorted(allowed)}")


def list_items(session: Session, user: User, status: str = "open") -> list[OutboxItem]:
    """Open items eerst op urgentie, dan op waarde, dan nieuwste."""
    stmt = select(OutboxItem).where(OutboxItem.user_id == user.id)
    if status != "all":
        stmt = stmt.where(OutboxItem.status == status)
    items = list(session.exec(stmt.order_by(col(OutboxItem.received_at).desc())).all())
    return sorted(items, key=lambda i: (URGENCIES.get(i.urgency, 9), VALUES.get(i.value, 9)))


def get_item(session: Session, user: User, item_id: str) -> OutboxItem:
    item = session.get(OutboxItem, item_id)
    if item is None or item.user_id != user.id:
        raise AppError("Outbox item not found", status_code=404)
    return item


def add_item(session: Session, user: User, **fields) -> tuple[OutboxItem, bool]:
    """Bestaat external_ref al in de outbox, dan niets toevoegen: (bestaand item, False)."""
    if not (fields.get("title") or "").strip():
        raise AppError("Give the item a title")
    _validate(fields)
    ref = fields.get("external_ref")
    if ref:
        existing = session.exec(
            select(OutboxItem).where(OutboxItem.user_id == user.id, OutboxItem.external_ref == ref)
        ).first()
        if existing:
            return existing, False
    item = OutboxItem(user_id=user.id, **{k: v for k, v in fields.items() if v is not None})
    session.add(item)
    session.commit()
    session.refresh(item)
    return item, True


def update_item(session: Session, user: User, item_id: str, **fields) -> OutboxItem:
    item = get_item(session, user, item_id)
    _validate(fields)
    for key in ("title", "summary", "value", "urgency", "action", "draft_reply", "status"):
        if fields.get(key) is not None:
            setattr(item, key, fields[key])
    item.updated_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def move_to_dossier(session: Session, user: User, item_id: str, dossier_id: str) -> OutboxItem:
    """Het item hoort toch bij een dossier: als gewoon (geaccepteerd) mailstuk toevoegen en afhandelen."""
    item = get_item(session, user, item_id)
    body = "\n\n".join(p for p in (item.summary, f"Afzender: {item.sender_role}" if item.sender_role else None) if p)
    add_entry(session, user, dossier_id, kind="mail", title=item.title, body=body or None,
              source_url=item.source_url, occurred_at=item.received_at, external_ref=item.external_ref)
    item.status = "done"
    item.updated_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def refs_in_outbox(session: Session, user: User, refs: list[str]) -> dict[str, str]:
    rows = session.exec(
        select(OutboxItem.external_ref, OutboxItem.status)
        .where(OutboxItem.user_id == user.id, col(OutboxItem.external_ref).in_(refs))
    ).all()
    return {ref: status for ref, status in rows}


def item_to_dict(item: OutboxItem) -> dict:
    return item.model_dump()
