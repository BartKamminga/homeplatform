import difflib
import hashlib
import re
import uuid
from datetime import datetime
from email.message import EmailMessage
from email.utils import formatdate
from pathlib import Path

from sqlmodel import Session, col, select

from core.exceptions import AppError
from core.settings import settings
from models.core import User
from models.mindbox import (
    MindboxCase, MindboxCaseEvent, MindboxContext, MindboxItem, MindboxItemContact, MindboxItemLink,
    MindboxKnowledge,
)

UPLOAD_ROOT = Path(settings.UPLOAD_ROOT).resolve()
CATEGORY = "mindbox"

ALLOWED_EXTENSIONS = {".msg", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".pdf", ".txt", ".csv"}
MAX_SIZE_MB = 25
VALID_STATUSES = {"new", "in_progress", "done"}
# Item 1058: generieke link_types voor MindboxItemLink - vervangen het
# vroegere losse MindboxItem.case_id ("case_member") en, sinds responses zelf
# MindboxItems zijn (kind="response"), MindboxResponseSource ("source_of")
# en MindboxResponse.parent_response_id ("reply_to").
LINK_CASE_MEMBER = "case_member"
LINK_SOURCE_OF = "source_of"
LINK_REPLY_TO = "reply_to"


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


def _write_bytes(user_id: str, ext: str, content: bytes) -> str:
    """Schrijft bytes weg onder UPLOAD_ROOT/mindbox/{user_id}/{uuid}{ext} en
    geeft het RELATIEVE pad terug (conventie: zie MindboxItem.file_path).
    Gedeeld door save_upload (echte uploads) en _materialize_item_bytes
    (item 1058: gegenereerde content, bv. een response, als echt bestand)."""
    stored_filename = f"{uuid.uuid4()}{ext}"
    abs_path = _safe_path(user_id, stored_filename)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(content)
    return f"{CATEGORY}/{user_id}/{stored_filename}"


def _materialize_item_bytes(
    item: MindboxItem, content: bytes, content_type: str, original_filename: str, ext: str,
) -> None:
    """Item 1058: 'alles is een bestand' - gegenereerde content (bv. een
    response) wordt net als een upload een ECHT bestand op schijf, zodat
    download/verwijderen voor elk kind identiek werken (geen kind-branching
    in get_item_file_path/delete_item). Ruimt het vorige fysieke bestand op
    bij een her-materialisatie (bv. na het bewerken van een response)."""
    if item.file_path:
        old_path = _safe_path(item.user_id, Path(item.file_path).name)
        if old_path.exists():
            old_path.unlink()
    item.file_path = _write_bytes(item.user_id, ext, content)
    item.content_type = content_type
    item.original_filename = original_filename
    item.size_bytes = len(content)
    item.content_hash = hashlib.sha256(content).hexdigest()
    item.updated_at = datetime.utcnow()


def render_response_eml(from_email: str, case_name: str, text_content: str) -> bytes:
    """Zelfde .eml-rendering als voorheen build_response_eml deed, nu puur
    (geen DB/eventlogging) zodat 'ie zowel bij create als edit van een
    response-item herbruikt kan worden (services._materialize_item_bytes)."""
    msg = EmailMessage()
    msg["Subject"] = f"Re: {case_name}"
    msg["Date"] = formatdate(localtime=True)
    msg["From"] = from_email
    msg.set_content(text_content)
    return msg.as_bytes()


def _log_case_event(session: Session, case_id: str | None, user_id: str, event_type: str, description: str) -> None:
    """Best-effort case-tijdlijn-vermelding - alleen als er daadwerkelijk een
    case bij betrokken is (case_id kan None zijn voor case-loze items)."""
    if not case_id:
        return
    session.add(MindboxCaseEvent(case_id=case_id, user_id=user_id, event_type=event_type, description=description))


# Outlook/mailexports vervangen ":" vaak door "_" in bestandsnamen (bv. de
# echte upload van vandaag: "RE_ medior_senior SRE engineer.msg") - dus zowel
# ":" als "_" als scheidingsteken na het antwoord/doorstuur-voorvoegsel.
_REPLY_PREFIX_RE = re.compile(r"^(re|fw|fwd|aw|antw)[:_]\s*", re.IGNORECASE)
_SUGGESTION_SIMILARITY_THRESHOLD = 0.82


def _normalize_filename_stem(filename: str) -> str:
    stem = Path(filename).stem.strip()
    while True:
        stripped = _REPLY_PREFIX_RE.sub("", stem).strip()
        if stripped == stem:
            return stem.lower()
        stem = stripped


