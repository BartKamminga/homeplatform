"""Dossiers (item 1355): dossiers, entries, uploads met extractie, mailvoorstellen en export."""
import io
from email.message import EmailMessage

import pymupdf
import pytest

import services.dossier_files as files


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _isolate_upload_root(tmp_path, monkeypatch):
    monkeypatch.setattr(files, "UPLOAD_ROOT", tmp_path)


def _dossier(client, token, name="LCMS toekomst"):
    res = client.post("/api/dossiers", json={"name": name}, headers=_h(token))
    assert res.status_code == 201
    return res.json()


def _upload(client, token, dossier_id, *named_files):
    payload = [("uploads", (name, io.BytesIO(content), ctype)) for name, content, ctype in named_files]
    return client.post(f"/api/dossiers/{dossier_id}/upload", files=payload, headers=_h(token))


def _eml(subject="Overleg LVCb", attachment=b"bijlage-tekst"):
    msg = EmailMessage()
    msg["From"] = "a@example.org"
    msg["To"] = "b@example.org"
    msg["Subject"] = subject
    msg["Date"] = "Thu, 15 Oct 2026 10:00:00 +0200"
    msg.set_content("De hosting gaat in Q1 2027 over.")
    msg.add_attachment(attachment, maintype="text", subtype="plain", filename="notitie.txt")
    return msg.as_bytes()


def _pdf(text="Rapport modulariteit"):
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_create_get_by_slug_and_update(client, user_token):
    dossier = _dossier(client, user_token)
    assert dossier["slug"] == "lcms-toekomst" and dossier["entry_count"] == 0
    assert _dossier(client, user_token)["slug"] == "lcms-toekomst-2"

    res = client.patch(f"/api/dossiers/{dossier['slug']}",
                       json={"summary": "Keuzevrij in 18 maanden", "mail_criteria": "LCMS, hosting"},
                       headers=_h(user_token))
    assert res.status_code == 200
    got = client.get(f"/api/dossiers/{dossier['id']}", headers=_h(user_token)).json()
    assert got["summary"] == "Keuzevrij in 18 maanden" and got["mail_criteria"] == "LCMS, hosting"
    assert client.patch(f"/api/dossiers/{dossier['id']}", json={"status": "weg"}, headers=_h(user_token)).status_code == 400


def test_other_user_cannot_see_a_dossier(client, user_token, admin_token):
    dossier = _dossier(client, user_token)
    assert client.get(f"/api/dossiers/{dossier['id']}", headers=_h(admin_token)).status_code == 404
    assert client.get("/api/dossiers", headers=_h(admin_token)).json() == []


def test_notes_links_search_and_pin(client, user_token):
    dossier = _dossier(client, user_token)
    base = f"/api/dossiers/{dossier['id']}/entries"
    client.post(base, json={"title": "Gesprek manager", "body": "TDD voelt als verdediging"}, headers=_h(user_token))
    link = client.post(base, json={"kind": "link", "title": "NIPV LVCb", "source_url": "https://nipv.nl"},
                       headers=_h(user_token)).json()
    assert client.post(base, json={"kind": "foo", "title": "x"}, headers=_h(user_token)).status_code == 400

    found = client.get(base, params={"q": "verdediging"}, headers=_h(user_token)).json()
    assert [e["title"] for e in found] == ["Gesprek manager"]
    client.patch(f"/api/dossiers/entries/{link['id']}", json={"pinned": True}, headers=_h(user_token))
    assert client.get(base, headers=_h(user_token)).json()[0]["id"] == link["id"]
    hits = client.get("/api/dossiers/search", params={"q": "nipv"}, headers=_h(user_token)).json()
    assert hits[0]["dossier_slug"] == "lcms-toekomst"


def test_upload_eml_pdf_and_text_with_extraction_and_attachments(client, user_token):
    dossier = _dossier(client, user_token)
    res = _upload(client, user_token, dossier["id"],
                  ("mail.eml", _eml(), "message/rfc822"),
                  ("rapport.pdf", _pdf(), "application/pdf"),
                  ("notities.md", b"# Notities\nmodulair", "text/markdown"),
                  ("virus.exe", b"x", "application/octet-stream"))
    assert res.status_code == 201
    results = res.json()
    assert results[0]["kind"] == "mail" and results[0]["title"] == "Overleg LVCb"
    assert "Q1 2027" in results[0]["body"]
    assert results[1]["kind"] == "document" and "Rapport modulariteit" in results[1]["body"]
    assert results[2]["body"].startswith("# Notities")
    assert "not supported" in results[3]["error"]

    entries = client.get(f"/api/dossiers/{dossier['id']}/entries", headers=_h(user_token)).json()
    attachment = next(e for e in entries if e["parent_entry_id"] == results[0]["id"])
    assert attachment["original_filename"] == "notitie.txt" and attachment["body"] == "bijlage-tekst"

    download = client.get(f"/api/dossiers/entries/{results[1]['id']}/download", headers=_h(user_token))
    assert download.status_code == 200 and download.content.startswith(b"%PDF")


