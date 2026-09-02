"""Tests voor Mindbox (item 1050, Fase 1) - upload/lijst/patch/download/
delete van persoonsgebonden bestanden, plus responses met bronvermelding."""
import io

import pytest

import services.mindbox as svc


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _isolate_upload_root(tmp_path, monkeypatch):
    """Voorkomt dat tests echte bestanden in de repo's uploads-map schrijven."""
    monkeypatch.setattr(svc, "UPLOAD_ROOT", tmp_path)


def _upload(client, token, filename="test.msg", content=b"hallo", content_type="application/vnd.ms-outlook"):
    return client.post(
        "/api/mindbox/items",
        files={"file": (filename, io.BytesIO(content), content_type)},
        headers=_auth(token),
    )


def test_upload_and_list_item(client, user_token):
    res = _upload(client, user_token)
    assert res.status_code == 200
    data = res.json()
    assert data["original_filename"] == "test.msg"
    assert data["status"] == "new"
    assert data["notes"] is None

    listed = client.get("/api/mindbox/items", headers=_auth(user_token))
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_upload_rejects_disallowed_extension(client, user_token):
    res = _upload(client, user_token, filename="malware.exe", content_type="application/octet-stream")
    assert res.status_code == 400


def test_upload_rejects_file_too_large(client, user_token):
    big_content = b"x" * (26 * 1024 * 1024)  # boven MAX_SIZE_MB=25
    res = _upload(client, user_token, content=big_content)
    assert res.status_code == 400


def test_update_status_and_notes(client, user_token):
    item_id = _upload(client, user_token).json()["id"]

    res = client.patch(
        f"/api/mindbox/items/{item_id}",
        json={"status": "in_progress", "notes": "Extra context voor Claude"},
        headers=_auth(user_token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "in_progress"
    assert data["notes"] == "Extra context voor Claude"


def test_update_rejects_invalid_status(client, user_token):
    item_id = _upload(client, user_token).json()["id"]

    res = client.patch(f"/api/mindbox/items/{item_id}", json={"status": "geen-geldige-status"}, headers=_auth(user_token))
    assert res.status_code == 400


def test_download_item_returns_original_content(client, user_token):
    item_id = _upload(client, user_token, content=b"originele inhoud").json()["id"]

    res = client.get(f"/api/mindbox/items/{item_id}/download", headers=_auth(user_token))
    assert res.status_code == 200
    assert res.content == b"originele inhoud"


def test_delete_item_removes_it(client, user_token):
    item_id = _upload(client, user_token).json()["id"]

    res = client.delete(f"/api/mindbox/items/{item_id}", headers=_auth(user_token))
    assert res.status_code == 200

    listed = client.get("/api/mindbox/items", headers=_auth(user_token))
    assert listed.json() == []


def test_a_users_items_are_not_visible_to_another_user(client, user_token, admin_token):
    """Bart, 2-09-2026: bestanden zijn persoonsgebonden - nooit gedeeld."""
    item_id = _upload(client, user_token).json()["id"]

    listed_by_admin = client.get("/api/mindbox/items", headers=_auth(admin_token))
    assert listed_by_admin.json() == []

    download_by_admin = client.get(f"/api/mindbox/items/{item_id}/download", headers=_auth(admin_token))
    assert download_by_admin.status_code == 403

    update_by_admin = client.patch(f"/api/mindbox/items/{item_id}", json={"status": "done"}, headers=_auth(admin_token))
    assert update_by_admin.status_code == 403

    delete_by_admin = client.delete(f"/api/mindbox/items/{item_id}", headers=_auth(admin_token))
    assert delete_by_admin.status_code == 403


def _case(client, token, name="Testcase"):
    return client.post("/api/mindbox/cases", json={"name": name}, headers=_auth(token)).json()["id"]


def test_create_response_with_sources_and_list_it(client, user_token):
    item_id = _upload(client, user_token).json()["id"]
    case_id = _case(client, user_token)

    res = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Concept-antwoord op de mail", "source_item_ids": [item_id]},
        headers=_auth(user_token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["content"] == "Concept-antwoord op de mail"
    assert data["case_id"] == case_id
    assert data["source_item_ids"] == [item_id]
    assert data["parent_response_id"] is None

    listed = client.get(f"/api/mindbox/cases/{case_id}/responses", headers=_auth(user_token))
    assert len(listed.json()) == 1
    assert listed.json()[0]["source_item_ids"] == [item_id]


def test_create_response_without_a_case_is_rejected(client, user_token):
    """Item 1051 (Bart): 'los bekijken van responses is niet relevant' -
    responses zijn nu altijd case-gescoped, dus zonder case_id in de URL
    bestaat het endpoint niet meer."""
    item_id = _upload(client, user_token).json()["id"]
    res = client.post(
        "/api/mindbox/responses",
        json={"content": "Concept", "source_item_ids": [item_id]},
        headers=_auth(user_token),
    )
    assert res.status_code == 404


def test_create_followup_response_links_to_parent(client, user_token):
    item_id = _upload(client, user_token).json()["id"]
    case_id = _case(client, user_token)
    first = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Eerste concept", "source_item_ids": [item_id]},
        headers=_auth(user_token),
    ).json()

    followup = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Bijgewerkt na feedback", "source_item_ids": [item_id], "parent_response_id": first["id"]},
        headers=_auth(user_token),
    )
    assert followup.status_code == 200
    assert followup.json()["parent_response_id"] == first["id"]


def test_create_response_rejects_a_source_item_owned_by_another_user(client, user_token, admin_token):
    item_id = _upload(client, admin_token).json()["id"]
    case_id = _case(client, user_token)

    res = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Poging tot misbruik", "source_item_ids": [item_id]},
        headers=_auth(user_token),
    )
    assert res.status_code == 403


