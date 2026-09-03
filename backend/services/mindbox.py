import difflib
import hashlib
import io
import re
import uuid
from datetime import datetime
from email.message import EmailMessage
from email.utils import formatdate
from pathlib import Path

import docx
import extract_msg
import pymupdf
import pytesseract
from PIL import Image
from sqlmodel import Session, col, select

from core.exceptions import AppError
from core.settings import settings
from models.core import User
from models.mindbox import (
    MindboxCase, MindboxCaseEvent, MindboxContact, MindboxContext, MindboxItem, MindboxItemContact,
    MindboxItemLink, MindboxKnowledge,
)

UPLOAD_ROOT = Path(settings.UPLOAD_ROOT).resolve()
CATEGORY = "mindbox"

ALLOWED_EXTENSIONS = {
    ".msg", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".pdf", ".txt", ".csv",
    ".png", ".jpg", ".jpeg", ".json", ".md",
}
# Item 1058 (vervolg, Bart): "als het een tekstbestand is, wordt het type
# .txt ... als het een json-bestand is, wordt het type .json" - elk bestand
# met een van deze extensies krijgt automatisch text_content gevuld (zie
# save_upload), zodat het generiek herbewerkbaar is - geen apart "tekstitem"-
# concept nodig, gewoon een MindboxItem waarvan de bytes toevallig tekst zijn.
TEXT_EXTENSIONS = {".txt", ".json", ".md", ".csv"}
MAX_SIZE_MB = 25
VALID_STATUSES = {"new", "in_progress", "done"}
# Item 1058: generiek link_type voor de item<->case-koppeling via
# MindboxItemLink (vervangt het vroegere losse MindboxItem.case_id). Andere
# link_types (source_of, reply_to, related_to, ...) zijn vrije strings -
# gekozen door de gebruiker bij het aanmaken/uploaden, geen vaste constanten.
LINK_CASE_MEMBER = "case_member"


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


def _assert_link_params(link_target_item_id: str | None, link_type: str | None) -> None:
    """Item 1058 (vervolg, Bart): 'moet die kunnen worden geupload met de
    juiste parameter (link/linkid/linktype)' - een optionele item<->item-link
    bij het aanmaken van ELK gegenereerd/geupload bestand, niet alleen
    responses. Beide of geen van beide - nooit een losse helft."""
    if bool(link_target_item_id) != bool(link_type):
        raise AppError("Geef zowel link_target_item_id als link_type op (of geen van beide)", status_code=400)


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