def _find_suggested_case(session: Session, user: User, item_id: str, filename: str) -> "MindboxCase | None":
    """Bart, item 1051: 'bestanden die mogelijk bij een case horen (RE:
    bestanden uit de mail) of bestanden die erg op elkaar lijken... als
    voorstel meteen koppelen aan een case (wel met extra bevestiging)' -
    puur een SUGGESTIE, nooit automatisch koppelen. Vergelijkt de nieuwe
    bestandsnaam (na strippen van antwoord/doorstuur-voorvoegsels) met
    bestandsnamen van al case-gekoppelde bestanden van dezelfde gebruiker."""
    normalized = _normalize_filename_stem(filename)
    if not normalized:
        return None
    candidates = session.exec(
        select(MindboxItem, MindboxItemLink.target_case_id)
        .join(MindboxItemLink, MindboxItemLink.item_id == MindboxItem.id)
        .where(
            MindboxItem.user_id == user.id,
            MindboxItem.id != item_id,
            MindboxItem.kind == "upload",
            MindboxItemLink.link_type == LINK_CASE_MEMBER,
        )
    ).all()
    best_case_id, best_ratio = None, 0.0
    for candidate, candidate_case_id in candidates:
        ratio = difflib.SequenceMatcher(None, normalized, _normalize_filename_stem(candidate.original_filename)).ratio()
        if ratio > best_ratio:
            best_ratio, best_case_id = ratio, candidate_case_id
    if best_case_id and best_ratio >= _SUGGESTION_SIMILARITY_THRESHOLD:
        return session.get(MindboxCase, best_case_id)
    return None


