"""Dossiers (item 1355): dossiers, entries, mailvoorstellen en de export voor Claude.
Bestanden uploaden staat in services/dossier_files.py."""
import re
from datetime import datetime

from sqlmodel import Session, col, or_, select

from core.exceptions import AppError
from models.core import User
from models.dossiers import Dossier, DossierEntry

# page = HTML-uitwerking (analyse, tijdlijn, kaart) die op de site als pagina te openen is.
KINDS = {"note", "mail", "document", "link", "session", "page", "idea", "transcript"}
# proposed = door Claude aangemaakt in een mailronde; Bart accepteert (active) of wijst af (archived) in de Inbox.
STATUSES = {"active", "archived", "proposed"}
REVIEW_PROPOSED = "proposed"
REVIEW_REJECTED = "rejected"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "dossier"


# --- Dossiers ---------------------------------------------------------------

def list_dossiers(session: Session, user: User) -> list[Dossier]:
    return list(session.exec(
        select(Dossier).where(Dossier.user_id == user.id).order_by(col(Dossier.updated_at).desc())
    ).all())


def get_dossier(session: Session, user: User, dossier_id: str) -> Dossier:
    """Op id óf slug - Dossier.ps1 en de site gebruiken de slug ("lcms-toekomst")."""
    dossier = session.get(Dossier, dossier_id)
    if dossier is None or dossier.user_id != user.id:
        dossier = session.exec(
            select(Dossier).where(Dossier.user_id == user.id, Dossier.slug == dossier_id)
        ).first()
    if dossier is None:
        raise AppError("Dossier not found", status_code=404)
    return dossier


def create_dossier(
    session: Session, user: User, name: str, summary: str | None = None,
    mail_criteria: str | None = None, status: str = "active",
) -> Dossier:
    name = name.strip()
    if not name:
        raise AppError("Give the dossier a name")
    if status not in ("active", "proposed"):
        raise AppError("A new dossier is active or proposed")
    base = slugify(name)
    slug, n = base, 2
    while session.exec(select(Dossier).where(Dossier.user_id == user.id, Dossier.slug == slug)).first():
        slug, n = f"{base}-{n}", n + 1
    dossier = Dossier(user_id=user.id, name=name, slug=slug, summary=summary, mail_criteria=mail_criteria, status=status)
    session.add(dossier)
    session.commit()
    session.refresh(dossier)
    return dossier


def update_dossier(session: Session, user: User, dossier_id: str, **fields) -> Dossier:
    dossier = get_dossier(session, user, dossier_id)
    if fields.get("status") is not None and fields["status"] not in STATUSES:
        raise AppError(f"Status must be one of {sorted(STATUSES)}")
    for key in ("name", "summary", "mail_criteria", "status"):
        if fields.get(key) is not None:
            setattr(dossier, key, fields[key])
    touch(session, dossier)
    session.refresh(dossier)
    return dossier


def touch(session: Session, dossier: Dossier) -> None:
    dossier.updated_at = datetime.utcnow()
    session.add(dossier)
    session.commit()


def counts(session: Session, dossier: Dossier) -> dict:
    entries = session.exec(select(DossierEntry.review).where(DossierEntry.dossier_id == dossier.id)).all()
    return {
        "entry_count": sum(1 for r in entries if r is None),
        "proposed_count": sum(1 for r in entries if r == REVIEW_PROPOSED),
    }


# --- Entries ----------------------------------------------------------------

