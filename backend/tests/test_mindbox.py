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


def _upload(client, token, filename="test.msg", content=None, content_type="application/vnd.ms-outlook"):
    # content default is UNIEK per filename (i.p.v. altijd b"hallo") - anders
    # botsen tests die 2+ bestanden uploaden met elkaar op de nieuwe
    # duplicaatdetectie (item 1051, content_hash). Tests die een ECHT
    # duplicaat willen testen geven content expliciet identiek mee.
    if content is None:
        content = f"inhoud van {filename}".encode()
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


def test_set_parsed_text_on_an_item_and_log_a_case_event(client, user_token):
    """Item 1051 (Bart): 'als de parsing van een .msg is gedaan, dan wil ik
    dat kunnen inzien onder het bestand' - parsed_text is los van notes
    (Barts eigen aantekening)."""
    case_id = _case(client, user_token)
    item_id = _upload(client, user_token).json()["id"]
    _link_case(client, user_token, item_id, case_id)

    updated = client.patch(
        f"/api/mindbox/items/{item_id}", json={"parsed_text": "Geextraheerde mailtekst..."}, headers=_auth(user_token)
    )
    assert updated.status_code == 200
    assert updated.json()["parsed_text"] == "Geextraheerde mailtekst..."
    assert updated.json()["notes"] is None  # blijft gescheiden van notes

    events = client.get(f"/api/mindbox/cases/{case_id}/events", headers=_auth(user_token)).json()
    assert any(e["event_type"] == "item_parsed" for e in events)


def test_uploading_the_same_content_twice_is_rejected_as_duplicate(client, user_token):
    """Item 1051 (Bart): 'graag een melding geven direct na de upload met de
    vraag wat te doen' - een tweede upload met identieke bytes geeft 409 met
    genoeg info om naar het bestaande bestand te kunnen navigeren."""
    first = _upload(client, user_token, filename="mail.msg", content=b"zelfde inhoud")
    assert first.status_code == 200

    second = _upload(client, user_token, filename="mail-kopie.msg", content=b"zelfde inhoud")
    assert second.status_code == 409
    body = second.json()
    assert body["code"] == "mindbox_duplicate_file"
    assert body["extra"]["item_id"] == first.json()["id"]


def test_uploading_a_duplicate_with_force_creates_a_renamed_copy(client, user_token):
    _upload(client, user_token, filename="mail.msg", content=b"zelfde inhoud")

    forced = client.post(
        "/api/mindbox/items",
        params={"force": "true"},
        files={"file": ("mail.msg", io.BytesIO(b"zelfde inhoud"), "application/vnd.ms-outlook")},
        headers=_auth(user_token),
    )
    assert forced.status_code == 200
    assert forced.json()["original_filename"] == "mail (kopie 2).msg"

    listed = client.get("/api/mindbox/items", headers=_auth(user_token))
    assert len(listed.json()) == 2


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


def test_deleting_a_case_linked_item_is_rejected_until_unlinked(client, user_token):
    """Item 1051 (Bart): 'verwijderen van bestanden die aan een case zijn
    gekoppeld is niet mogelijk vanaf de bestand-route' - eerst ontkoppelen,
    dan pas verwijderen."""
    item_id = _upload(client, user_token).json()["id"]
    case_id = _case(client, user_token)
    _link_case(client, user_token, item_id, case_id)

    blocked = client.delete(f"/api/mindbox/items/{item_id}", headers=_auth(user_token))
    assert blocked.status_code == 400

    _unlink_case(client, user_token, item_id, case_id)
    allowed = client.delete(f"/api/mindbox/items/{item_id}", headers=_auth(user_token))
    assert allowed.status_code == 200


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


def _link_case(client, token, item_id, case_id):
    return client.post(f"/api/mindbox/items/{item_id}/cases/{case_id}", headers=_auth(token))


def _unlink_case(client, token, item_id, case_id):
    return client.delete(f"/api/mindbox/items/{item_id}/cases/{case_id}", headers=_auth(token))


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


def test_create_context_and_link_it_to_a_case(client, user_token):
    """Bart, 2-09-2026: 'sommige mails wil ik behandelen als een manager...
    = een bepaalde session.md-inhoud' - een context is herbruikbare
    instructietekst. Item 1051: 'ik wil toch per case een context, niet per
    bestand' - de koppeling zit op de case, niet op losse items."""
    context_res = client.post(
        "/api/mindbox/contexts",
        json={"name": "Manager-response", "content": "Reageer kort, zakelijk, met focus op besluitvorming."},
        headers=_auth(user_token),
    )
    assert context_res.status_code == 200
    context_id = context_res.json()["id"]

    case_id = _case(client, user_token)
    linked = client.patch(
        f"/api/mindbox/cases/{case_id}", json={"context_id": context_id}, headers=_auth(user_token)
    )
    assert linked.status_code == 200
    assert linked.json()["context_id"] == context_id