def test_same_file_twice_is_not_stored_twice(client, user_token):
    dossier = _dossier(client, user_token)
    first = _upload(client, user_token, dossier["id"], ("a.txt", b"zelfde", "text/plain")).json()[0]
    second = _upload(client, user_token, dossier["id"], ("b.txt", b"zelfde", "text/plain")).json()[0]
    assert first["created"] is True and second["created"] is False and second["id"] == first["id"]


def test_mail_proposals_dedup_review_and_ref_check(client, user_token):
    dossier = _dossier(client, user_token)
    base = f"/api/dossiers/{dossier['id']}"
    proposal = {"kind": "mail", "title": "Planning hostingmigratie", "body": "Samenvatting",
                "external_ref": "ref-1", "review": "proposed", "reason": "Gaat over de migratie Q1 2027"}
    first = client.post(f"{base}/entries", json=proposal, headers=_h(user_token)).json()
    again = client.post(f"{base}/entries", json=proposal, headers=_h(user_token)).json()
    assert first["created"] and not again["created"] and again["id"] == first["id"]

    assert client.get(f"{base}/entries", headers=_h(user_token)).json() == []
    pending = client.get(f"{base}/entries", params={"review": "proposed"}, headers=_h(user_token)).json()
    assert len(pending) == 1 and client.get(base, headers=_h(user_token)).json()["proposed_count"] == 1

    client.post(f"{base}/entries", json={**proposal, "external_ref": "ref-2", "title": "Ruis"}, headers=_h(user_token))
    rejected = client.get(f"{base}/entries", params={"review": "proposed"}, headers=_h(user_token)).json()[0]
    accept = client.post(f"/api/dossiers/entries/{first['id']}/review", json={"decision": "accept"}, headers=_h(user_token))
    assert accept.json()["review"] is None
    target = rejected if rejected["id"] != first["id"] else pending[0]
    client.post(f"/api/dossiers/entries/{target['id']}/review", json={"decision": "reject"}, headers=_h(user_token))

    status = client.post(f"{base}/refs/check", json={"refs": ["ref-1", "ref-2", "ref-3"]}, headers=_h(user_token)).json()
    assert status == {"ref-1": "added", "ref-2": "rejected", "ref-3": None}
    assert client.post(f"/api/dossiers/entries/{first['id']}/review", json={"decision": "accept"},
                       headers=_h(user_token)).status_code == 400


def test_export_contains_summary_criteria_and_entries(client, user_token):
    dossier = _dossier(client, user_token)
    client.patch(f"/api/dossiers/{dossier['id']}", json={"summary": "Stand: keuzevrij", "mail_criteria": "LCMS"},
                 headers=_h(user_token))
    client.post(f"/api/dossiers/{dossier['id']}/entries", json={"title": "Notitie", "body": "Inhoud A"},
                headers=_h(user_token))
    client.post(f"/api/dossiers/{dossier['id']}/entries",
                json={"kind": "mail", "title": "Voorstel", "external_ref": "r", "review": "proposed"}, headers=_h(user_token))
    text = client.get(f"/api/dossiers/{dossier['slug']}/export", headers=_h(user_token)).text
    assert "# Dossier: LCMS toekomst" in text and "Stand: keuzevrij" in text and "LCMS" in text
    assert "### Notitie" in text and "Inhoud A" in text
    assert "## Openstaande mailvoorstellen" in text and "- Voorstel" in text


def test_delete_entry_removes_attachments_and_files(client, user_token, tmp_path):
    dossier = _dossier(client, user_token)
    mail = _upload(client, user_token, dossier["id"], ("mail.eml", _eml(), "message/rfc822")).json()[0]
    assert len(client.get(f"/api/dossiers/{dossier['id']}/entries", headers=_h(user_token)).json()) == 2
    assert client.delete(f"/api/dossiers/entries/{mail['id']}", headers=_h(user_token)).status_code == 204
    assert client.get(f"/api/dossiers/{dossier['id']}/entries", headers=_h(user_token)).json() == []
    assert not any(p.is_file() for p in tmp_path.rglob("*"))


