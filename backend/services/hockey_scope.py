"""Gedeelde helpers voor publicatie/competitie-koppelingen en hun tags (Hockey Inside / Poulebord)."""

from typing import Optional, Sequence

from sqlmodel import Session, select

from models.hockey import HockeyPublicationComp, HockeyPublicationCompTag, HockeyPublicationTag


def get_visible_comp_links(session: Session, publication_id: str):
    """Alle zichtbare competitie-koppelingen van een publicatie, op volgorde."""
    return session.exec(
        select(HockeyPublicationComp)
        .where(HockeyPublicationComp.publication_id == publication_id)
        .where(HockeyPublicationComp.visible == True)  # noqa: E712
        .order_by(HockeyPublicationComp.order)
    ).all()


def get_comp_link_tags(session: Session, comp_link_id: str):
    """Tags van één competitie-koppeling, op volgorde."""
    rows = session.exec(
        select(HockeyPublicationCompTag, HockeyPublicationTag)
        .join(HockeyPublicationTag, HockeyPublicationCompTag.tag_id == HockeyPublicationTag.id)
        .where(HockeyPublicationCompTag.comp_link_id == comp_link_id)
        .order_by(HockeyPublicationTag.order, HockeyPublicationTag.name)
    ).all()
    return [tag for _, tag in rows]


def get_link_ids_for_tags(session: Session, tag_names: Sequence[str]):
    """comp_link_id's die ALLE gegeven tag-namen hebben (AND-logica)."""
    if not tag_names:
        return set()
    sets = []
    for name in tag_names:
        ctags = session.exec(
            select(HockeyPublicationCompTag)
            .join(HockeyPublicationTag, HockeyPublicationCompTag.tag_id == HockeyPublicationTag.id)
            .where(HockeyPublicationTag.name == name)
        ).all()
        sets.append({ct.comp_link_id for ct in ctags})
    return set.intersection(*sets)


def get_publication_links(session: Session, publication_id: str, tags: Optional[Sequence[str]] = None):
    """Zichtbare competitie-koppelingen van een publicatie, evt. gefilterd op 1 of meer tag-namen (AND: moet ze allemaal hebben)."""
    links = get_visible_comp_links(session, publication_id)
    if tags:
        tagged_link_ids = get_link_ids_for_tags(session, tags)
        links = [lnk for lnk in links if lnk.id in tagged_link_ids]
    return links