def test_create_case_with_a_context_immediately(client, user_token):
    context_id = client.post(
        "/api/mindbox/contexts", json={"name": "Manager", "content": "..."}, headers=_auth(user_token)
    ).json()["id"]
    case = client.post(
        "/api/mindbox/cases", json={"name": "Met context vanaf start", "context_id": context_id}, headers=_auth(user_token)
    )
    assert case.status_code == 200
    assert case.json()["context_id"] == context_id


def test_clear_context_from_a_case(client, user_token):
    context_id = client.post(
        "/api/mindbox/contexts", json={"name": "Tijdelijk", "content": "..."}, headers=_auth(user_token)
    ).json()["id"]
    case_id = _case(client, user_token)
    client.patch(f"/api/mindbox/cases/{case_id}", json={"context_id": context_id}, headers=_auth(user_token))

    cleared = client.patch(f"/api/mindbox/cases/{case_id}", json={"clear_context": True}, headers=_auth(user_token))
    assert cleared.json()["context_id"] is None


def test_deleting_a_context_unlinks_it_from_cases(client, user_token):
    context_id = client.post(
        "/api/mindbox/contexts", json={"name": "Te verwijderen", "content": "..."}, headers=_auth(user_token)
    ).json()["id"]
    case_id = _case(client, user_token)
    client.patch(f"/api/mindbox/cases/{case_id}", json={"context_id": context_id}, headers=_auth(user_token))

    delete_res = client.delete(f"/api/mindbox/contexts/{context_id}", headers=_auth(user_token))
    assert delete_res.status_code == 200

    case = client.get("/api/mindbox/cases", headers=_auth(user_token)).json()[0]
    assert case["context_id"] is None


def test_linking_a_nonexistent_context_to_a_case_fails(client, user_token):
    case_id = _case(client, user_token)
    res = client.patch(
        f"/api/mindbox/cases/{case_id}", json={"context_id": "does-not-exist"}, headers=_auth(user_token)
    )
    assert res.status_code == 404