def get_entry(session: Session, user: User, entry_id: str) -> DossierEntry:
    entry = session.get(DossierEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise AppError("Entry not found", status_code=404)
    return entry


def list_entries(
    session: Session, user: User, dossier_id: str,
    q: str | None = None, kind: str | None = None, review: str | None = None,
) -> list[DossierEntry]:
    """review: None = gewone stukken, 'proposed' = mailvoorstellen, 'all' = alles."""
    dossier = get_dossier(session, user, dossier_id)
    stmt = select(DossierEntry).where(DossierEntry.dossier_id == dossier.id)
    if review == "all":
        pass
    elif review:
        stmt = stmt.where(DossierEntry.review == review)
    else:
        stmt = stmt.where(col(DossierEntry.review).is_(None))
    if kind:
        stmt = stmt.where(DossierEntry.kind == kind)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(col(DossierEntry.title).ilike(like), col(DossierEntry.body).ilike(like)))
    stmt = stmt.order_by(col(DossierEntry.pinned).desc(), col(DossierEntry.created_at).desc())
    return list(session.exec(stmt).all())


def find_by_ref(session: Session, dossier: Dossier, ref: str) -> DossierEntry | None:
    return session.exec(
        select(DossierEntry).where(DossierEntry.dossier_id == dossier.id, DossierEntry.external_ref == ref)
    ).first()


def add_entry(session: Session, user: User, dossier_id: str, **fields) -> tuple[DossierEntry, bool]:
    """Notitie, link, sessienotitie of mail(voorstel). Bestaat external_ref al in
    dit dossier, dan wordt niets toegevoegd: (bestaande entry, False)."""
    dossier = get_dossier(session, user, dossier_id)
    kind = fields.get("kind") or "note"
    if kind not in KINDS:
        raise AppError(f"Kind must be one of {sorted(KINDS)}")
    title = (fields.get("title") or "").strip()
    if not title:
        raise AppError("Give the entry a title")
    if fields.get("review") not in (None, REVIEW_PROPOSED):
        raise AppError("A new entry can only be added as a proposal or as a regular entry")
    ref = fields.get("external_ref")
    if ref:
        existing = find_by_ref(session, dossier, ref)
        if existing:
            return existing, False
    entry = DossierEntry(
        dossier_id=dossier.id, user_id=user.id, kind=kind, title=title,
        body=fields.get("body"), source_url=fields.get("source_url"), occurred_at=fields.get("occurred_at"),
        external_ref=ref, review=fields.get("review"), reason=fields.get("reason"),
    )
    session.add(entry)
    touch(session, dossier)
    session.refresh(entry)
    return entry, True


def check_refs(session: Session, user: User, dossier_id: str, refs: list[str]) -> dict[str, str | None]:
    """Per sleutel: None (nieuw), 'added', 'proposed' of 'rejected'."""
    dossier = get_dossier(session, user, dossier_id)
    found = session.exec(
        select(DossierEntry.external_ref, DossierEntry.review)
        .where(DossierEntry.dossier_id == dossier.id, col(DossierEntry.external_ref).in_(refs))
    ).all()
    known = {ref: (review or "added") for ref, review in found}
    return {ref: known.get(ref) for ref in refs}


def check_refs_all(session: Session, user: User, refs: list[str]) -> dict[str, dict | None]:
    """Zoals check_refs, maar over alle dossiers: per sleutel None of {dossier, slug, state}."""
    found = session.exec(
        select(DossierEntry.external_ref, DossierEntry.review, Dossier.name, Dossier.slug)
        .join(Dossier, Dossier.id == DossierEntry.dossier_id)
        .where(DossierEntry.user_id == user.id, col(DossierEntry.external_ref).in_(refs))
    ).all()
    known = {ref: {"dossier": name, "slug": slug, "state": review or "added"} for ref, review, name, slug in found}
    return {ref: known.get(ref) for ref in refs}


def inbox(session: Session, user: User) -> dict:
    """Alles wat op Bart wacht: voorgestelde dossiers en mailvoorstellen in alle dossiers."""
    proposed_dossiers = session.exec(
        select(Dossier).where(Dossier.user_id == user.id, Dossier.status == "proposed")
        .order_by(col(Dossier.created_at).desc())
    ).all()
    rows = session.exec(
        select(DossierEntry, Dossier)
        .join(Dossier, Dossier.id == DossierEntry.dossier_id)
        .where(DossierEntry.user_id == user.id, DossierEntry.review == REVIEW_PROPOSED)
        .order_by(col(DossierEntry.occurred_at).desc(), col(DossierEntry.created_at).desc())
    ).all()
    return {
        "dossiers": list(proposed_dossiers),
        "entries": [{**entry_to_dict(e), "dossier_name": d.name, "dossier_slug": d.slug} for e, d in rows],
    }


