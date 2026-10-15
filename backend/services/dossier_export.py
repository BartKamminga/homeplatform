"""Markdown-export van een dossier voor Claude-sessies (item 1355)."""
from datetime import datetime

from sqlmodel import Session

from models.core import User
from services.dossiers import REVIEW_PROPOSED, get_dossier, list_entries


def _fmt_date(value: datetime | None) -> str:
    return value.strftime("%Y-%m-%d") if value else "-"


def export_markdown(session: Session, user: User, dossier_id: str) -> str:
    """Eén markdown-document met alles wat een Claude-sessie nodig heeft."""
    dossier = get_dossier(session, user, dossier_id)
    entries = list_entries(session, user, dossier.id)
    proposed = list_entries(session, user, dossier.id, review=REVIEW_PROPOSED)
    lines = [
        f"# Dossier: {dossier.name}", "",
        f"Slug: `{dossier.slug}` · status: {dossier.status} · {len(entries)} stukken · "
        f"bijgewerkt {_fmt_date(dossier.updated_at)}", "",
        "## Stand van zaken", "", dossier.summary or "_Nog geen samenvatting._", "",
        "## Zoekcriteria voor mail", "", dossier.mail_criteria or "_Nog geen criteria._", "",
    ]
    if proposed:
        lines += ["## Openstaande mailvoorstellen", ""]
        lines += [f"- {e.title} ({_fmt_date(e.occurred_at)})" for e in proposed]
        lines.append("")
    lines += ["## Stukken (vastgepind eerst, daarna nieuwste eerst)", ""]
    for e in entries:
        meta = [e.kind, _fmt_date(e.occurred_at or e.created_at)]
        if e.pinned:
            meta.append("vastgepind")
        if e.original_filename:
            meta.append(e.original_filename)
        if e.parent_entry_id:
            meta.append("bijlage")
        lines += [f"### {e.title}", "", f"_{' · '.join(meta)}_" + (f" · {e.source_url}" if e.source_url else ""), ""]
        lines += [(e.body or "_(geen tekst)_").strip(), ""]
    return "\n".join(lines)