_HTML_STYLE_SCRIPT_RE = re.compile(r"<(style|script)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _html_to_text(html: str) -> str:
    """Ruwe HTML-body van een .msg naar leesbare platte tekst - puur voor
    parsed_text (nooit als HTML gerenderd in de UI, zie ImageThumbnail/
    item 1068: geen HTML-preview van mail-bodies i.v.m. trackingpixels/
    misleidende links, ook niet gesandboxed)."""
    text = _HTML_STYLE_SCRIPT_RE.sub("", html)
    text = _HTML_TAG_RE.sub(" ", text)
    text = text.replace("&nbsp;", " ")
    text = re.sub(r"[ \t]+", " ", text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)


def _extract_pdf(content: bytes) -> tuple[str | None, bytes | None]:
    """Item 1068: mechanische tekst-extractie + pagina-1-preview via
    PyMuPDF - geen LLM nodig. (None, None) bij een corrupt bestand; lege/
    None tekst bij een gescande PDF zonder tekstlaag (dan blijft de
    handmatige/LLM-stap in File.ParseToTekst nodig)."""
    try:
        doc = pymupdf.open(stream=content, filetype="pdf")
    except Exception:
        return None, None
    try:
        parts = [page.get_text() for page in doc]
        text = "\n\n".join(p.strip() for p in parts if p.strip()) or None
        preview = None
        if len(doc) > 0:
            try:
                preview = doc[0].get_pixmap(dpi=150).tobytes("png")
            except Exception:
                preview = None
        return text, preview
    finally:
        doc.close()


def _extract_msg(content: bytes) -> tuple[str | None, list[tuple[str, bytes, str | None]], str | None]:
    """Item 1068: mechanische extractie van mail-body + bijlagen via
    extract-msg - geen LLM nodig. Bijlagen worden hier alleen VERZAMELD
    (echt aanmaken als child-item gebeurt in save_upload, ná het committen
    van het ouder-item, want daar is item.id voor nodig). Geeft ook het
    ruwe onderwerp terug (item 1069: gebruikt om gerelateerde/eerdere
    mails te detecteren en te linken)."""
    try:
        msg = extract_msg.openMsg(io.BytesIO(content))
    except Exception:
        return None, [], None
    try:
        body = msg.body
        if not body and msg.htmlBody:
            html = msg.htmlBody
            if isinstance(html, bytes):
                html = html.decode("utf-8", errors="replace")
            body = _html_to_text(html)
        header = f"Van: {msg.sender}\nAan: {msg.to}\nOnderwerp: {msg.subject}\nDatum: {msg.date}\n\n"
        text = (header + (body or "")).strip() or None

        attachments: list[tuple[str, bytes, str | None]] = []
        for att in msg.attachments:
            try:
                # Outlook-bijlagenamen bevatten soms een trailing NULL-byte
                # (bv. "factuur.pdf\x00", geen spatie zoals het er in een
                # terminal uitziet) - Path(...).suffix neemt dat mee in de
                # extensie (".pdf\x00"), wat nooit in ALLOWED_EXTENSIONS
                # staat, dus de bijlage-upload faalde stil (opgevangen door
                # de except AppError in save_upload's bijlagen-loop, geen
                # foutmelding zichtbaar - bug gevonden na Bart's melding "zie
                # ik niet"). .strip() alleen is NIET genoeg: NULL is geen
                # whitespace voor Python's str.strip().
                att_name = (att.getFilename() or "").replace("\x00", "").strip()
                att_bytes = att.data
                if att_name and isinstance(att_bytes, (bytes, bytearray)):
                    attachments.append((att_name, bytes(att_bytes), getattr(att, "mimetype", None)))
            except Exception:
                continue
        return text, attachments, msg.subject
    except Exception:
        return None, [], None
    finally:
        msg.close()


def _extract_docx(content: bytes) -> str | None:
    """Item 1068: mechanische tekst-extractie via python-docx - geen LLM nodig."""
    try:
        document = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in document.paragraphs if p.text.strip())
        return text or None
    except Exception:
        return None


_OCR_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def _extract_image_text(content: bytes) -> str | None:
    """Item 1068 (Bart): 'laten we ook kijken naar picture to tekst' - OCR
    via pytesseract (Tesseract-binary, Nederlands + Engels), geen LLM nodig.
    Vereist tesseract-ocr in de Docker-image (zie Dockerfile) - lokaal
    zonder die binary faalt dit stil en blijft het manueel/LLM (bv. het
    model dat de afbeelding zelf leest)."""
    try:
        image = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(image, lang="nld+eng")
        return text.strip() or None
    except Exception:
        return None


def _auto_extract(ext: str, content: bytes) -> tuple[str | None, bytes | None, list[tuple[str, bytes, str | None]]]:
    """Item 1068 (Bart): 'minder tokens verbranden' - mechanische extractie
    (geen LLM) voor bestandstypen waar dat kan, bij upload i.p.v. via een
    losse manual/LLM-stap (File.ParseToTekst). Retourneert
    (parsed_text, preview_png, bijlagen) - elk optioneel/leeg als extractie
    niets oplevert of het bestandstype hier niet voor in aanmerking komt."""
    if ext == ".pdf":
        text, preview = _extract_pdf(content)
        return text, preview, [], None
    if ext == ".msg":
        text, attachments, subject = _extract_msg(content)
        return text, None, attachments, subject
    if ext == ".docx":
        return _extract_docx(content), None, [], None
    if ext in _OCR_EXTENSIONS:
        return _extract_image_text(content), None, [], None
    return None, None, [], None


_ONDERWERP_RE = re.compile(r"^Onderwerp:\s*(.*)$", re.MULTILINE)


def _normalize_subject(subject: str) -> str:
    """Item 1069: onderwerp normaliseren voor thread-matching - zelfde
    Re:/Fwd:-voorvoegsel-strip als _normalize_filename_stem, maar dan
    herhaald (een mail kan "Re: Re: Fwd: ..." worden na een lange thread)."""
    stem = subject.strip()
    while True:
        stripped = _REPLY_PREFIX_RE.sub("", stem).strip()
        if stripped == stem:
            return stem.lower()
        stem = stripped


