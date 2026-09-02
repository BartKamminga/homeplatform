import hashlib
import uuid
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, col, select

from core.exceptions import AppError
from core.settings import settings
from models.core import User
from models.mindbox import MindboxCase, MindboxCaseEvent, MindboxContext, MindboxItem, MindboxResponse, MindboxResponseSource

UPLOAD_ROOT = Path(settings.UPLOAD_ROOT).resolve()
CATEGORY = "mindbox"

ALLOWED_EXTENSIONS = {".msg", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".pdf", ".txt", ".csv"}
MAX_SIZE_MB = 25
VALID_STATUSES = {"new", "in_progress", "done"}


def _safe_path(user_id: str, filename: str) -> Path:
    """Absoluut pad onder UPLOAD_ROOT/mindbox/{user_id}/{filename} - gooit
    400 bij een pathtraversal-poging, zelfde conventie als routers/uploads.py."""
    candidate = (UPLOAD_ROOT / CATEGORY / user_id / filename).resolve()
    if not str(candidate).startswith(str(UPLOAD_ROOT)):
        raise AppError("Ongeldig pad", status_code=400)
    return candidate


def _owns(item: MindboxItem, user: User) -> None:
    if item.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)


def _log_case_event(session: Session, case_id: str | None, user_id: str, event_type: str, description: str) -> None:
    """Best-effort case-tijdlijn-vermelding - alleen als er daadwerkelijk een
    case bij betrokken is (case_id kan None zijn voor case-loze items)."""
    if not case_id:
        return
    session.add(MindboxCaseEvent(case_id=case_id, user_id=user_id, event_type=event_type, description=description))


def save_upload(
    session: Session, user: User, filename: str, content: bytes, content_type: str | None,
    case_id: str | None = None, force: bool = False,
) -> MindboxItem:
    ext = Path(filename or "upload").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise AppError(f"Bestandsextensie niet toegestaan: {ext or '(geen)'}. Toegestaan: {allowed}", status_code=400)
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise AppError(f"Bestand te groot. Maximum is {MAX_SIZE_MB}MB", status_code=400)
    if case_id is not None:
        get_case(session, user, case_id)  # bestaat + eigendom-check

    content_hash = hashlib.sha256(content).hexdigest()
    duplicates = list(session.exec(
        select(MindboxItem).where(MindboxItem.user_id == user.id, MindboxItem.content_hash == content_hash)
    ).all())
    if duplicates and not force:
        # Item 1051 (Bart): "graag een melding geven direct na de upload met
        # de vraag wat te doen" - 409 i.p.v. stil te uploaden, met genoeg info
        # om de bestaande case/bestand op te kunnen zoeken in de frontend.
        existing = duplicates[0]
        raise AppError(
            f"Dit bestand is al eerder geupload als '{existing.original_filename}'",
            status_code=409,
            code="mindbox_duplicate_file",
            extra={"item_id": existing.id, "original_filename": existing.original_filename, "case_id": existing.case_id},
        )

    original_filename = filename
    if duplicates:
        # Bewust toch uploaden ondanks duplicaat - naam ontdubbelen zodat de
        # items in lijsten van elkaar te onderscheiden blijven.
        stem, suffix = Path(filename).stem, Path(filename).suffix
        original_filename = f"{stem} (kopie {len(duplicates) + 1}){suffix}"

    stored_filename = f"{uuid.uuid4()}{ext}"
    abs_path = _safe_path(user.id, stored_filename)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(content)

    rel_path = f"{CATEGORY}/{user.id}/{stored_filename}"
    item = MindboxItem(
        user_id=user.id,
        original_filename=original_filename,
        file_path=rel_path,
        content_type=content_type,
        size_bytes=len(content),
        content_hash=content_hash,
        case_id=case_id,
    )
    session.add(item)
    _log_case_event(session, case_id, user.id, "upload", f"Bestand geüpload: {filename}")
    session.commit()
    session.refresh(item)
    return item


def get_items(session: Session, user: User, case_id: str | None = None) -> list[MindboxItem]:
    query = select(MindboxItem).where(MindboxItem.user_id == user.id)
    if case_id is not None:
        query = query.where(MindboxItem.case_id == case_id)
    return list(session.exec(query.order_by(col(MindboxItem.created_at).desc())).all())


def get_item(session: Session, user: User, item_id: str) -> MindboxItem:
    item = session.get(MindboxItem, item_id)
    if not item:
        raise AppError("Bestand niet gevonden", status_code=404)
    _owns(item, user)
    return item


