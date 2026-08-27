"""Tests voor de BeatCrades downloader — CRUD-API + naam/bron-detectie-helpers.

De _run_download-orchestratie zelf (subprocess-dispatch, retry, stall-
detectie) verhuisde naar de source-agnostische provider-architectuur
(routers/providers/*) - die laag wordt getest in tests/providers/test_binary.py
/ test_ytdlp.py, en de orchestratie eromheen (downloader_worker._run_inner)
in tests/test_downloader_worker.py."""

from unittest.mock import patch

from routers.downloader_helpers import detect_source, safe_name


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── Unit: URL-herkenning (detect_source) ───────────────────────────────────────

def test_detect_beatport():
    assert detect_source("https://www.beatport.com/track/foo/12345") == "beatport"


def test_detect_beatsource():
    assert detect_source("https://www.beatsource.com/release/bar/99") == "beatport"


def test_detect_youtube_long():
    assert detect_source("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "youtube"


def test_detect_youtu_be():
    assert detect_source("https://youtu.be/dQw4w9WgXcQ") == "youtube"


def test_detect_soundcloud():
    assert detect_source("https://soundcloud.com/artist/track") == "soundcloud"


def test_detect_unknown_falls_back_to_auto():
    assert detect_source("https://example.com/audio.mp3") == "auto"


def test_detect_case_insensitive():
    assert detect_source("HTTPS://WWW.BEATPORT.COM/TRACK/FOO/1") == "beatport"


# ── Unit: mapnaam-sanitatie (safe_name) ────────────────────────────────────────
# safe_name strip alleen filesystem-onveilige tekens (\/:*?"<>|) en normaliseert
# whitespace - spaties/haakjes blijven, in tegenstelling tot de oude, striktere
# _safe_name die alles naar underscores omzette.

def test_safe_name_keeps_spaces():
    assert safe_name("My Playlist") == "My Playlist"


def test_safe_name_hyphen_and_dot_preserved():
    assert safe_name("Best-Of.2024") == "Best-Of.2024"


def test_safe_name_forbidden_chars_stripped():
    assert safe_name('Te:st*Na?me"<x>|') == "TestNamex"


def test_safe_name_empty_result_falls_back():
    assert safe_name("   ") == "crade"


def test_safe_name_unicode_accent_stripped():
    assert safe_name("Café Mix") == "Cafe Mix"


# ── API: CRUD via HTTP ────────────────────────────────────────────────────────

def test_tree_requires_auth(client):
    assert client.get("/api/beatcrades/tree").status_code == 401


def test_tree_empty_after_startup(client, user_token):
    res = client.get("/api/beatcrades/tree", headers=_auth(user_token))
    assert res.status_code == 200
    data = res.json()
    assert data["sections"] == []
    assert data["racks"] == []
    assert data["crades"] == []


def test_create_section(client, user_token):
    res = client.post("/api/beatcrades/sections", json={"name": "Techno"},
                      headers=_auth(user_token))
    assert res.status_code == 200
    assert res.json()["name"] == "Techno"
    assert "id" in res.json()


def test_rename_section(client, user_token):
    sec_id = client.post("/api/beatcrades/sections", json={"name": "House"},
                         headers=_auth(user_token)).json()["id"]
    client.patch(f"/api/beatcrades/sections/{sec_id}", json={"name": "Deep House"},
                 headers=_auth(user_token))
    tree = client.get("/api/beatcrades/tree", headers=_auth(user_token)).json()
    assert any(s["name"] == "Deep House" for s in tree["sections"])


def test_delete_section_detaches_racks(client, user_token):
    sec_id = client.post("/api/beatcrades/sections", json={"name": "Temp"},
                         headers=_auth(user_token)).json()["id"]
    rack = client.post("/api/beatcrades/racks",
                       json={"name": "R1", "section_id": sec_id},
                       headers=_auth(user_token)).json()

    client.delete(f"/api/beatcrades/sections/{sec_id}", headers=_auth(user_token))

    tree = client.get("/api/beatcrades/tree", headers=_auth(user_token)).json()
    free_ids = [r["id"] for r in tree["racks"]]
    assert rack["id"] in free_ids


def test_rack_in_section_appears_nested(client, user_token):
    sec_id = client.post("/api/beatcrades/sections", json={"name": "S1"},
                         headers=_auth(user_token)).json()["id"]
    rack = client.post("/api/beatcrades/racks",
                       json={"name": "R1", "section_id": sec_id},
                       headers=_auth(user_token)).json()

    tree = client.get("/api/beatcrades/tree", headers=_auth(user_token)).json()
    section = next(s for s in tree["sections"] if s["id"] == sec_id)
    assert any(r["id"] == rack["id"] for r in section["racks"])


def test_create_crade_returns_queued_job(client, user_token):
    with patch("routers.downloader.run_download"):
        res = client.post(
            "/api/beatcrades/crades",
            json={"source_url": "https://www.beatport.com/track/foo/1", "name": "Test"},
            headers=_auth(user_token),
        )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("queued", "downloading")
    assert data["job_id"] is not None


def test_create_crade_empty_url_rejected(client, user_token):
    res = client.post("/api/beatcrades/crades", json={"source_url": ""},
                      headers=_auth(user_token))
    assert res.status_code == 400


def test_crade_subdir_collision_avoided(client, user_token):
    with patch("routers.downloader.run_download"):
        r1 = client.post("/api/beatcrades/crades",
                         json={"source_url": "https://soundcloud.com/a/b", "name": "Mix"},
                         headers=_auth(user_token)).json()
        r2 = client.post("/api/beatcrades/crades",
                         json={"source_url": "https://soundcloud.com/a/c", "name": "Mix"},
                         headers=_auth(user_token)).json()
    assert r1["subdir"] != r2["subdir"]


def test_restart_crade_resets_to_queued(client, user_token):
    with patch("routers.downloader.run_download"):
        crade = client.post(
            "/api/beatcrades/crades",
            json={"source_url": "https://soundcloud.com/a/track", "name": "SC"},
            headers=_auth(user_token),
        ).json()

    with patch("routers.downloader.run_download"):
        res = client.post(f"/api/beatcrades/crades/{crade['id']}/restart",
                          headers=_auth(user_token))
    assert res.status_code == 200
    assert res.json()["status"] == "queued"