def save_upload(
    session: Session, user: User, filename: str, content: bytes, content_type: str | None,
    case_id: str | None = None, force: bool = False, parent_item_id: str | None = None,
) -> tuple[MindboxItem, "MindboxCase | None"]:
    ext = Path(filename or "upload").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise AppError(f"Bestandsextensie niet toegestaan: {ext or '(geen)'}. Toegestaan: {allowed}", status_code=400)
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise AppError(f"Bestand te groot. Maximum is {MAX_SIZE_MB}MB", status_code=400)

    inherited_case_ids: list[str] = []
    if parent_item_id is not None:
        # Item 1051 (Bart): "hoe gaan we om met attachments in een mail?" -
        # een bijlage erft ALTIJD de case-koppeling(en) van het ouder-item,
        # ongeacht wat er verder is meegegeven (een bijlage hoort bij hetzelfde
        # dossier als de mail waar 'ie uit komt).
        get_item(session, user, parent_item_id)
        inherited_case_ids = get_item_case_ids(session, parent_item_id)
        case_id = None
    elif case_id is not None:
        get_case(session, user, case_id)  # bestaat + eigendom-check

    content_hash = hashlib.sha256(content).hexdigest()
    # Item 1058: gescoped op kind="upload" - anders zou de hash van een
    # gegenereerd bestand (bv. een response) toevallig een legitieme upload
    # kunnen blokkeren als 409-duplicaat.
    duplicates = list(session.exec(
        select(MindboxItem).where(
            MindboxItem.user_id == user.id, MindboxItem.content_hash == content_hash, MindboxItem.kind == "upload",
        )
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
            extra={
                "item_id": existing.id, "original_filename": existing.original_filename,
                "case_ids": get_item_case_ids(session, existing.id),
            },
        )

    original_filename = filename
    if duplicates:
        # Bewust toch uploaden ondanks duplicaat - naam ontdubbelen zodat de
        # items in lijsten van elkaar te onderscheiden blijven.
        stem, suffix = Path(filename).stem, Path(filename).suffix
        original_filename = f"{stem} (kopie {len(duplicates) + 1}){suffix}"

    rel_path = _write_bytes(user.id, ext, content)
    item = MindboxItem(
        user_id=user.id,
        original_filename=original_filename,
        file_path=rel_path,
        content_type=content_type,
        size_bytes=len(content),
        content_hash=content_hash,
        parent_item_id=parent_item_id,
    )
    session.add(item)
    session.commit()
    session.refresh(item)

    event_desc = f"Bijlage geupload: {filename}" if parent_item_id else f"Bestand geupload: {filename}"
    linked_case_ids = inherited_case_ids if parent_item_id is not None else ([case_id] if case_id is not None else [])
    for cid in linked_case_ids:
        session.add(MindboxItemLink(item_id=item.id, link_type=LINK_CASE_MEMBER, target_case_id=cid))
        _log_case_event(session, cid, user.id, "upload", event_desc)
    if linked_case_ids:
        session.commit()

    # Alleen suggereren als het bestand nog geen case heeft (en geen bijlage
    # is - een bijlage heeft de case(s) van de ouder al) - anders is de vraag
    # al beantwoord door de upload zelf.
    suggested_case = None
    if not linked_case_ids and parent_item_id is None:
        suggested_case = _find_suggested_case(session, user, item.id, filename)
    return item, suggested_case


def get_item_contact_ids(session: Session, item_id: str) -> list[str]:
    return list(session.exec(
        select(MindboxItemContact.contact_id).where(MindboxItemContact.item_id == item_id)
    ).all())


def get_item_case_ids(session: Session, item_id: str) -> list[str]:
    return list(session.exec(
        select(MindboxItemLink.target_case_id).where(
            MindboxItemLink.item_id == item_id, MindboxItemLink.link_type == LINK_CASE_MEMBER,
        )
    ).all())


def item_to_dict(session: Session, item: MindboxItem) -> dict:
    """Item 1052 (Bart): 'kan ik meerdere contacten aan een bestand
    koppelen?' - contact_ids is many-to-many (zie MindboxItemContact),
    dus hier resolven i.p.v. rechtstreeks een attribuut op MindboxItem.
    case_ids is sinds item 1058 op dezelfde manier many-to-many, via
    MindboxItemLink i.p.v. het vroegere losse MindboxItem.case_id."""
    return {
        "id": item.id,
        "original_filename": item.original_filename,
        "content_type": item.content_type,
        "size_bytes": item.size_bytes,
        "status": item.status,
        "notes": item.notes,
        "parsed_text": item.parsed_text,
        "parent_item_id": item.parent_item_id,
        "kind": item.kind,
        "case_ids": get_item_case_ids(session, item.id),
        "contact_ids": get_item_contact_ids(session, item.id),
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def get_attachments(session: Session, user: User, item_id: str) -> list[MindboxItem]:
    get_item(session, user, item_id)  # bestaat + eigendom-check
    query = select(MindboxItem).where(MindboxItem.parent_item_id == item_id).order_by(col(MindboxItem.created_at).asc())
    return list(session.exec(query).all())


def get_items(session: Session, user: User, case_id: str | None = None) -> list[MindboxItem]:
    query = select(MindboxItem).where(MindboxItem.user_id == user.id)
    if case_id is not None:
        query = query.join(MindboxItemLink, MindboxItemLink.item_id == MindboxItem.id).where(
            MindboxItemLink.link_type == LINK_CASE_MEMBER, MindboxItemLink.target_case_id == case_id,
        )
    return list(session.exec(query.order_by(col(MindboxItem.created_at).desc())).all())


def get_item(session: Session, user: User, item_id: str) -> MindboxItem:
    item = session.get(MindboxItem, item_id)
    if not item:
        raise AppError("Bestand niet gevonden", status_code=404)
    _owns(item, user)
    return item


def update_item(
    session: Session, user: User, item_id: str, status: str | None, notes: str | None,
    parsed_text: str | None = None,
) -> MindboxItem:
    """Item 1058: case-koppeling loopt niet meer via dit endpoint (een item
    kan aan 0+ cases hangen) - zie services.mindbox_links.link_item_to_case/
    unlink_item_from_case, zelfde patroon als contact-linking daarvoor al."""
    item = get_item(session, user, item_id)
    if status is not None:
        if status not in VALID_STATUSES:
            raise AppError(f"Ongeldige status: {status}", status_code=400)
        item.status = status
        for cid in get_item_case_ids(session, item.id):
            _log_case_event(session, cid, user.id, "status_change", f"{item.original_filename}: status -> {status}")
    if notes is not None:
        item.notes = notes
    if parsed_text is not None:
        item.parsed_text = parsed_text
        for cid in get_item_case_ids(session, item.id):
            _log_case_event(session, cid, user.id, "item_parsed", f"{item.original_filename}: tekst geextraheerd")
    item.updated_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def delete_item(session: Session, user: User, item_id: str) -> None:
    item = get_item(session, user, item_id)
    if get_item_case_ids(session, item.id):
        # Item 1051 (Bart): "verwijderen van bestanden die aan een case zijn
        # gekoppeld is niet mogelijk vanaf de bestand-route" - eerst
        # ontkoppelen (via de case, met de unlink-knop), dan verwijderen.
        raise AppError(
            "Dit bestand is gekoppeld aan een case - ontkoppel het eerst om het te kunnen verwijderen",
            status_code=400,
        )
    for attachment in session.exec(select(MindboxItem).where(MindboxItem.parent_item_id == item_id)).all():
        attachment.parent_item_id = None
        session.add(attachment)
    for link in session.exec(select(MindboxItemContact).where(MindboxItemContact.item_id == item_id)).all():
        session.delete(link)
    abs_path = _safe_path(user.id, Path(item.file_path).name)
    if abs_path.exists():
        abs_path.unlink()
    session.delete(item)
    session.commit()


def get_item_file_path(session: Session, user: User, item_id: str) -> tuple[Path, MindboxItem]:
    item = get_item(session, user, item_id)
    abs_path = _safe_path(user.id, Path(item.file_path).name)
    if not abs_path.exists():
        raise AppError("Bestand niet gevonden op schijf", status_code=404)
    if item.kind == "response":
        # Item 1058: het downloaden van een response-item IS het moment van
        # intentie-tot-verzenden (zelfde gedrag als het vroegere aparte
        # .eml-endpoint) - nu via de generieke download-route, voor elke
        # case waar deze response bij hoort.
        for cid in get_item_case_ids(session, item.id):
            _log_case_event(session, cid, user.id, "response_sent", "Response gedownload als .eml, klaar voor verzending")
        session.commit()
    return abs_path, item


def _response_item_to_dict(session: Session, item: MindboxItem, case_id: str) -> dict:
    """Facade in exact dezelfde vorm als de vroegere MindboxResponseOut -
    item 1058: een response is nu een MindboxItem (kind="response"), maar de
    /cases/{id}/responses-contracten blijven ongewijzigd voor de aanroepers."""
    source_ids = session.exec(
        select(MindboxItemLink.target_item_id).where(
            MindboxItemLink.item_id == item.id, MindboxItemLink.link_type == LINK_SOURCE_OF,
        )
    ).all()
    reply_to = session.exec(
        select(MindboxItemLink.target_item_id).where(
            MindboxItemLink.item_id == item.id, MindboxItemLink.link_type == LINK_REPLY_TO,
        )
    ).first()
    return {
        "id": item.id,
        "content": item.text_content or "",
        "parent_response_id": reply_to,
        "case_id": case_id,
        "source_item_ids": list(source_ids),
        "original_filename": item.original_filename,
        "created_at": item.created_at,
    }


def get_response_item(session: Session, user: User, response_id: str) -> MindboxItem:
    item = get_item(session, user, response_id)
    if item.kind != "response":
        raise AppError("Response niet gevonden", status_code=404)
    return item


def create_response_item(
    session: Session, user: User, case_id: str, content: str, source_item_ids: list[str],
    parent_response_id: str | None = None,
) -> dict:
    case = get_case(session, user, case_id)  # bestaat + eigendom-check
    for item_id in source_item_ids:
        get_item(session, user, item_id)  # bestaat + eigendom-check
    if parent_response_id is not None:
        get_response_item(session, user, parent_response_id)  # bestaat + eigendom-check + is een response

    item = MindboxItem(
        user_id=user.id, kind="response", text_content=content,
        original_filename="response.eml", file_path="", size_bytes=0,
    )
    session.add(item)
    session.commit()
    session.refresh(item)

    eml_bytes = render_response_eml(user.email, case.name, content)
    _materialize_item_bytes(item, eml_bytes, "message/rfc822", f"response-{item.id}.eml", ".eml")
    session.add(item)

    session.add(MindboxItemLink(item_id=item.id, link_type=LINK_CASE_MEMBER, target_case_id=case_id))
    for source_id in source_item_ids:
        session.add(MindboxItemLink(item_id=item.id, link_type=LINK_SOURCE_OF, target_item_id=source_id))
    if parent_response_id is not None:
        session.add(MindboxItemLink(item_id=item.id, link_type=LINK_REPLY_TO, target_item_id=parent_response_id))
    _log_case_event(session, case_id, user.id, "response_created", f"Nieuwe response toegevoegd: {content[:80]}")
    session.commit()
    session.refresh(item)
    return _response_item_to_dict(session, item, case_id)


def get_response_items(session: Session, user: User, case_id: str) -> list[dict]:
    get_case(session, user, case_id)  # bestaat + eigendom-check
    query = (
        select(MindboxItem)
        .join(MindboxItemLink, MindboxItemLink.item_id == MindboxItem.id)
        .where(
            MindboxItem.user_id == user.id, MindboxItem.kind == "response",
            MindboxItemLink.link_type == LINK_CASE_MEMBER, MindboxItemLink.target_case_id == case_id,
        )
        .order_by(col(MindboxItem.created_at).desc())
    )
    items = session.exec(query).all()
    return [_response_item_to_dict(session, item, case_id) for item in items]


def update_response_item(session: Session, user: User, case_id: str, response_id: str, content: str) -> dict:
    """Bart: 'ik kan me voorstellen dat het gepaste emailtje ook gekoppeld
    kan worden aan het bestand... in welk formaat' - de verzonden mail zelf
    kan gewoon als los bestand in de case ge-upload worden (bestaat al); dit
    hier is de andere helft: het concept-antwoord zelf kunnen bijwerken naar
    wat er uiteindelijk daadwerkelijk verstuurd is."""
    item = get_response_item(session, user, response_id)
    if case_id not in get_item_case_ids(session, item.id):
        raise AppError("Response hoort niet bij deze case", status_code=404)
    case = get_case(session, user, case_id)
    item.text_content = content
    eml_bytes = render_response_eml(user.email, case.name, content)
    _materialize_item_bytes(item, eml_bytes, "message/rfc822", item.original_filename, ".eml")
    session.add(item)
    _log_case_event(session, case_id, user.id, "response_edited", "Response bijgewerkt")
    session.commit()
    session.refresh(item)
    return _response_item_to_dict(session, item, case_id)


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
    status: str | None = None, description: str | None = None,
    context_id: str | None = None, clear_context: bool = False,
) -> MindboxCase:
    case = get_case(session, user, case_id)
    if name is not None and name != case.name:
        old_name = case.name
        case.name = name
        _log_case_event(session, case_id, user.id, "case_renamed", f"Case hernoemd van '{old_name}' naar '{name}'")
    if status is not None:
        if status not in VALID_STATUSES:
            raise AppError(f"Ongeldige status: {status}", status_code=400)
        case.status = status
        _log_case_event(session, case_id, user.id, "status_change", f"Case status -> {status}")
    if description is not None:
        case.description = description
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
    # Item 1058: alleen de link naar DEZE case verwijderen - een item dat aan
    # meerdere cases hangt moet die andere koppeling(en) behouden.
    case_member_links = list(session.exec(
        select(MindboxItemLink).where(
            MindboxItemLink.link_type == LINK_CASE_MEMBER, MindboxItemLink.target_case_id == case_id,
        )
    ).all())
    for link in case_member_links:
        item = session.get(MindboxItem, link.item_id)
        session.delete(link)
        # Responses zijn altijd case-gebonden (item 1051) - kunnen niet
        # losgekoppeld blijven bestaan zoals gewone items, dus verdwijnen mee
        # met de case (i.t.t. uploads, die wel los kunnen bestaan).
        if item and item.kind == "response":
            for other in session.exec(select(MindboxItemLink).where(MindboxItemLink.item_id == item.id)).all():
                session.delete(other)
            for other in session.exec(select(MindboxItemLink).where(MindboxItemLink.target_item_id == item.id)).all():
                session.delete(other)
            if item.file_path:
                abs_path = _safe_path(item.user_id, Path(item.file_path).name)
                if abs_path.exists():
                    abs_path.unlink()
            session.delete(item)
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
# Knowledge (generieke, cross-case kennis-/reference-info, bv. "NIPV-Info")
# ---------------------------------------------------------------------------

def get_knowledge_list(session: Session, user: User) -> list[MindboxKnowledge]:
    query = select(MindboxKnowledge).where(MindboxKnowledge.user_id == user.id).order_by(col(MindboxKnowledge.name).asc())
    return list(session.exec(query).all())


def get_knowledge_entry(session: Session, user: User, knowledge_id: str) -> MindboxKnowledge:
    entry = session.get(MindboxKnowledge, knowledge_id)
    if not entry:
        raise AppError("Kennis-item niet gevonden", status_code=404)
    if entry.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)
    return entry


def create_knowledge_entry(session: Session, user: User, name: str, content: str) -> MindboxKnowledge:
    entry = MindboxKnowledge(user_id=user.id, name=name, content=content)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def update_knowledge_entry(session: Session, user: User, knowledge_id: str, name: str | None, content: str | None) -> MindboxKnowledge:
    entry = get_knowledge_entry(session, user, knowledge_id)
    if name is not None:
        entry.name = name
    if content is not None:
        entry.content = content
    entry.updated_at = datetime.utcnow()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def delete_knowledge_entry(session: Session, user: User, knowledge_id: str) -> None:
    entry = get_knowledge_entry(session, user, knowledge_id)
    session.delete(entry)
    session.commit()


# ---------------------------------------------------------------------------
# Case-events (tijdlijn, ook voor handmatige aantekeningen zoals sessie-notities)
# ---------------------------------------------------------------------------

VALID_EVENT_TYPES = {
    "upload", "status_change", "context_linked", "item_added", "item_removed", "item_parsed",
    "response_created", "response_edited", "response_sent", "case_created", "case_renamed", "session_note",
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