def update_item(
    session: Session, user: User, item_id: str, status: str | None, notes: str | None,
    case_id: str | None = None, clear_case: bool = False,
) -> MindboxItem:
    item = get_item(session, user, item_id)
    if status is not None:
        if status not in VALID_STATUSES:
            raise AppError(f"Ongeldige status: {status}", status_code=400)
        item.status = status
        _log_case_event(session, item.case_id, user.id, "status_change", f"{item.original_filename}: status -> {status}")
    if notes is not None:
        item.notes = notes
    if clear_case:
        _log_case_event(session, item.case_id, user.id, "item_removed", f"{item.original_filename} losgekoppeld van deze case")
        item.case_id = None
    elif case_id is not None:
        get_case(session, user, case_id)  # bestaat + eigendom-check
        item.case_id = case_id
        _log_case_event(session, case_id, user.id, "item_added", f"{item.original_filename} toegevoegd aan deze case")
    item.updated_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def delete_item(session: Session, user: User, item_id: str) -> None:
    item = get_item(session, user, item_id)
    if item.case_id:
        # Item 1051 (Bart): "verwijderen van bestanden die aan een case zijn
        # gekoppeld is niet mogelijk vanaf de bestand-route" - eerst
        # ontkoppelen (via de case, met de unlink-knop), dan verwijderen.
        raise AppError(
            "Dit bestand is gekoppeld aan een case - ontkoppel het eerst om het te kunnen verwijderen",
            status_code=400,
        )
    abs_path = _safe_path(user.id, Path(item.file_path).name)
    if abs_path.exists():
        abs_path.unlink()
    _log_case_event(session, item.case_id, user.id, "item_removed", f"{item.original_filename} verwijderd")
    session.delete(item)
    session.commit()


def get_item_file_path(session: Session, user: User, item_id: str) -> tuple[Path, MindboxItem]:
    item = get_item(session, user, item_id)
    abs_path = _safe_path(user.id, Path(item.file_path).name)
    if not abs_path.exists():
        raise AppError("Bestand niet gevonden op schijf", status_code=404)
    return abs_path, item


def create_response(
    session: Session, user: User, case_id: str, content: str, source_item_ids: list[str],
    parent_response_id: str | None = None,
) -> MindboxResponse:
    get_case(session, user, case_id)  # bestaat + eigendom-check
    for item_id in source_item_ids:
        get_item(session, user, item_id)  # bestaat + eigendom-check
    if parent_response_id is not None:
        parent = session.get(MindboxResponse, parent_response_id)
        if not parent or parent.user_id != user.id:
            raise AppError("Vervolg-response niet gevonden", status_code=404)

    response = MindboxResponse(
        user_id=user.id, content=content, parent_response_id=parent_response_id, case_id=case_id,
    )
    session.add(response)
    _log_case_event(session, case_id, user.id, "response_created", f"Nieuwe response toegevoegd: {content[:80]}")
    session.commit()
    session.refresh(response)

    for item_id in source_item_ids:
        session.add(MindboxResponseSource(response_id=response.id, item_id=item_id))
    session.commit()
    return response


def get_responses(session: Session, user: User, case_id: str) -> list[dict]:
    get_case(session, user, case_id)  # bestaat + eigendom-check
    query = select(MindboxResponse).where(MindboxResponse.user_id == user.id, MindboxResponse.case_id == case_id)
    responses = session.exec(query.order_by(col(MindboxResponse.created_at).desc())).all()
    out = []
    for r in responses:
        source_ids = session.exec(
            select(MindboxResponseSource.item_id).where(MindboxResponseSource.response_id == r.id)
        ).all()
        out.append({
            "id": r.id,
            "content": r.content,
            "parent_response_id": r.parent_response_id,
            "case_id": r.case_id,
            "source_item_ids": list(source_ids),
            "created_at": r.created_at,
        })
    return out


# ---------------------------------------------------------------------------
# Cases (container die meerdere items/responses aan elkaar koppelt)
# ---------------------------------------------------------------------------

def get_cases(session: Session, user: User) -> list[MindboxCase]:
    query = select(MindboxCase).where(MindboxCase.user_id == user.id).order_by(col(MindboxCase.updated_at).desc())
    return list(session.exec(query).all())


def get_case(session: Session, user: User, case_id: str) -> MindboxCase:
    case = session.get(MindboxCase, case_id)
    if not case:
        raise AppError("Case niet gevonden", status_code=404)
    if case.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)
    return case


def create_case(session: Session, user: User, name: str, context_id: str | None = None) -> MindboxCase:
    if context_id is not None:
        get_context(session, user, context_id)  # bestaat + eigendom-check
    case = MindboxCase(user_id=user.id, name=name, context_id=context_id)
    session.add(case)
    session.commit()
    session.refresh(case)
    _log_case_event(session, case.id, user.id, "case_created", f"Case aangemaakt: {name}")
    session.commit()
    return case