def test_a_users_context_is_not_usable_by_another_user(client, user_token, admin_token):
    context_id = client.post(
        "/api/mindbox/contexts", json={"name": "Prive", "content": "..."}, headers=_auth(user_token)
    ).json()["id"]
    case_id = _case(client, admin_token)

    res = client.patch(
        f"/api/mindbox/cases/{case_id}", json={"context_id": context_id}, headers=_auth(admin_token)
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
    assert res.json()["case_ids"] == [case_id]

    listed = client.get("/api/mindbox/items", params={"case_id": case_id}, headers=_auth(user_token))
    assert len(listed.json()) == 1


def test_add_a_followup_item_to_an_existing_case(client, user_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Vervolgmail-case"}, headers=_auth(user_token)).json()["id"]
    first_id = _upload(client, user_token, filename="mail1.msg").json()["id"]
    _link_case(client, user_token, first_id, case_id)

    second_id = _upload(client, user_token, filename="mail2.msg").json()["id"]
    linked = _link_case(client, user_token, second_id, case_id)
    assert linked.json()["case_ids"] == [case_id]

    listed = client.get("/api/mindbox/items", params={"case_id": case_id}, headers=_auth(user_token))
    assert len(listed.json()) == 2


def test_an_item_can_belong_to_multiple_cases(client, user_token):
    """Item 1058: case-koppeling is many-to-many i.p.v. 1 case per item."""
    case_a = _case(client, user_token, "Case A")
    case_b = _case(client, user_token, "Case B")
    item_id = _upload(client, user_token).json()["id"]

    _link_case(client, user_token, item_id, case_a)
    linked = _link_case(client, user_token, item_id, case_b)
    assert sorted(linked.json()["case_ids"]) == sorted([case_a, case_b])

    items_in_a = client.get("/api/mindbox/items", params={"case_id": case_a}, headers=_auth(user_token)).json()
    items_in_b = client.get("/api/mindbox/items", params={"case_id": case_b}, headers=_auth(user_token)).json()
    assert [i["id"] for i in items_in_a] == [item_id]
    assert [i["id"] for i in items_in_b] == [item_id]


def test_deleting_one_of_an_items_two_cases_keeps_the_other_link(client, user_token):
    """Item 1058: verwijderen van case A mag de koppeling met case B niet
    aantasten - alleen de link naar de verwijderde case verdwijnt."""
    case_a = _case(client, user_token, "Te verwijderen")
    case_b = _case(client, user_token, "Blijft bestaan")
    item_id = _upload(client, user_token).json()["id"]
    _link_case(client, user_token, item_id, case_a)
    _link_case(client, user_token, item_id, case_b)

    delete_res = client.delete(f"/api/mindbox/cases/{case_a}", headers=_auth(user_token))
    assert delete_res.status_code == 200

    items = client.get("/api/mindbox/items", headers=_auth(user_token)).json()
    assert items[0]["case_ids"] == [case_b]


def test_all_items_in_a_case_share_the_cases_single_context(client, user_token):
    """Item 1051 (Bart): 'ik wil toch per case een context, niet per
    bestand.. dat is ingewikkeld' - alle items in een case delen dezelfde,
    op de case ingestelde context (geen per-item keuze meer)."""
    case_id = client.post("/api/mindbox/cases", json={"name": "Case met 1 context"}, headers=_auth(user_token)).json()["id"]
    context_id = client.post("/api/mindbox/contexts", json={"name": "Manager", "content": "..."}, headers=_auth(user_token)).json()["id"]
    client.patch(f"/api/mindbox/cases/{case_id}", json={"context_id": context_id}, headers=_auth(user_token))

    item1 = _upload(client, user_token, filename="a.msg").json()["id"]
    item2 = _upload(client, user_token, filename="b.msg").json()["id"]
    _link_case(client, user_token, item1, case_id)
    _link_case(client, user_token, item2, case_id)

    case = client.get("/api/mindbox/cases", headers=_auth(user_token)).json()[0]
    assert case["context_id"] == context_id
    items = client.get("/api/mindbox/items", params={"case_id": case_id}, headers=_auth(user_token)).json()
    assert "context_id" not in items[0]


def test_clear_case_from_an_item(client, user_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Tijdelijke case"}, headers=_auth(user_token)).json()["id"]
    item_id = _upload(client, user_token).json()["id"]
    _link_case(client, user_token, item_id, case_id)

    cleared = _unlink_case(client, user_token, item_id, case_id)
    assert cleared.json()["case_ids"] == []


def test_deleting_a_case_unlinks_items_but_deletes_its_responses(client, user_token):
    """Items kunnen los bestaan (blijven behouden, alleen ontkoppeld) maar
    responses zijn altijd case-gebonden (item 1051) - die verdwijnen mee
    met de case in plaats van los te blijven hangen."""
    case_id = client.post("/api/mindbox/cases", json={"name": "Op te ruimen case"}, headers=_auth(user_token)).json()["id"]
    item_id = _upload(client, user_token).json()["id"]
    _link_case(client, user_token, item_id, case_id)
    client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Concept", "source_item_ids": [item_id]},
        headers=_auth(user_token),
    )

    delete_res = client.delete(f"/api/mindbox/cases/{case_id}", headers=_auth(user_token))
    assert delete_res.status_code == 200

    items_after = client.get("/api/mindbox/items", headers=_auth(user_token)).json()
    assert len(items_after) == 1  # de response-item is VERWIJDERD, niet alleen ontkoppeld
    assert items_after[0]["case_ids"] == []
    responses_after = client.get(f"/api/mindbox/cases/{case_id}/responses", headers=_auth(user_token))
    assert responses_after.status_code == 404


def test_a_users_case_is_not_usable_by_another_user(client, user_token, admin_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Prive case"}, headers=_auth(user_token)).json()["id"]
    item_id = _upload(client, admin_token).json()["id"]

    res = _link_case(client, admin_token, item_id, case_id)
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


def test_upload_suggests_a_case_based_on_reply_prefix(client, user_token):
    """Item 1051 (Bart): 'bestanden die mogelijk bij een case horen (RE:
    bestanden uit de mail)... als voorstel meteen koppelen aan een case' -
    puur een suggestie in de response, nooit automatisch gekoppeld."""
    case_id = _case(client, user_token, "SRE-vacature-kwestie")
    first = _upload(client, user_token, filename="medior_senior SRE engineer.msg", content=b"origineel")
    _link_case(client, user_token, first.json()["id"], case_id)

    reply = _upload(client, user_token, filename="RE_ medior_senior SRE engineer.msg", content=b"antwoord")
    assert reply.status_code == 200
    data = reply.json()
    assert data["case_ids"] == []  # NIET automatisch gekoppeld
    assert data["suggested_case_id"] == case_id
    assert data["suggested_case_name"] == "SRE-vacature-kwestie"


def test_upload_does_not_suggest_a_case_for_unrelated_filenames(client, user_token):
    case_id = _case(client, user_token, "Onduidelijke naam")
    first = _upload(client, user_token, filename="xyz123.msg", content=b"a")
    _link_case(client, user_token, first.json()["id"], case_id)

    unrelated = _upload(client, user_token, filename="heel andere naam.msg", content=b"b")
    assert unrelated.json()["suggested_case_id"] is None


def test_upload_into_a_case_directly_skips_the_suggestion(client, user_token):
    case_id = _case(client, user_token)
    res = client.post(
        "/api/mindbox/items",
        params={"case_id": case_id},
        files={"file": ("test.msg", io.BytesIO(b"x"), "application/vnd.ms-outlook")},
        headers=_auth(user_token),
    )
    assert res.json()["suggested_case_id"] is None


def test_upload_an_attachment_inherits_the_parents_case(client, user_token):
    """Item 1051 (Bart): 'hoe gaan we om met attachments in een mail?' - een
    bijlage erft ALTIJD het case_id van het ouder-item."""
    case_id = _case(client, user_token, "Mail met bijlage")
    mail = _upload(client, user_token, filename="mail.msg", content=b"mail body")
    mail_id = mail.json()["id"]
    _link_case(client, user_token, mail_id, case_id)

    attachment = client.post(
        "/api/mindbox/items",
        params={"parent_item_id": mail_id},
        files={"file": ("bijlage.pdf", io.BytesIO(b"pdf-bytes"), "application/pdf")},
        headers=_auth(user_token),
    )
    assert attachment.status_code == 200
    data = attachment.json()
    assert data["parent_item_id"] == mail_id
    assert data["case_ids"] == [case_id]  # geerfd, niet expliciet meegegeven
    assert data["suggested_case_id"] is None  # geen suggestie nodig voor een bijlage

    listed = client.get(f"/api/mindbox/items/{mail_id}/attachments", headers=_auth(user_token))
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["original_filename"] == "bijlage.pdf"


def test_attachment_of_another_users_item_is_rejected(client, user_token, admin_token):
    mail_id = _upload(client, admin_token, filename="mail.msg", content=b"mail body").json()["id"]
    res = client.post(
        "/api/mindbox/items",
        params={"parent_item_id": mail_id},
        files={"file": ("bijlage.pdf", io.BytesIO(b"pdf-bytes"), "application/pdf")},
        headers=_auth(user_token),
    )
    assert res.status_code == 403


def test_deleting_the_parent_item_unlinks_its_attachments(client, user_token):
    mail_id = _upload(client, user_token, filename="mail.msg", content=b"mail body").json()["id"]
    attachment_id = client.post(
        "/api/mindbox/items",
        params={"parent_item_id": mail_id},
        files={"file": ("bijlage.pdf", io.BytesIO(b"pdf-bytes"), "application/pdf")},
        headers=_auth(user_token),
    ).json()["id"]

    delete_res = client.delete(f"/api/mindbox/items/{mail_id}", headers=_auth(user_token))
    assert delete_res.status_code == 200

    items = client.get("/api/mindbox/items", headers=_auth(user_token)).json()
    attachment = next(i for i in items if i["id"] == attachment_id)
    assert attachment["parent_item_id"] is None


def test_edit_a_response_and_log_a_case_event(client, user_token):
    case_id = _case(client, user_token)
    response_id = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Eerste versie", "source_item_ids": []},
        headers=_auth(user_token),
    ).json()["id"]

    edited = client.patch(
        f"/api/mindbox/cases/{case_id}/responses/{response_id}",
        json={"content": "Bijgewerkte versie"},
        headers=_auth(user_token),
    )
    assert edited.status_code == 200
    assert edited.json()["content"] == "Bijgewerkte versie"

    events = client.get(f"/api/mindbox/cases/{case_id}/events", headers=_auth(user_token)).json()
    assert any(e["event_type"] == "response_edited" for e in events)


def test_download_response_as_eml_logs_a_sent_event(client, user_token):
    """Item 1058: een response is nu een MindboxItem - downloaden loopt via
    de generieke /items/{id}/download i.p.v. een apart .eml-endpoint."""
    case_id = _case(client, user_token)
    response_id = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Concept-antwoord", "source_item_ids": []},
        headers=_auth(user_token),
    ).json()["id"]

    eml = client.get(f"/api/mindbox/items/{response_id}/download", headers=_auth(user_token))
    assert eml.status_code == 200
    assert b"Concept-antwoord" in eml.content

    events = client.get(f"/api/mindbox/cases/{case_id}/events", headers=_auth(user_token)).json()
    assert any(e["event_type"] == "response_sent" for e in events)


def test_a_response_is_visible_in_the_flat_items_list(client, user_token):
    """Item 1058: responses zijn nu ook gewoon MindboxItems (kind=response),
    zichtbaar in de platte /items-lijst - bevestigd met Bart."""
    case_id = _case(client, user_token)
    response_id = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Concept-antwoord", "source_item_ids": []},
        headers=_auth(user_token),
    ).json()["id"]

    items = client.get("/api/mindbox/items", headers=_auth(user_token)).json()
    response_item = next(i for i in items if i["id"] == response_id)
    assert response_item["kind"] == "response"