def test_create_response_in_another_users_case_is_rejected(client, user_token, admin_token):
    case_id = _case(client, admin_token, "Prive-case van admin")
    res = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Poging tot misbruik", "source_item_ids": []},
        headers=_auth(user_token),
    )
    assert res.status_code == 403


def test_create_context_and_link_it_to_an_item(client, user_token):
    """Bart, 2-09-2026: 'sommige mails wil ik behandelen als een manager...
    = een bepaalde session.md-inhoud' - een context is herbruikbare
    instructietekst die aan een item gekoppeld kan worden."""
    context_res = client.post(
        "/api/mindbox/contexts",
        json={"name": "Manager-response", "content": "Reageer kort, zakelijk, met focus op besluitvorming."},
        headers=_auth(user_token),
    )
    assert context_res.status_code == 200
    context_id = context_res.json()["id"]

    item_id = _upload(client, user_token).json()["id"]
    linked = client.patch(
        f"/api/mindbox/items/{item_id}", json={"context_id": context_id}, headers=_auth(user_token)
    )
    assert linked.status_code == 200
    assert linked.json()["context_id"] == context_id


def test_clear_context_from_an_item(client, user_token):
    context_id = client.post(
        "/api/mindbox/contexts", json={"name": "Tijdelijk", "content": "..."}, headers=_auth(user_token)
    ).json()["id"]
    item_id = _upload(client, user_token).json()["id"]
    client.patch(f"/api/mindbox/items/{item_id}", json={"context_id": context_id}, headers=_auth(user_token))

    cleared = client.patch(f"/api/mindbox/items/{item_id}", json={"clear_context": True}, headers=_auth(user_token))
    assert cleared.json()["context_id"] is None


def test_deleting_a_context_unlinks_it_from_items(client, user_token):
    context_id = client.post(
        "/api/mindbox/contexts", json={"name": "Te verwijderen", "content": "..."}, headers=_auth(user_token)
    ).json()["id"]
    item_id = _upload(client, user_token).json()["id"]
    client.patch(f"/api/mindbox/items/{item_id}", json={"context_id": context_id}, headers=_auth(user_token))

    delete_res = client.delete(f"/api/mindbox/contexts/{context_id}", headers=_auth(user_token))
    assert delete_res.status_code == 200

    item = client.get("/api/mindbox/items", headers=_auth(user_token)).json()[0]
    assert item["context_id"] is None


def test_linking_a_nonexistent_context_fails(client, user_token):
    item_id = _upload(client, user_token).json()["id"]
    res = client.patch(
        f"/api/mindbox/items/{item_id}", json={"context_id": "does-not-exist"}, headers=_auth(user_token)
    )
    assert res.status_code == 404


def test_a_users_context_is_not_usable_by_another_user(client, user_token, admin_token):
    context_id = client.post(
        "/api/mindbox/contexts", json={"name": "Prive", "content": "..."}, headers=_auth(user_token)
    ).json()["id"]
    item_id = _upload(client, admin_token).json()["id"]

    res = client.patch(
        f"/api/mindbox/items/{item_id}", json={"context_id": context_id}, headers=_auth(admin_token)
    )
    assert res.status_code == 403