def _link_related_msg_items(session: Session, user: User, item: MindboxItem, subject: str) -> None:
    """Item 1069 (Bart): 'stel ik upload mijn relevante email van een hele
    dag, dan is de kans aanwezig dat er verschillende mailtjes replies zijn
    op elkaar... we kunnen die dus meteen linken' - onderwerp (na strippen
    van Re:/Fwd:) vergelijken met al geuploade .msg-items van dezelfde
    gebruiker; bij een match de meest recent geuploade kandidaat linken als
    reply_to. Heuristiek (geen echte thread-reconstructie via Message-ID),
    dus bewust een BEST-EFFORT verrijking - nooit de upload zelf laten falen."""
    normalized = _normalize_subject(subject)
    if not normalized:
        return
    candidates = session.exec(
        select(MindboxItem)
        .where(
            MindboxItem.user_id == user.id,
            MindboxItem.id != item.id,
            col(MindboxItem.original_filename).ilike("%.msg"),
            col(MindboxItem.parsed_text).is_not(None),
        )
        .order_by(col(MindboxItem.created_at).desc())
    ).all()
    for candidate in candidates:
        match = _ONDERWERP_RE.search(candidate.parsed_text or "")
        if match and _normalize_subject(match.group(1)) == normalized:
            session.add(MindboxItemLink(item_id=item.id, link_type="reply_to", target_item_id=candidate.id))
            session.commit()
            return


def save_upload(
    session: Session, user: User, filename: str, content: bytes, content_type: str | None,
    case_id: str | None = None, force: bool = False, parent_item_id: str | None = None,
    link_target_item_id: str | None = None, link_type: str | None = None,
) -> tuple[MindboxItem, "MindboxCase | None"]:
    # Outlook-bijlagenamen bevatten soms een trailing NULL-byte of spatie
    # (bv. "factuur.pdf\x00") - Path(...).suffix neemt dat anders mee in de
    # extensie (".pdf\x00"), wat nooit in ALLOWED_EXTENSIONS staat en de
    # upload onterecht laat falen. Eenmalig opschonen, gebruikt door alle
    # andere plekken in deze functie die filename verder gebruiken.
    filename = (filename or "upload").replace("\x00", "").strip()
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise AppError(f"Bestandsextensie niet toegestaan: {ext or '(geen)'}. Toegestaan: {allowed}", status_code=400)
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise AppError(f"Bestand te groot. Maximum is {MAX_SIZE_MB}MB", status_code=400)
    _assert_link_params(link_target_item_id, link_type)
    if link_target_item_id is not None:
        get_item(session, user, link_target_item_id)  # bestaat + eigendom-check

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

    # Item 1058 (vervolg, Bart): "als het een tekstbestand is, wordt het type
    # .txt/.json/..." - text_content automatisch vullen voor tekstachtige
    # extensies, zodat het bestand generiek herbewerkbaar is (zie
    # update_item) zonder een apart "tekstitem"-aanmaakpad nodig te hebben -
    # ook een browser-getypte notitie is gewoon een .txt-upload.
    text_content = None
    if ext in TEXT_EXTENSIONS:
        try:
            text_content = content.decode("utf-8")
        except UnicodeDecodeError:
            text_content = None

    # Item 1068 (Bart): "minder tokens verbranden" - mechanische extractie
    # (PyMuPDF/extract-msg/python-docx, geen LLM) i.p.v. altijd te wachten op
    # de handmatige/LLM-stap in File.ParseToTekst. Bijlagen uit een .msg
    # worden pas ná het committen van dit item aangemaakt (item.id nodig).
    parsed_text, preview_bytes, pending_attachments, msg_subject = _auto_extract(ext, content)

    rel_path = _write_bytes(user.id, ext, content)
    preview_path = _write_bytes(user.id, ".png", preview_bytes) if preview_bytes else None
    item = MindboxItem(
        user_id=user.id,
        original_filename=original_filename,
        file_path=rel_path,
        content_type=content_type,
        size_bytes=len(content),
        content_hash=content_hash,
        parent_item_id=parent_item_id,
        text_content=text_content,
        parsed_text=parsed_text,
        preview_path=preview_path,
    )
    session.add(item)
    session.commit()
    session.refresh(item)

    # Item 1068 (vervolg, Bart): "die zie ik niet terug" - dit item MOET al
    # zijn eigen case-koppeling(en) hebben VOORDAT bijlagen worden verwerkt,
    # want die erven ze via get_item_case_ids(parent_item_id) hieronder. Stond
    # eerst na de bijlagen-loop, waardoor elke automatisch geextraheerde
    # bijlage een lege case-lijst erfde (bestond wel, maar onzichtbaar in elke
    # case-gescoped view).
    event_desc = f"Bijlage geupload: {filename}" if parent_item_id else f"Bestand geupload: {filename}"
    linked_case_ids = inherited_case_ids if parent_item_id is not None else ([case_id] if case_id is not None else [])
    for cid in linked_case_ids:
        session.add(MindboxItemLink(item_id=item.id, link_type=LINK_CASE_MEMBER, target_case_id=cid))
        _log_case_event(session, cid, user.id, "upload", event_desc)
    if link_target_item_id is not None:
        session.add(MindboxItemLink(item_id=item.id, link_type=link_type, target_item_id=link_target_item_id))
    if linked_case_ids or link_target_item_id is not None:
        session.commit()

    for att_name, att_bytes, att_content_type in pending_attachments:
        try:
            save_upload(session, user, att_name, att_bytes, att_content_type, parent_item_id=item.id)
        except AppError as att_error:
            # Item 1068 (vervolg, Bart): "die zie ik niet terug" (2e keer) -
            # dezelfde bijlage (bv. eenzelfde factuur-PDF) komt vaak in
            # meerdere losse mails/cases voor. content_hash-deduplicatie
            # blokkeert dan een nieuwe upload (409), maar het BESTAANDE
            # exemplaar hing alleen aan zijn EERSTE case - hier alsnog aan
            # de huidige case('s) koppelen i.p.v. de bijlage stil te laten
            # verdwijnen. Andere fouten (bv. extensie niet toegestaan)
            # blijven wel gewoon overgeslagen.
            if att_error.code == "mindbox_duplicate_file" and att_error.extra:
                existing_id = att_error.extra.get("item_id")
                existing_case_ids = set(att_error.extra.get("case_ids") or [])
                for cid in linked_case_ids:
                    if cid not in existing_case_ids:
                        session.add(MindboxItemLink(item_id=existing_id, link_type=LINK_CASE_MEMBER, target_case_id=cid))
                if linked_case_ids:
                    session.commit()
            continue

    if msg_subject:
        _link_related_msg_items(session, user, item, msg_subject)

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