def test_editing_a_response_rematerializes_its_file(client, user_token):
    case_id = _case(client, user_token)
    created = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Eerste versie", "source_item_ids": []},
        headers=_auth(user_token),
    ).json()
    first_download = client.get(f"/api/mindbox/items/{created['id']}/download", headers=_auth(user_token))
    assert b"Eerste versie" in first_download.content

    client.patch(
        f"/api/mindbox/cases/{case_id}/responses/{created['id']}",
        json={"content": "Bijgewerkte versie"},
        headers=_auth(user_token),
    )
    second_download = client.get(f"/api/mindbox/items/{created['id']}/download", headers=_auth(user_token))
    assert b"Bijgewerkte versie" in second_download.content
    assert b"Eerste versie" not in second_download.content


def test_a_responses_content_hash_does_not_block_a_real_upload(client, user_token):
    """Item 1058: de duplicaatdetectie bij upload is gescoped op kind=upload,
    zodat de sha256 van een gegenereerd .eml-bestand nooit een echte upload
    kan blokkeren, zelfs niet als de bytes toevallig identiek zijn."""
    case_id = _case(client, user_token)
    response_id = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Concept-antwoord", "source_item_ids": []},
        headers=_auth(user_token),
    ).json()["id"]
    response_bytes = client.get(f"/api/mindbox/items/{response_id}/download", headers=_auth(user_token)).content

    res = _upload(client, user_token, filename="identiek.txt", content=response_bytes)
    assert res.status_code == 200


