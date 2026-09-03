from sqlmodel import Session, select

from core.exceptions import AppError
from models.core import User
from models.mindbox import MindboxItemLink
from services.mindbox import LINK_CASE_MEMBER, _log_case_event, get_case, get_item, item_to_dict

# Item 1058 (Bart): "alles is een bestand ... en linken aan de bron met een
# link type" - many-to-many item<->case-koppeling via het generieke
# MindboxItemLink-mechanisme, i.p.v. het vroegere losse MindboxItem.case_id
# (1 case per item). Zelfde patroon als services.mindbox_contacts.


def link_item_to_case(session: Session, user: User, item_id: str, case_id: str) -> dict:
    """Idempotent: opnieuw koppelen van hetzelfde item aan dezelfde case doet
    niets extra's - zelfde gedrag als mindbox_contacts.link_item_contact."""
    item = get_item(session, user, item_id)  # bestaat + eigendom-check
    get_case(session, user, case_id)  # bestaat + eigendom-check
    existing = session.exec(
        select(MindboxItemLink).where(
            MindboxItemLink.item_id == item_id, MindboxItemLink.link_type == LINK_CASE_MEMBER,
            MindboxItemLink.target_case_id == case_id,
        )
    ).first()
    if not existing:
        session.add(MindboxItemLink(item_id=item_id, link_type=LINK_CASE_MEMBER, target_case_id=case_id))
        _log_case_event(session, case_id, user.id, "item_added", f"{item.original_filename} toegevoegd aan deze case")
        session.commit()
    return item_to_dict(session, item)


def unlink_item_from_case(session: Session, user: User, item_id: str, case_id: str) -> dict:
    item = get_item(session, user, item_id)  # bestaat + eigendom-check
    link = session.exec(
        select(MindboxItemLink).where(
            MindboxItemLink.item_id == item_id, MindboxItemLink.link_type == LINK_CASE_MEMBER,
            MindboxItemLink.target_case_id == case_id,
        )
    ).first()
    if link:
        session.delete(link)
        _log_case_event(session, case_id, user.id, "item_removed", f"{item.original_filename} losgekoppeld van deze case")
        session.commit()
    return item_to_dict(session, item)


def link_items(session: Session, user: User, item_id: str, target_item_id: str, link_type: str) -> dict:
    """Bart: 'ik wil ook relaties kunnen leggen tussen bestanden met een
    linktype in de frontend' - generieke item<->item-koppeling met een vrij
    link_type (de website biedt een vaste lijst + 'anders...' aan, maar de
    backend legt zelf geen restrictie op de waarde op - zelfde conventie als
    de rest van deze module). Idempotent op (item_id, target_item_id,
    link_type) - dezelfde relatie 2x leggen doet niets extra's."""
    if not link_type.strip():
        raise AppError("Geef een link-type op", status_code=400)
    if item_id == target_item_id:
        raise AppError("Kan een bestand niet aan zichzelf koppelen", status_code=400)
    item = get_item(session, user, item_id)  # bestaat + eigendom-check
    get_item(session, user, target_item_id)  # bestaat + eigendom-check
    existing = session.exec(
        select(MindboxItemLink).where(
            MindboxItemLink.item_id == item_id, MindboxItemLink.target_item_id == target_item_id,
            MindboxItemLink.link_type == link_type,
        )
    ).first()
    if not existing:
        session.add(MindboxItemLink(item_id=item_id, link_type=link_type, target_item_id=target_item_id))
        session.commit()
    return item_to_dict(session, item)


def unlink_items(session: Session, user: User, link_id: str) -> dict:
    link = session.get(MindboxItemLink, link_id)
    if not link or link.target_item_id is None:
        raise AppError("Link niet gevonden", status_code=404)
    item = get_item(session, user, link.item_id)  # bestaat + eigendom-check (op de FROM-kant)
    session.delete(link)
    session.commit()
    return item_to_dict(session, item)