def get_item_links(session: Session, item_id: str) -> list[dict]:
    """Item 1058 (vervolg, Bart): 'ik wil ook relaties kunnen leggen tussen
    bestanden met een linktype in de frontend' - ALLE item<->item-links
    tonen (beide richtingen, dus ook 'waar wijs ik zelf naar toe' EN 'wie
    wijst naar mij'), exclusief case_member (dat is de aparte case_ids -
    dit is puur voor item<->item)."""
    outgoing = session.exec(
        select(MindboxItemLink).where(
            MindboxItemLink.item_id == item_id, col(MindboxItemLink.target_item_id).is_not(None),
        )
    ).all()
    incoming = session.exec(
        select(MindboxItemLink).where(MindboxItemLink.target_item_id == item_id)
    ).all()
    return (
        [{"link_id": l.id, "item_id": l.target_item_id, "link_type": l.link_type, "direction": "out"} for l in outgoing]
        + [{"link_id": l.id, "item_id": l.item_id, "link_type": l.link_type, "direction": "in"} for l in incoming]
    )


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
        "text_content": item.text_content,
        "has_preview": item.preview_path is not None,
        "parent_item_id": item.parent_item_id,
        "kind": item.kind,
        "case_ids": get_item_case_ids(session, item.id),
        "contact_ids": get_item_contact_ids(session, item.id),
        "links": get_item_links(session, item.id),
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
    parsed_text: str | None = None, text_content: str | None = None,
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
    if text_content is not None:
        # Item 1058 (vervolg): generiek "bewerk deze tekst opnieuw" - werkt
        # voor ELK item met text_content (elke .txt-upload krijgt dat
        # automatisch, zie save_upload), niet specifiek voor een
        # "response"-concept.
        if item.text_content is None:
            raise AppError("Dit bestand heeft geen bewerkbare tekstinhoud", status_code=400)
        item.text_content = text_content
        ext = Path(item.original_filename).suffix or ".txt"
        _materialize_item_bytes(item, text_content.encode("utf-8"), item.content_type or "text/plain", item.original_filename, ext)
        for cid in get_item_case_ids(session, item.id):
            _log_case_event(session, cid, user.id, "response_edited", f"{item.original_filename} bijgewerkt")
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
    if not abs_path.is_file():
        raise AppError("Bestand niet gevonden op schijf", status_code=404)
    return abs_path, item