def test_a_users_response_cannot_be_edited_by_another_user(client, user_token, admin_token):
    case_id = _case(client, user_token)
    response_id = client.post(
        f"/api/mindbox/cases/{case_id}/responses",
        json={"content": "Prive", "source_item_ids": []},
        headers=_auth(user_token),
    ).json()["id"]

    res = client.patch(
        f"/api/mindbox/cases/{case_id}/responses/{response_id}",
        json={"content": "Poging tot misbruik"},
        headers=_auth(admin_token),
    )
    assert res.status_code == 403


def test_export_case_produces_a_downloadable_briefing(client, user_token):
    """Item 1058, increment 3: case + context + contacten + tijdlijn als 1
    lokaal bestand, analoog aan de item-briefing.md."""
    context_id = client.post(
        "/api/mindbox/contexts", json={"name": "Manager", "content": "Reageer kort en zakelijk."},
        headers=_auth(user_token),
    ).json()["id"]
    case_id = client.post(
        "/api/mindbox/cases", json={"name": "Export-case", "context_id": context_id}, headers=_auth(user_token),
    ).json()["id"]
    item_id = _upload(client, user_token, filename="mail.msg").json()["id"]
    _link_case(client, user_token, item_id, case_id)
    client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "sender@voorbeeld.nl"}, headers=_auth(user_token))

    exported = client.post(f"/api/mindbox/cases/{case_id}/export", headers=_auth(user_token))
    assert exported.status_code == 200
    data = exported.json()
    assert data["kind"] == "case_export"

    downloaded = client.get(f"/api/mindbox/items/{data['id']}/download", headers=_auth(user_token))
    assert downloaded.status_code == 200
    content = downloaded.content.decode("utf-8")
    assert "Export-case" in content
    assert "Reageer kort en zakelijk." in content
    assert "sender@voorbeeld.nl" in content


