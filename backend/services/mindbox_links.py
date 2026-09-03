from sqlmodel import Session, select

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
