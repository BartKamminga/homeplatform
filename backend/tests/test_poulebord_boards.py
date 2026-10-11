"""Item 1268: Poulebord los van Tournix - eigen /api/poulebord-paden, oude
/api/tournix-paden tijdelijk nog bruikbaar, Tournix-leesroutes weg."""


def test_board_roundtrip_on_new_and_legacy_paths(client):
    body = {"name": " Mijn board ", "club": "Victoria", "pins": ["t1"], "pool_pins": [{"phaseId": "disc_5"}]}
    created = client.post("/api/poulebord/public/boards", json=body)
    assert created.status_code == 201
    code = created.json()["id"]
    assert len(code) == 6 and created.json()["name"] == "Mijn board"

    for prefix in ("/api/poulebord", "/api/tournix"):
        got = client.get(f"{prefix}/public/boards/{code}").json()
        assert got["pins"] == ["t1"] and got["pool_pins"] == [{"phaseId": "disc_5"}]

    legacy = client.post("/api/tournix/public/boards", json={"name": "Oud"})
    assert legacy.status_code == 201


def test_board_validation_and_404(client):
    assert client.post("/api/poulebord/public/boards", json={"name": "  "}).status_code == 400
    assert client.get("/api/poulebord/public/boards/zzzzzz").status_code == 404


def test_beacon(client):
    for prefix in ("/api/poulebord", "/api/tournix"):
        assert client.post(f"{prefix}/public/beacon").json() == {"ok": True}


def test_tournix_read_routes_for_poulebord_are_gone(client):
    for path in ("/api/tournix/public/phases/x/standings", "/api/tournix/public/phases/x/pool-matches",
                 "/api/tournix/public/tournaments/x/phases", "/api/tournix/public/search?q=abc"):
        assert client.get(path).status_code in (404, 405), path