def test_exporting_a_case_twice_reuses_the_same_item(client, user_token):
    case_id = _case(client, user_token, "Herhaald te exporteren")

    first = client.post(f"/api/mindbox/cases/{case_id}/export", headers=_auth(user_token)).json()
    client.patch(f"/api/mindbox/cases/{case_id}", json={"description": "Bijgewerkte omschrijving"}, headers=_auth(user_token))
    second = client.post(f"/api/mindbox/cases/{case_id}/export", headers=_auth(user_token)).json()

    assert first["id"] == second["id"]
    items = client.get("/api/mindbox/items", headers=_auth(user_token)).json()
    assert len([i for i in items if i["kind"] == "case_export"]) == 1

    content = client.get(f"/api/mindbox/items/{second['id']}/download", headers=_auth(user_token)).content
    assert b"Bijgewerkte omschrijving" in content


def test_exporting_another_users_case_is_rejected(client, user_token, admin_token):
    case_id = _case(client, admin_token, "Prive case")
    res = client.post(f"/api/mindbox/cases/{case_id}/export", headers=_auth(user_token))
    assert res.status_code == 403


def test_link_two_items_with_a_free_link_type(client, user_token):
    """Item 1058 (vervolg, Bart): 'ik wil ook relaties kunnen leggen tussen
    bestanden met een linktype in de frontend' - een generiek, vrij
    link_type tussen 2 items."""
    item_a = _upload(client, user_token, filename="a.msg").json()["id"]
    item_b = _upload(client, user_token, filename="b.msg").json()["id"]

    res = client.post(
        f"/api/mindbox/items/{item_a}/links", json={"target_item_id": item_b, "link_type": "related_to"},
        headers=_auth(user_token),
    )
    assert res.status_code == 200
    a = res.json()
    assert a["links"] == [{"link_id": a["links"][0]["link_id"], "item_id": item_b, "link_type": "related_to", "direction": "out"}]

    b = client.get(f"/api/mindbox/items", headers=_auth(user_token)).json()
    b_item = next(i for i in b if i["id"] == item_b)
    assert b_item["links"] == [{"link_id": a["links"][0]["link_id"], "item_id": item_a, "link_type": "related_to", "direction": "in"}]


def test_linking_the_same_pair_and_type_twice_is_idempotent(client, user_token):
    item_a = _upload(client, user_token, filename="a.msg").json()["id"]
    item_b = _upload(client, user_token, filename="b.msg").json()["id"]

    client.post(f"/api/mindbox/items/{item_a}/links", json={"target_item_id": item_b, "link_type": "duplicate_of"}, headers=_auth(user_token))
    res = client.post(f"/api/mindbox/items/{item_a}/links", json={"target_item_id": item_b, "link_type": "duplicate_of"}, headers=_auth(user_token))
    assert len(res.json()["links"]) == 1


def test_linking_an_item_to_itself_is_rejected(client, user_token):
    item_id = _upload(client, user_token).json()["id"]
    res = client.post(f"/api/mindbox/items/{item_id}/links", json={"target_item_id": item_id, "link_type": "related_to"}, headers=_auth(user_token))
    assert res.status_code == 400


def test_unlink_items_removes_the_link_for_both_sides(client, user_token):
    item_a = _upload(client, user_token, filename="a.msg").json()["id"]
    item_b = _upload(client, user_token, filename="b.msg").json()["id"]
    created = client.post(
        f"/api/mindbox/items/{item_a}/links", json={"target_item_id": item_b, "link_type": "related_to"},
        headers=_auth(user_token),
    ).json()
    link_id = created["links"][0]["link_id"]

    res = client.delete(f"/api/mindbox/links/{link_id}", headers=_auth(user_token))
    assert res.status_code == 200
    assert res.json()["links"] == []

    b_item = next(i for i in client.get("/api/mindbox/items", headers=_auth(user_token)).json() if i["id"] == item_b)
    assert b_item["links"] == []


def test_linking_another_users_item_is_rejected(client, user_token, admin_token):
    own_item = _upload(client, user_token).json()["id"]
    other_item = _upload(client, admin_token).json()["id"]
    res = client.post(
        f"/api/mindbox/items/{own_item}/links", json={"target_item_id": other_item, "link_type": "related_to"},
        headers=_auth(user_token),
    )
    assert res.status_code == 403