def test_create_case_and_upload_item_into_it(client, user_token):
    """Bart, 2-09-2026: 'een container aanleggen om meerdere MindboxItems en
    contexten en responses aan elkaar te kunnen koppelen... vaak zal een
    MindboxItem vervolg krijgen' - MindboxCase groepeert items/responses;
    contexts blijven bewust case-onafhankelijk herbruikbaar."""
    case_res = client.post("/api/mindbox/cases", json={"name": "SRE-vacature-kwestie"}, headers=_auth(user_token))
    assert case_res.status_code == 200
    case_id = case_res.json()["id"]

    res = client.post(
        "/api/mindbox/items",
        params={"case_id": case_id},
        files={"file": ("mail1.msg", io.BytesIO(b"eerste mail"), "application/vnd.ms-outlook")},
        headers=_auth(user_token),
    )
    assert res.status_code == 200
    assert res.json()["case_id"] == case_id

    listed = client.get("/api/mindbox/items", params={"case_id": case_id}, headers=_auth(user_token))
    assert len(listed.json()) == 1


def test_add_a_followup_item_to_an_existing_case(client, user_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Vervolgmail-case"}, headers=_auth(user_token)).json()["id"]
    first_id = _upload(client, user_token, filename="mail1.msg").json()["id"]
    client.patch(f"/api/mindbox/items/{first_id}", json={"case_id": case_id}, headers=_auth(user_token))

    second_id = _upload(client, user_token, filename="mail2.msg").json()["id"]
    linked = client.patch(f"/api/mindbox/items/{second_id}", json={"case_id": case_id}, headers=_auth(user_token))
    assert linked.json()["case_id"] == case_id

    listed = client.get("/api/mindbox/items", params={"case_id": case_id}, headers=_auth(user_token))
    assert len(listed.json()) == 2


def test_items_in_a_case_can_each_use_a_different_context(client, user_token):
    """Bart: 'in een case kan ik dan later weer extra documenten toevoegen...
    of andere kennis uit andere MindBox Contexten' - elk item in een case
    houdt zijn EIGEN, onafhankelijke context-koppeling."""
    case_id = client.post("/api/mindbox/cases", json={"name": "Case met 2 contexts"}, headers=_auth(user_token)).json()["id"]
    context_a = client.post("/api/mindbox/contexts", json={"name": "Manager", "content": "..."}, headers=_auth(user_token)).json()["id"]
    context_b = client.post("/api/mindbox/contexts", json={"name": "Techneut", "content": "..."}, headers=_auth(user_token)).json()["id"]

    item1 = _upload(client, user_token, filename="a.msg").json()["id"]
    item2 = _upload(client, user_token, filename="b.msg").json()["id"]
    client.patch(f"/api/mindbox/items/{item1}", json={"case_id": case_id, "context_id": context_a}, headers=_auth(user_token))
    client.patch(f"/api/mindbox/items/{item2}", json={"case_id": case_id, "context_id": context_b}, headers=_auth(user_token))

    items = {i["id"]: i for i in client.get("/api/mindbox/items", params={"case_id": case_id}, headers=_auth(user_token)).json()}
    assert items[item1]["context_id"] == context_a
    assert items[item2]["context_id"] == context_b


def test_clear_case_from_an_item(client, user_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Tijdelijke case"}, headers=_auth(user_token)).json()["id"]
    item_id = _upload(client, user_token).json()["id"]
    client.patch(f"/api/mindbox/items/{item_id}", json={"case_id": case_id}, headers=_auth(user_token))

    cleared = client.patch(f"/api/mindbox/items/{item_id}", json={"clear_case": True}, headers=_auth(user_token))
    assert cleared.json()["case_id"] is None


def test_deleting_a_case_unlinks_items_but_deletes_its_responses(client, user_token):
    """Items kunnen los bestaan (blijven behouden, alleen ontkoppeld) maar
    responses zijn altijd case-gebonden (item 1051) - die verdwijnen mee
    met de case in plaats van los te blijven hangen."""
    case_id = client.post("/api/mindbox/cases", json={"name": "Op te ruimen case"}, headers=_auth(user_token)).json()["id"]
    item_id = _upload(client, user_token).json()["id"]
    client.patch(f"/api/mindbox/items/{item_id}", json={"case_id": case_id}, headers=_auth(user_token))
    client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Concept", "source_item_ids": [item_id]},
        headers=_auth(user_token),
    )

    delete_res = client.delete(f"/api/mindbox/cases/{case_id}", headers=_auth(user_token))
    assert delete_res.status_code == 200

    item = client.get("/api/mindbox/items", headers=_auth(user_token)).json()[0]
    assert item["case_id"] is None
    responses_after = client.get(f"/api/mindbox/cases/{case_id}/responses", headers=_auth(user_token))
    assert responses_after.status_code == 404


def test_a_users_case_is_not_usable_by_another_user(client, user_token, admin_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Prive case"}, headers=_auth(user_token)).json()["id"]
    item_id = _upload(client, admin_token).json()["id"]

    res = client.patch(f"/api/mindbox/items/{item_id}", json={"case_id": case_id}, headers=_auth(admin_token))
    assert res.status_code == 403


def test_upload_into_a_case_logs_a_case_event(client, user_token):
    """Bart, 2-09-2026: 'alles in audit laten landen: uploads, wijzigingen,
    etc... met MindCase in detail bijhouden wat er is gebeurd.'"""
    case_id = client.post("/api/mindbox/cases", json={"name": "Audit case"}, headers=_auth(user_token)).json()["id"]

    _upload(client, user_token, filename="audit.msg")
    item_res = client.post(
        "/api/mindbox/items",
        params={"case_id": case_id},
        files={"file": ("audit.msg", io.BytesIO(b"x"), "application/vnd.ms-outlook")},
        headers=_auth(user_token),
    )
    item_id = item_res.json()["id"]

    events = client.get(f"/api/mindbox/cases/{case_id}/events", headers=_auth(user_token)).json()
    types = [e["event_type"] for e in events]
    assert "case_created" in types
    assert "upload" in types

    client.patch(f"/api/mindbox/items/{item_id}", json={"status": "done"}, headers=_auth(user_token))
    events_after = client.get(f"/api/mindbox/cases/{case_id}/events", headers=_auth(user_token)).json()
    assert "status_change" in [e["event_type"] for e in events_after]


def test_add_a_manual_session_note_to_a_case(client, user_token):
    """Bart: '...ook binnen de sessie hier in de terminal' - een vrije
    aantekening kan handmatig aan de case-tijdlijn toegevoegd worden."""
    case_id = client.post("/api/mindbox/cases", json={"name": "Sessie-case"}, headers=_auth(user_token)).json()["id"]

    res = client.post(
        f"/api/mindbox/cases/{case_id}/events",
        json={"event_type": "session_note", "description": "Claude Code-sessie: mail X gelezen, concept-antwoord Y opgesteld."},
        headers=_auth(user_token),
    )
    assert res.status_code == 200
    assert res.json()["event_type"] == "session_note"

    events = client.get(f"/api/mindbox/cases/{case_id}/events", headers=_auth(user_token)).json()
    assert any(e["event_type"] == "session_note" for e in events)


def test_add_case_event_rejects_invalid_event_type(client, user_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Case"}, headers=_auth(user_token)).json()["id"]
    res = client.post(
        f"/api/mindbox/cases/{case_id}/events",
        json={"event_type": "onbekend-type", "description": "..."},
        headers=_auth(user_token),
    )
    assert res.status_code == 400


def test_deleting_a_case_also_removes_its_events(client, user_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Op te ruimen"}, headers=_auth(user_token)).json()["id"]
    client.post(
        f"/api/mindbox/cases/{case_id}/events",
        json={"event_type": "session_note", "description": "..."},
        headers=_auth(user_token),
    )
    delete_res = client.delete(f"/api/mindbox/cases/{case_id}", headers=_auth(user_token))
    assert delete_res.status_code == 200
    # De case zelf is weg - events opvragen moet nu 404 geven (get_case faalt eerst).
    events_res = client.get(f"/api/mindbox/cases/{case_id}/events", headers=_auth(user_token))
    assert events_res.status_code == 404


def test_a_users_case_events_are_not_visible_to_another_user(client, user_token, admin_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Prive-tijdlijn"}, headers=_auth(user_token)).json()["id"]
    res = client.get(f"/api/mindbox/cases/{case_id}/events", headers=_auth(admin_token))
    assert res.status_code == 403