def get_item_preview_path(session: Session, user: User, item_id: str) -> Path:
    """Item 1068: losse route voor de automatisch gegenereerde preview-
    afbeelding (bv. pagina 1 van een .pdf) - analoog aan get_item_file_path,
    maar preview_path i.p.v. file_path."""
    item = get_item(session, user, item_id)
    if not item.preview_path:
        raise AppError("Geen preview beschikbaar voor dit bestand", status_code=404)
    abs_path = _safe_path(user.id, Path(item.preview_path).name)
    if not abs_path.is_file():
        raise AppError("Preview niet gevonden op schijf", status_code=404)
    return abs_path


def export_email(session: Session, user: User, item_id: str, case_id: str) -> bytes:
    """Item 1058 (vervolg, Bart): het .eml-ready-voor-verzending-formaat is
    geen standaard meer maar een losse, expliciete exportactie op elk
    tekstitem - rendert on-the-fly (geen persistente materialisatie, zelfde
    stijl als het vroegere build_response_eml van vóór increment 2)."""
    item = get_item(session, user, item_id)
    if item.text_content is None:
        raise AppError("Dit bestand heeft geen tekstinhoud om als e-mail te exporteren", status_code=400)
    case = get_case(session, user, case_id)  # bestaat + eigendom-check
    eml_bytes = render_response_eml(user.email, case.name, item.text_content)
    _log_case_event(session, case_id, user.id, "response_sent", f"{item.original_filename} geexporteerd als .eml, klaar voor verzending")
    session.commit()
    return eml_bytes


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
    # Item 1058 (vervolg): een case heeft alleen LEDEN (via case_member-
    # links) - verwijderen van een case verwijdert nooit bestanden, alleen de
    # koppeling (net als een gewone unlink). Consistent voor elk item, ook
    # gegenereerde tekstitems - er is geen apart "response"-concept meer dat
    # zijn eigen levensduur aan de case bindt.
    for link in session.exec(
        select(MindboxItemLink).where(
            MindboxItemLink.link_type == LINK_CASE_MEMBER, MindboxItemLink.target_case_id == case_id,
        )
    ).all():
        session.delete(link)
    for event in session.exec(select(MindboxCaseEvent).where(MindboxCaseEvent.case_id == case_id)).all():
        session.delete(event)
    session.delete(case)
    session.commit()


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "case"


def _get_case_contacts(session: Session, case_id: str) -> list[MindboxContact]:
    """Item 1058: hergebruikt dezelfde afleiding als CasesPage.jsx's
    `caseContacts` (client-side) - maar hier server-side nodig voor de
    case-export, die geen los frontend-request per contact kan doen."""
    item_ids = session.exec(
        select(MindboxItemLink.item_id).where(
            MindboxItemLink.link_type == LINK_CASE_MEMBER, MindboxItemLink.target_case_id == case_id,
        )
    ).all()
    if not item_ids:
        return []
    contact_ids = list(session.exec(
        select(MindboxItemContact.contact_id).where(col(MindboxItemContact.item_id).in_(item_ids)).distinct()
    ).all())
    if not contact_ids:
        return []
    return list(session.exec(select(MindboxContact).where(col(MindboxContact.id).in_(contact_ids))).all())


def _render_case_items_section(session: Session, items: list[MindboxItem]) -> str:
    """Item 1058 (vervolg, Bart): de case-export miste de bestandenlijst zelf
    en de relaties per bestand - dit levert beide, met dezelfde
    get_item_links() die ook de website gebruikt voor de relaties-badge."""
    lines: list[str] = []
    for item in items:
        if item.kind == "case_export":
            continue  # het export-bestand zichzelf niet in de eigen lijst opnemen
        marker = "📝" if item.text_content else "📄"
        lines.append(f"- {marker} {item.original_filename} ({item.status})")
        for link in get_item_links(session, item.id):
            other = session.get(MindboxItem, link["item_id"])
            other_name = other.original_filename if other else link["item_id"]
            arrow = "->" if link["direction"] == "out" else "<-"
            lines.append(f"    {arrow} {other_name} ({link['link_type']})")
    return "\n".join(lines) or "(geen bestanden gekoppeld)"


