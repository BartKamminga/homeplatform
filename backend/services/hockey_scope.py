"""Gedeelde helpers voor publicatie/competitie-koppelingen en hun tags (Hockey Inside / Poulebord)."""

from typing import Optional, Sequence

from sqlmodel import Session, col, select

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


def get_visible_comp_links_bulk(session: Session, publication_ids: Sequence[str]):
    """Zichtbare competitie-koppelingen voor meerdere publicaties in 1 query -
    publication_id -> [link, ...], op volgorde. Batched variant van
    get_visible_comp_links (item 1076)."""
    if not publication_ids:
        return {}
    links = session.exec(
        select(HockeyPublicationComp)
        .where(col(HockeyPublicationComp.publication_id).in_(publication_ids))
        .where(HockeyPublicationComp.visible == True)  # noqa: E712
        .order_by(HockeyPublicationComp.order)
    ).all()
    by_pub: dict = {}
    for lnk in links:
        by_pub.setdefault(lnk.publication_id, []).append(lnk)
    return by_pub


def get_comp_link_tags_bulk(session: Session, comp_link_ids: Sequence[str]):
    """Tags voor meerdere competitie-koppelingen in 1 query - comp_link_id -> [tag, ...],
    op volgorde. Batched variant van get_comp_link_tags voor endpoints die over meerdere
    links heen itereren (bv. de publieke competition-standings-feed, item 1076)."""
    if not comp_link_ids:
        return {}
    rows = session.exec(
        select(HockeyPublicationCompTag, HockeyPublicationTag)
        .join(HockeyPublicationTag, HockeyPublicationCompTag.tag_id == HockeyPublicationTag.id)
        .where(col(HockeyPublicationCompTag.comp_link_id).in_(comp_link_ids))
        .order_by(HockeyPublicationTag.order, HockeyPublicationTag.name)
    ).all()
    by_link: dict = {}
    for link_tag, tag in rows:
        by_link.setdefault(link_tag.comp_link_id, []).append(tag)
    return by_link


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
