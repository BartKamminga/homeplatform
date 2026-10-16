"""Mechanische tekst-extractie uit geuploade bestanden (geen LLM) - gedeeld door
MindBox en Dossiers (item 1355). Oorspronkelijk uit services/mindbox.py
(item 1068); daar blijven dunne aliassen bestaan zodat bestaand gedrag en tests
ongewijzigd blijven."""
import email
import email.policy
import io
import re

import docx
import extract_msg
import pymupdf
import pytesseract
from PIL import Image

# (bestandsnaam, bytes, mimetype) van een bijlage uit een mail
Attachment = tuple[str, bytes, str | None]

OCR_EXTENSIONS = {".png", ".jpg", ".jpeg"}

_HTML_STYLE_SCRIPT_RE = re.compile(r"<(style|script)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def html_to_text(html: str) -> str:
    """Ruwe HTML-body van een mail naar leesbare platte tekst - nooit als HTML
    gerenderd in een UI (trackingpixels/misleidende links, zie item 1068)."""
    text = _HTML_STYLE_SCRIPT_RE.sub("", html)
    text = _HTML_TAG_RE.sub(" ", text)
    text = text.replace("&nbsp;", " ")
    text = re.sub(r"[ \t]+", " ", text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)


def clean_attachment_name(name: str | None) -> str:
    """Outlook-bijlagenamen bevatten soms een trailing NULL-byte ("factuur.pdf\x00")
    - .strip() alleen is niet genoeg, NULL is geen whitespace voor Python."""
    return (name or "").replace("\x00", "").strip()


def extract_pdf(content: bytes) -> tuple[str | None, bytes | None]:
    """Tekst + pagina-1-preview (png) via PyMuPDF. (None, None) bij een corrupt
    bestand; lege tekst bij een gescande PDF zonder tekstlaag."""
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


def extract_msg_file(content: bytes) -> tuple[str | None, list[Attachment], str | None]:
    """Mail-body + bijlagen + onderwerp uit een Outlook .msg via extract-msg."""
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
            body = html_to_text(html)
        header = f"Van: {msg.sender}\nAan: {msg.to}\nOnderwerp: {msg.subject}\nDatum: {msg.date}\n\n"
        text = (header + (body or "")).strip() or None

        attachments: list[Attachment] = []
        for att in msg.attachments:
            try:
                att_name = clean_attachment_name(att.getFilename())
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


def extract_eml(content: bytes) -> tuple[str | None, list[Attachment], str | None]:
    """Zelfde vorm als extract_msg_file, voor een standaard .eml (RFC 822) -
    o.a. wat de mail-vanger-plugin uit Outlook Web exporteert."""
    try:
        msg = email.message_from_bytes(content, policy=email.policy.default)
    except Exception:
        return None, [], None
    try:
        body_part = msg.get_body(preferencelist=("plain", "html"))
        body = ""
        if body_part is not None:
            body = body_part.get_content()
            if body_part.get_content_type() == "text/html":
                body = html_to_text(body)
        subject = msg.get("subject")
        header = f"Van: {msg.get('from')}\nAan: {msg.get('to')}\nOnderwerp: {subject}\nDatum: {msg.get('date')}\n\n"
        text = (header + (body or "")).strip() or None

        attachments: list[Attachment] = []
        for part in msg.iter_attachments():
            name = clean_attachment_name(part.get_filename())
            payload = part.get_payload(decode=True)
            if name and isinstance(payload, (bytes, bytearray)):
                attachments.append((name, bytes(payload), part.get_content_type()))
        return text, attachments, str(subject) if subject else None
    except Exception:
        return None, [], None


def extract_docx(content: bytes) -> str | None:
    try:
        document = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in document.paragraphs if p.text.strip())
        return text or None
    except Exception:
        return None


def extract_image_text(content: bytes) -> str | None:
    """OCR via Tesseract (nld+eng). Vereist de tesseract-binary (zit in de
    Docker-image); lokaal zonder binary faalt dit stil."""
    try:
        image = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(image, lang="nld+eng")
        return text.strip() or None
    except Exception:
        return None


def auto_extract(ext: str, content: bytes) -> tuple[str | None, bytes | None, list[Attachment], str | None]:
    """(tekst, preview_png, bijlagen, mail-onderwerp) - elk optioneel/leeg als
    extractie niets oplevert of het bestandstype niet in aanmerking komt."""
    if ext == ".pdf":
        text, preview = extract_pdf(content)
        return text, preview, [], None
    if ext == ".msg":
        text, attachments, subject = extract_msg_file(content)
        return text, None, attachments, subject
    if ext == ".eml":
        text, attachments, subject = extract_eml(content)
        return text, None, attachments, subject
    if ext == ".docx":
        return extract_docx(content), None, [], None
    if ext in OCR_EXTENSIONS:
        return extract_image_text(content), None, [], None
    return None, None, [], None