def render_case_export_markdown(
    session: Session, case: MindboxCase, context: "MindboxContext | None",
    contacts: list[MindboxContact], events: list[MindboxCaseEvent], items: list[MindboxItem],
    knowledge: list[MindboxKnowledge],
) -> bytes:
    """Item 1058 (Bart): een case moet net als een item als lokaal bestand
    te downloaden zijn voor AI-verwerking - analoog aan de briefing.md die
    MindBox.ps1 -Run al voor een los item genereert (case + context +
    contacten + tijdlijn samengevat), maar dan voor de HELE case.

    Kennis (MindboxKnowledge) is bewust case-onafhankelijk (geen case_id,
    zie models/mindbox.py) - toch hoort de VOLLEDIGE bibliotheek bij elke
    case-export, want het is altijd relevante achtergrondinfo bij het
    werken aan een case (Bart: "hele case downloaden, inclusief context,
    knowledge en contacts")."""
    contacts_md = "\n".join(
        f"- {c.display_name or c.email} ({c.email})" for c in contacts
    ) or "(geen contacten gekoppeld)"
    timeline_md = "\n".join(
        f"- {e.created_at:%Y-%m-%d %H:%M} - {e.event_type}: {e.description}" for e in events
    ) or "(geen activiteit)"
    knowledge_md = "\n\n".join(
        f"### {k.name}\n\n{k.content}" for k in knowledge
    ) or "(geen kennis-items)"
    items_md = _render_case_items_section(session, items)
    text = (
        f"# Case: {case.name}\n\n"
        f"- Status: {case.status}\n"
        f"- Aangemaakt: {case.created_at}\n"
        f"- Context/persona: {context.name if context else '(geen)'}\n\n"
        f"## Omschrijving\n\n{case.description or '(geen omschrijving)'}\n\n"
        f"## Context-instructie\n\n{context.content if context else '(geen context gekoppeld)'}\n\n"
        f"## Contacten\n\n{contacts_md}\n\n"
        f"## Kennisbibliotheek\n\n{knowledge_md}\n\n"
        f"## Bestanden en relaties\n\n{items_md}\n\n"
        f"## Tijdlijn\n\n{timeline_md}\n"
    )
    return text.encode("utf-8")


def export_case(session: Session, user: User, case_id: str) -> MindboxItem:
    """Genereert (of her-genereert, bij een volgende export) een MindboxItem
    met kind="case_export" - hergebruikt dezelfde materialisatie-machinerie
    als een response, dus download/verwijderen werken al generiek."""
    case = get_case(session, user, case_id)
    context = get_context(session, user, case.context_id) if case.context_id else None
    contacts = _get_case_contacts(session, case_id)
    events = get_case_events(session, user, case_id)
    items = get_items(session, user, case_id)
    knowledge = get_knowledge_list(session, user)
    markdown = render_case_export_markdown(session, case, context, contacts, events, items, knowledge)

    item = session.exec(
        select(MindboxItem)
        .join(MindboxItemLink, MindboxItemLink.item_id == MindboxItem.id)
        .where(
            MindboxItem.kind == "case_export", MindboxItemLink.link_type == LINK_CASE_MEMBER,
            MindboxItemLink.target_case_id == case_id,
        )
    ).first()
    if not item:
        item = MindboxItem(user_id=user.id, kind="case_export", original_filename="case-export.md", file_path="", size_bytes=0)
        session.add(item)
        session.commit()
        session.refresh(item)
        session.add(MindboxItemLink(item_id=item.id, link_type=LINK_CASE_MEMBER, target_case_id=case_id))

    _materialize_item_bytes(item, markdown, "text/markdown", f"case-export-{_slugify(case.name)}.md", ".md")
    # Item 1066 (Bart): "md file ook als tekst content laten zien, net als
    # txt files" - _materialize_item_bytes zet nooit text_content (dat doet
    # alleen save_upload's TEXT_EXTENSIONS-pad), dus zonder deze regel bleef
    # een case-export altijd "download only" i.p.v. inline bewerkbaar/
    # zichtbaar zoals elk ander tekstitem.
    item.text_content = markdown.decode("utf-8")
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


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
