from datetime import datetime

from sqlmodel import Session, col, select

from core.exceptions import AppError
from models.core import User
from models.mindbox import MindboxContact, MindboxItemContact
from services.mindbox import get_item, item_to_dict

# Item 1052: Contact is los van Context (dat gaat over HOE Bart antwoordt) -
# dit gaat over WIE de andere partij is. v1 matcht bewust alleen op
# e-mailadres (betrouwbaar uit .msg sender/to/cc), niet op vrije-tekst namen.


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def get_contacts(session: Session, user: User, email: str | None = None) -> list[MindboxContact]:
    query = select(MindboxContact).where(MindboxContact.user_id == user.id)
    if email is not None:
        query = query.where(MindboxContact.email == _normalize_email(email))
    return list(session.exec(query.order_by(col(MindboxContact.updated_at).desc())).all())


def get_contact(session: Session, user: User, contact_id: str) -> MindboxContact:
    contact = session.get(MindboxContact, contact_id)
    if not contact:
        raise AppError("Contact niet gevonden", status_code=404)
    if contact.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)
    return contact


def find_or_create_contact(session: Session, user: User, email: str, display_name: str | None = None) -> MindboxContact:
    normalized = _normalize_email(email)
    if not normalized:
        raise AppError("Geef een e-mailadres op", status_code=400)
    existing = session.exec(
        select(MindboxContact).where(MindboxContact.user_id == user.id, MindboxContact.email == normalized)
    ).first()
    if existing:
        if display_name and not existing.display_name:
            existing.display_name = display_name
            existing.updated_at = datetime.utcnow()
            session.add(existing)
            session.commit()
            session.refresh(existing)
        return existing
    contact = MindboxContact(user_id=user.id, email=normalized, display_name=display_name)
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact


def update_contact(
    session: Session, user: User, contact_id: str, display_name: str | None = None, notes: str | None = None,
) -> MindboxContact:
    contact = get_contact(session, user, contact_id)
    if display_name is not None:
        contact.display_name = display_name
    if notes is not None:
        contact.notes = notes
    contact.updated_at = datetime.utcnow()
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact


def delete_contact(session: Session, user: User, contact_id: str) -> None:
    contact = get_contact(session, user, contact_id)
    for link in session.exec(select(MindboxItemContact).where(MindboxItemContact.contact_id == contact_id)).all():
        session.delete(link)
    session.delete(contact)
    session.commit()


def link_item_contact(session: Session, user: User, item_id: str, email: str, display_name: str | None = None) -> dict:
    """Item 1052 (Bart): 'kan ik meerdere contacten aan een bestand
    koppelen?' - een mail heeft vaak meerdere deelnemers (afzender/to/cc),
    dus dit VOEGT TOE (many-to-many) i.p.v. de vorige set-semantiek die het
    vorige contact overschreef. Idempotent: opnieuw koppelen van hetzelfde
    contact aan hetzelfde item doet niets extra's."""
    item = get_item(session, user, item_id)  # bestaat + eigendom-check
    contact = find_or_create_contact(session, user, email, display_name)
    existing = session.exec(
        select(MindboxItemContact).where(
            MindboxItemContact.item_id == item_id, MindboxItemContact.contact_id == contact.id,
        )
    ).first()
    if not existing:
        session.add(MindboxItemContact(item_id=item_id, contact_id=contact.id))
        item.updated_at = datetime.utcnow()
        session.add(item)
        session.commit()
        session.refresh(item)
    return item_to_dict(session, item)


def unlink_item_contact(session: Session, user: User, item_id: str, contact_id: str) -> dict:
    item = get_item(session, user, item_id)  # bestaat + eigendom-check
    link = session.exec(
        select(MindboxItemContact).where(
            MindboxItemContact.item_id == item_id, MindboxItemContact.contact_id == contact_id,
        )
    ).first()
    if link:
        session.delete(link)
        item.updated_at = datetime.utcnow()
        session.add(item)
        session.commit()
        session.refresh(item)
    return item_to_dict(session, item)
