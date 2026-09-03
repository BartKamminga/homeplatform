"""Item 1055/1057: commands zijn een gedeelde, door admins beheerde
bibliotheek (niet per-user) - regressietest voor de signature-mismatch
tussen routers/mindbox_commands.py en services/mindbox_commands.py die
alle /commands-endpoints liet crashen (get_commands/get_command/
get_command_by_notation_key/replace_steps riepen elkaar nog aan met een
overbodige user-arg)."""


def _command_payload(**overrides):
    payload = {
        "entity": "Case",
        "action": "TestCmd",
        "param_kind": "id",
        "notation_template": "{env}.MindBox.Case.TestCmd(#{param})",
        "icon": "\U0001F9EA",
        "description": "Test-commando",
        "steps": [
            {"kind": "manual", "instruction": "Doe iets"},
        ],
    }
    payload.update(overrides)
    return payload


def test_list_commands_works_for_regular_user(client, user_token):
    res = client.get("/api/mindbox/commands", headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
    assert res.json() == []


def test_regular_user_cannot_create_command(client, user_token):
    res = client.post(
        "/api/mindbox/commands", json=_command_payload(),
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 403


def test_admin_command_crud_and_resolve(client, admin_token, user_token):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    user_headers = {"Authorization": f"Bearer {user_token}"}

    created = client.post("/api/mindbox/commands", json=_command_payload(), headers=admin_headers)
    assert created.status_code == 200, created.text
    command = created.json()
    assert command["notation_key"] == "Case.TestCmd"

    # Lijst is gedeeld - een gewone user ziet het door de admin aangemaakte commando ook.
    listed = client.get("/api/mindbox/commands", headers=user_headers)
    assert listed.status_code == 200
    assert [c["id"] for c in listed.json()] == [command["id"]]

    resolved = client.get(
        "/api/mindbox/commands/resolve", params={"notation": "prod.MindBox.Case.TestCmd(#abc123)"},
        headers=user_headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["command"]["id"] == command["id"]

    updated = client.patch(
        f"/api/mindbox/commands/{command['id']}",
        json=_command_payload(description="Bijgewerkt"),
        headers=admin_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["description"] == "Bijgewerkt"

    deleted = client.delete(f"/api/mindbox/commands/{command['id']}", headers=admin_headers)
    assert deleted.status_code == 200

    listed_after = client.get("/api/mindbox/commands", headers=admin_headers)
    assert listed_after.json() == []