def test_proposed_dossier_inbox_global_refs_and_move(client, user_token):
    lcms = _dossier(client, user_token)
    res = client.post("/api/dossiers", json={"name": "Inhuur hosting", "status": "proposed", "mail_criteria": "inhuur"},
                      headers=_h(user_token))
    assert res.status_code == 201 and res.json()["status"] == "proposed"
    proposed = res.json()
    assert client.post("/api/dossiers", json={"name": "X", "status": "archived"}, headers=_h(user_token)).status_code == 400

    mail = {"kind": "mail", "title": "Offerte inhuur", "body": "Samenvatting", "external_ref": "ref-inhuur",
            "review": "proposed", "reason": "Gaat over inhuur"}
    entry = client.post(f"/api/dossiers/{lcms['id']}/entries", json=mail, headers=_h(user_token)).json()

    inbox = client.get("/api/dossiers/inbox", headers=_h(user_token)).json()
    assert [d["slug"] for d in inbox["dossiers"]] == ["inhuur-hosting"]
    assert inbox["entries"][0]["dossier_slug"] == "lcms-toekomst"

    refs = client.post("/api/dossiers/refs/check", json={"refs": ["ref-inhuur", "ref-nieuw"]}, headers=_h(user_token)).json()
    assert refs == {"ref-inhuur": {"dossier": "LCMS toekomst", "slug": "lcms-toekomst", "state": "proposed"}, "ref-nieuw": None}

    moved = client.patch(f"/api/dossiers/entries/{entry['id']}", json={"dossier_id": proposed["slug"]}, headers=_h(user_token))
    assert moved.status_code == 200 and moved.json()["dossier_id"] == proposed["id"]
    assert client.get("/api/dossiers/inbox", headers=_h(user_token)).json()["entries"][0]["dossier_slug"] == "inhuur-hosting"

    accepted = client.patch(f"/api/dossiers/{proposed['id']}", json={"status": "active"}, headers=_h(user_token)).json()
    assert accepted["status"] == "active" and client.get("/api/dossiers/inbox", headers=_h(user_token)).json()["dossiers"] == []


def test_html_page_upload_title_and_replace(client, user_token):
    dossier = _dossier(client, user_token)
    html = b"<!doctype html><title>LCMS Koers</title><h1>Tijdlijn</h1><p>Hosting Q1 2027</p>"
    res = client.post(f"/api/dossiers/{dossier['id']}/upload?kind=page",
                      files=[("uploads", ("koers.html", io.BytesIO(html), "text/html"))], headers=_h(user_token))
    page = res.json()[0]
    assert page["kind"] == "page" and page["title"] == "LCMS Koers" and "Hosting Q1 2027" in page["body"]
    bad = client.post(f"/api/dossiers/{dossier['id']}/upload?kind=page",
                      files=[("uploads", ("x.md", io.BytesIO(b"x"), "text/markdown"))], headers=_h(user_token)).json()[0]
    assert "error" in bad

    new = b"<!doctype html><title>LCMS Koers</title><p>Versie 2: Plot naar GEO</p>"
    replaced = client.put(f"/api/dossiers/entries/{page['id']}/file",
                          files={"upload": ("koers.html", io.BytesIO(new), "text/html")}, headers=_h(user_token)).json()
    assert replaced["id"] == page["id"] and "Versie 2" in replaced["body"]
    assert client.get(f"/api/dossiers/entries/{page['id']}/download", headers=_h(user_token)).content == new


def test_outbox_sorting_dedup_refs_and_move(client, user_token):
    dossier = _dossier(client, user_token)
    base = "/api/dossier-outbox"
    low = {"title": "Nieuwsbericht", "value": "low", "urgency": "later", "action": "read", "external_ref": "o-1"}
    hot = {"title": "Vraag directie", "value": "high", "urgency": "today", "action": "reply",
           "draft_reply": "Concept: ik kom er vandaag op terug.", "sender_role": "directie", "external_ref": "o-2"}
    client.post(base, json=low, headers=_h(user_token))
    first = client.post(base, json=hot, headers=_h(user_token)).json()
    assert client.post(base, json=hot, headers=_h(user_token)).json()["created"] is False
    assert client.post(base, json={"title": "x", "urgency": "nu"}, headers=_h(user_token)).status_code == 400

    items = client.get(base, headers=_h(user_token)).json()
    assert [i["title"] for i in items] == ["Vraag directie", "Nieuwsbericht"]
    refs = client.post("/api/dossiers/refs/check", json={"refs": ["o-2", "o-9"]}, headers=_h(user_token)).json()
    assert refs == {"o-2": {"dossier": "Outbox", "slug": "outbox", "state": "open"}, "o-9": None}

    moved = client.post(f"{base}/{first['id']}/to-dossier", json={"dossier_id": dossier["slug"]}, headers=_h(user_token)).json()
    assert moved["status"] == "done"
    entries = client.get(f"/api/dossiers/{dossier['id']}/entries", headers=_h(user_token)).json()
    assert entries[0]["title"] == "Vraag directie" and "directie" in entries[0]["body"]
    assert [i["title"] for i in client.get(base, headers=_h(user_token)).json()] == ["Nieuwsbericht"]
    done = client.patch(f"{base}/{items[1]['id']}", json={"status": "dismissed"}, headers=_h(user_token)).json()
    assert done["status"] == "dismissed" and client.get(base, headers=_h(user_token)).json() == []