def update_case(
    session: Session, user: User, case_id: str, name: str | None = None,
    context_id: str | None = None, clear_context: bool = False,
) -> MindboxCase:
    case = get_case(session, user, case_id)
    if name is not None and name != case.name:
        old_name = case.name
        case.name = name
        _log_case_event(session, case_id, user.id, "case_renamed", f"Case hernoemd van '{old_name}' naar '{name}'")
    if clear_context:
        case.context_id = None
    elif context_id is not None:
        context = get_context(session, user, context_id)  # bestaat + eigendom-check
        case.context_id = context_id
        _log_case_event(session, case_id, user.id, "context_linked", f"Context '{context.name}' gekoppeld aan deze case")
    case.updated_at = datetime.utcnow()
    session.add(case)
    session.commit()
    session.refresh(case)
    return case


def delete_case(session: Session, user: User, case_id: str) -> None:
    case = get_case(session, user, case_id)
    for item in session.exec(select(MindboxItem).where(MindboxItem.case_id == case_id)).all():
        item.case_id = None
        session.add(item)
    # Responses zijn altijd case-gebonden (item 1051) - kunnen niet losgekoppeld
    # blijven bestaan, dus verdwijnen mee met de case (i.t.t. items, die wel
    # los kunnen bestaan en daarom alleen ontkoppeld worden).
    for response in session.exec(select(MindboxResponse).where(MindboxResponse.case_id == case_id)).all():
        for source in session.exec(select(MindboxResponseSource).where(MindboxResponseSource.response_id == response.id)).all():
            session.delete(source)
        session.delete(response)
    for event in session.exec(select(MindboxCaseEvent).where(MindboxCaseEvent.case_id == case_id)).all():
        session.delete(event)
    session.delete(case)
    session.commit()


# ---------------------------------------------------------------------------
# Contexts (herbruikbare instructie-/persona-tekst, bv. "behandel als manager")
# ---------------------------------------------------------------------------

def get_contexts(session: Session, user: User) -> list[MindboxContext]:
    query = select(MindboxContext).where(MindboxContext.user_id == user.id).order_by(col(MindboxContext.name).asc())
    return list(session.exec(query).all())


def get_context(session: Session, user: User, context_id: str) -> MindboxContext:
    context = session.get(MindboxContext, context_id)
    if not context:
        raise AppError("Context niet gevonden", status_code=404)
    if context.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)
    return context


def create_context(session: Session, user: User, name: str, content: str) -> MindboxContext:
    context = MindboxContext(user_id=user.id, name=name, content=content)
    session.add(context)
    session.commit()
    session.refresh(context)
    return context


def update_context(session: Session, user: User, context_id: str, name: str | None, content: str | None) -> MindboxContext:
    context = get_context(session, user, context_id)
    if name is not None:
        context.name = name
    if content is not None:
        context.content = content
    context.updated_at = datetime.utcnow()
    session.add(context)
    session.commit()
    session.refresh(context)
    return context


def delete_context(session: Session, user: User, context_id: str) -> None:
    context = get_context(session, user, context_id)
    cases_using_it = session.exec(select(MindboxCase).where(MindboxCase.context_id == context_id)).all()
    for case in cases_using_it:
        case.context_id = None
        session.add(case)
    session.delete(context)
    session.commit()


# ---------------------------------------------------------------------------
# Case-events (tijdlijn, ook voor handmatige aantekeningen zoals sessie-notities)
# ---------------------------------------------------------------------------

VALID_EVENT_TYPES = {
    "upload", "status_change", "context_linked", "item_added", "item_removed",
    "response_created", "case_created", "case_renamed", "session_note",
}


def add_case_event(session: Session, user: User, case_id: str, event_type: str, description: str) -> MindboxCaseEvent:
    """Handmatige tijdlijn-vermelding (Bart, 2-09-2026: '...ook binnen de
    sessie hier in de terminal') - bedoeld om bv. na een Claude Code-sessie
    een samenvatting van wat er is gebeurd aan de case toe te voegen."""
    get_case(session, user, case_id)  # bestaat + eigendom-check
    if event_type not in VALID_EVENT_TYPES:
        raise AppError(f"Ongeldig event_type: {event_type}", status_code=400)
    event = MindboxCaseEvent(case_id=case_id, user_id=user.id, event_type=event_type, description=description)
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


def get_case_events(session: Session, user: User, case_id: str) -> list[MindboxCaseEvent]:
    get_case(session, user, case_id)  # bestaat + eigendom-check
    query = (
        select(MindboxCaseEvent)
        .where(MindboxCaseEvent.case_id == case_id)
        .order_by(col(MindboxCaseEvent.created_at).desc())
    )
    return list(session.exec(query).all())
