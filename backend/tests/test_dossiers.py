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
