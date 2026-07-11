"""Tests voor de BeatCrades downloader — beatportdl + yt-dlp integratie."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from models.downloader import DownloadCrade, DownloadCradeGroup, DownloadJob, DownloadSection
from routers.downloader import _detect_source, _run_download, _safe_name


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="mem_engine")
def mem_engine_fixture():
    """In-memory SQLite voor _run_download-tests (los van de client-fixture)."""
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(eng)
    yield eng
    SQLModel.metadata.drop_all(eng)


def _seed_job(engine, url="https://www.beatport.com/track/foo/1",
              source="beatport", fmt="flac"):
    """Maak een minimale DownloadCrade + DownloadJob en geef het job-id terug."""
    with Session(engine) as s:
        crade = DownloadCrade(name="test", subdir="test", source_url=url, format=fmt)
        s.add(crade)
        s.commit()
        s.refresh(crade)
        job = DownloadJob(url=url, source=source, format=fmt, crade_id=crade.id)
        s.add(job)
        s.commit()
        s.refresh(job)
        return job.id


def _fetch_job(engine, job_id):
    with Session(engine) as s:
        return s.get(DownloadJob, job_id)


def _mock_proc(lines: list, returncode: int = 0):
    """Nep-asyncio.Process: geeft lines als stdout en returncode na wait()."""
    proc = MagicMock()
    proc.returncode = returncode
    proc.wait = AsyncMock()

    async def _stdout():
        for line in lines:
            yield (line.encode() if isinstance(line, str) else line)

    proc.stdout = _stdout()
    return proc


# ── Unit: URL-herkenning (_detect_source) ─────────────────────────────────────

def test_detect_beatport():
    assert _detect_source("https://www.beatport.com/track/foo/12345") == "beatport"


def test_detect_beatsource():
    assert _detect_source("https://www.beatsource.com/release/bar/99") == "beatport"


def test_detect_youtube_long():
    assert _detect_source("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "youtube"


def test_detect_youtu_be():
    assert _detect_source("https://youtu.be/dQw4w9WgXcQ") == "youtube"


def test_detect_soundcloud():
    assert _detect_source("https://soundcloud.com/artist/track") == "soundcloud"


def test_detect_unknown_falls_back_to_auto():
    assert _detect_source("https://example.com/audio.mp3") == "auto"


def test_detect_case_insensitive():
    assert _detect_source("HTTPS://WWW.BEATPORT.COM/TRACK/FOO/1") == "beatport"


# ── Unit: mapnaam-sanitatie (_safe_name) ──────────────────────────────────────

def test_safe_name_spaces_become_underscores():
    assert _safe_name("My Playlist") == "My_Playlist"


def test_safe_name_hyphen_and_dot_preserved():
    assert _safe_name("Best-Of.2024") == "Best-Of.2024"


def test_safe_name_parens_replaced():
    assert _safe_name("Track (feat. DJ)") == "Track__feat._DJ"


def test_safe_name_empty_result_falls_back():
    # Alleen spaties → underscores → gestript → leeg → "crade"
    assert _safe_name("   ") == "crade"


def test_safe_name_unicode_accent_stripped():
    assert _safe_name("Café Mix") == "Cafe_Mix"


# ── _run_download: beatportdl-specifiek ───────────────────────────────────────

def test_run_download_uses_beatportdl_for_beatport(mem_engine, tmp_path):
    """Bij source='beatport' moet beatportdl als eerste arg worden gebruikt."""
    job_id = _seed_job(mem_engine, source="beatport")
    proc = _mock_proc([], returncode=0)
    captured = []

    async def fake_exec(*args, **kwargs):
        captured.extend(args)
        return proc

    with (
        patch("routers.downloader.engine", mem_engine),
        patch("asyncio.create_subprocess_exec", new=fake_exec),
        patch("routers.downloader.settings") as s,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        s.BEATPORTDL_CONFIG_DIR = None
        asyncio.run(_run_download(job_id))

    assert captured[0] == "beatportdl"
    assert "https://www.beatport.com/track/foo/1" in captured


def test_run_download_uses_ytdlp_for_youtube(mem_engine, tmp_path):
    """Bij source='youtube' moet yt-dlp met -x flag worden gebruikt."""
    job_id = _seed_job(
        mem_engine,
        url="https://www.youtube.com/watch?v=abc",
        source="youtube",
    )
    proc = _mock_proc([], returncode=0)
    captured = []

    async def fake_exec(*args, **kwargs):
        captured.extend(args)
        return proc

    with (
        patch("routers.downloader.engine", mem_engine),
        patch("asyncio.create_subprocess_exec", new=fake_exec),
        patch("routers.downloader.settings") as s,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        s.BEATPORTDL_CONFIG_DIR = None
        asyncio.run(_run_download(job_id))

    assert captured[0] == "yt-dlp"
    assert "-x" in captured


def test_run_download_success_sets_done_and_output_path(mem_engine, tmp_path):
    """Exit 0 + Destination-regel → status=done, output_path gezet."""
    job_id = _seed_job(mem_engine)
    proc = _mock_proc([
        "Fetching track info...",
        "Destination: /downloads/Artist_-_Track.flac",
        "[download] 100% of 5.00MiB",
    ], returncode=0)

    with (
        patch("routers.downloader.engine", mem_engine),
        patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=proc),
        patch("routers.downloader.settings") as s,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        s.BEATPORTDL_CONFIG_DIR = None
        asyncio.run(_run_download(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.status == "done"
    assert job.output_path == "Artist_-_Track.flac"
    assert job.error is None


def test_run_download_non_zero_exit_sets_error(mem_engine, tmp_path):
    """Exit 1 → status=error, '[exit 1]' in error-tekst."""
    job_id = _seed_job(mem_engine)
    proc = _mock_proc([
        "Connecting...",
        "Error: unauthorized — invalid credentials",
    ], returncode=1)

    with (
        patch("routers.downloader.engine", mem_engine),
        patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=proc),
        patch("routers.downloader.settings") as s,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        s.BEATPORTDL_CONFIG_DIR = None
        asyncio.run(_run_download(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.status == "error"
    assert "[exit 1]" in job.error
    assert "unauthorized" in job.error.lower()


def test_run_download_error_keywords_captured_in_hints(mem_engine, tmp_path):
    """Regels met error-keywords (fatal, fail…) worden apart bijgehouden."""
    job_id = _seed_job(mem_engine)
    proc = _mock_proc([
        "Starting download...",
        "fatal: connection refused by server",
        "Process ended",
    ], returncode=1)

    with (
        patch("routers.downloader.engine", mem_engine),
        patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=proc),
        patch("routers.downloader.settings") as s,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        s.BEATPORTDL_CONFIG_DIR = None
        asyncio.run(_run_download(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.status == "error"
    assert "fatal" in job.error.lower()


def test_run_download_tool_not_found(mem_engine, tmp_path):
    """FileNotFoundError → leesbare foutmelding met toolnaam."""
    job_id = _seed_job(mem_engine)

    async def raise_fnf(*args, **kwargs):
        err = FileNotFoundError()
        err.filename = "beatportdl"
        raise err

    with (
        patch("routers.downloader.engine", mem_engine),
        patch("asyncio.create_subprocess_exec", new=raise_fnf),
        patch("routers.downloader.settings") as s,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        s.BEATPORTDL_CONFIG_DIR = None
        asyncio.run(_run_download(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.status == "error"
    assert "beatportdl" in job.error
    assert "niet gevonden" in job.error


def test_run_download_last_progress_at_set_after_five_lines(mem_engine, tmp_path):
    """last_progress_at wordt gezet na elke 5 output-regels."""
    job_id = _seed_job(mem_engine)
    lines = [f"Line {i}" for i in range(6)]
    proc = _mock_proc(lines, returncode=0)

    with (
        patch("routers.downloader.engine", mem_engine),
        patch("asyncio.create_subprocess_exec", new_callable=AsyncMock, return_value=proc),
        patch("routers.downloader.settings") as s,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        s.BEATPORTDL_CONFIG_DIR = None
        asyncio.run(_run_download(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.last_progress_at is not None


def test_run_download_config_flag_points_to_file(mem_engine, tmp_path):
    """-c moet verwijzen naar het config.yaml-bestand, niet de map."""
    job_id = _seed_job(mem_engine, source="beatport")
    proc = _mock_proc([], returncode=0)
    captured = []

    async def fake_exec(*args, **kwargs):
        captured.extend(args)
        return proc

    with (
        patch("routers.downloader.engine", mem_engine),
        patch("asyncio.create_subprocess_exec", new=fake_exec),
        patch("routers.downloader.settings") as s,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        s.BEATPORTDL_CONFIG_DIR = "/config/beatportdl"
        asyncio.run(_run_download(job_id))

    assert "-c" in captured
    c_index = captured.index("-c")
    assert captured[c_index + 1].endswith("config.yaml")
    assert "beatportdl" in captured[c_index + 1]


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
    with patch("routers.downloader._run_download"):
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
    with patch("routers.downloader._run_download"):
        r1 = client.post("/api/beatcrades/crades",
                         json={"source_url": "https://soundcloud.com/a/b", "name": "Mix"},
                         headers=_auth(user_token)).json()
        r2 = client.post("/api/beatcrades/crades",
                         json={"source_url": "https://soundcloud.com/a/c", "name": "Mix"},
                         headers=_auth(user_token)).json()
    assert r1["subdir"] != r2["subdir"]


def test_restart_crade_resets_to_queued(client, user_token):
    with patch("routers.downloader._run_download"):
        crade = client.post(
            "/api/beatcrades/crades",
            json={"source_url": "https://soundcloud.com/a/track", "name": "SC"},
            headers=_auth(user_token),
        ).json()

    with patch("routers.downloader._run_download"):
        res = client.post(f"/api/beatcrades/crades/{crade['id']}/restart",
                          headers=_auth(user_token))
    assert res.status_code == 200
    assert res.json()["status"] == "queued"