def move_entry(session: Session, user: User, entry: DossierEntry, target_id: str) -> None:
    """Een stuk (met zijn bijlagen) naar een ander dossier van dezelfde gebruiker verplaatsen."""
    target = get_dossier(session, user, target_id)
    if entry.external_ref and target.id != entry.dossier_id and find_by_ref(session, target, entry.external_ref):
        raise AppError("This mail is already in the target dossier", status_code=409)
    children = session.exec(select(DossierEntry).where(DossierEntry.parent_entry_id == entry.id)).all()
    for item in [entry, *children]:
        item.dossier_id = target.id
        session.add(item)
    touch(session, target)


def update_entry(session: Session, user: User, entry_id: str, **fields) -> DossierEntry:
    entry = get_entry(session, user, entry_id)
    if fields.get("kind") is not None and fields["kind"] not in KINDS:
        raise AppError(f"Kind must be one of {sorted(KINDS)}")
    if fields.get("dossier_id") and fields["dossier_id"] != entry.dossier_id:
        move_entry(session, user, entry, fields["dossier_id"])
    for key in ("title", "body", "kind", "source_url", "occurred_at", "pinned"):
        if fields.get(key) is not None:
            setattr(entry, key, fields[key])
    entry.updated_at = datetime.utcnow()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def review_entry(session: Session, user: User, entry_id: str, decision: str) -> DossierEntry:
    """Bart keurt een mailvoorstel goed (wordt gewoon stuk) of af (blijft bewaard
    met review='rejected', zodat dezelfde mail niet opnieuw voorgesteld wordt)."""
    entry = get_entry(session, user, entry_id)
    if entry.review != REVIEW_PROPOSED:
        raise AppError("This entry is not a pending proposal")
    if decision not in ("accept", "reject"):
        raise AppError("Decision must be accept or reject")
    entry.review = None if decision == "accept" else REVIEW_REJECTED
    entry.updated_at = datetime.utcnow()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def delete_entry(session: Session, user: User, entry_id: str) -> None:
    from services.dossier_files import remove_file  # lokaal: voorkomt kringimport
    entry = get_entry(session, user, entry_id)
    children = session.exec(select(DossierEntry).where(DossierEntry.parent_entry_id == entry.id)).all()
    for item in [*children, entry]:
        remove_file(item)
        session.delete(item)
    session.commit()


def entry_to_dict(entry: DossierEntry) -> dict:
    return {
        "id": entry.id, "dossier_id": entry.dossier_id, "kind": entry.kind, "title": entry.title,
        "body": entry.body, "source_url": entry.source_url, "original_filename": entry.original_filename,
        "content_type": entry.content_type, "size_bytes": entry.size_bytes, "has_file": bool(entry.file_path),
        "parent_entry_id": entry.parent_entry_id, "occurred_at": entry.occurred_at,
        "external_ref": entry.external_ref, "review": entry.review, "reason": entry.reason,
        "pinned": entry.pinned, "processing": entry.processing,
        "created_at": entry.created_at, "updated_at": entry.updated_at,
    }


def search_all(session: Session, user: User, q: str) -> list[tuple[DossierEntry, Dossier]]:
    like = f"%{q.strip()}%"
    return list(session.exec(
        select(DossierEntry, Dossier)
        .join(Dossier, Dossier.id == DossierEntry.dossier_id)
        .where(
            DossierEntry.user_id == user.id, col(DossierEntry.review).is_(None),
            or_(col(DossierEntry.title).ilike(like), col(DossierEntry.body).ilike(like)),
        )
        .order_by(col(DossierEntry.created_at).desc())
        .limit(100)
    ).all())
