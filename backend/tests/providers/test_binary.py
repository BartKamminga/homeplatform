"""Tests voor BinaryBeatportProvider en aanverwante hulpfuncties."""

import asyncio
import os
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from routers.providers.beatport.binary import (
    BinaryBeatportProvider,
    _build_error,
    _content_name,
    _first_new_dir,
    _is_go_panic,
    _panic_reason,
)
from routers.providers.beatport.watcher import watch_progress
from routers.providers.base import DownloadResult


# ── Helpers: _first_new_dir ────────────────────────────────────────────────────

def test_first_new_dir_geeft_eerste_nieuwe(tmp_path):
    before = set()
    (tmp_path / "Alpha").mkdir()
    (tmp_path / "Beta").mkdir()
    result = _first_new_dir(str(tmp_path), before)
    assert result in ("Alpha", "Beta")


def test_first_new_dir_sorteert_alfabetisch(tmp_path):
    before = set()
    (tmp_path / "Zebra").mkdir()
    (tmp_path / "Alpha").mkdir()
    assert _first_new_dir(str(tmp_path), before) == "Alpha"


def test_first_new_dir_geen_nieuwe(tmp_path):
    (tmp_path / "Existing").mkdir()
    before = {"Existing"}
    assert _first_new_dir(str(tmp_path), before) is None


def test_first_new_dir_onbestaande_map():
    assert _first_new_dir("/deze/map/bestaat/niet", set()) is None


# ── Helpers: _content_name ─────────────────────────────────────────────────────

def test_content_name_nieuwe_type_map_met_submap(tmp_path):
    (tmp_path / "Playlists").mkdir()
    (tmp_path / "Playlists" / "My_Playlist").mkdir()
    before = set()
    assert _content_name(str(tmp_path), before) == "My Playlist"


def test_content_name_release_map(tmp_path):
    (tmp_path / "Releases").mkdir()
    (tmp_path / "Releases" / "Artist_-_Album").mkdir()
    before = set()
    assert _content_name(str(tmp_path), before) == "Artist - Album"


def test_content_name_niet_type_map(tmp_path):
    before = set()
    (tmp_path / "MijnPlaylist").mkdir()
    result = _content_name(str(tmp_path), before)
    assert result == "MijnPlaylist"


def test_content_name_restart_bestaande_type_map(tmp_path):
    """Bij restart (type-map al in before_dirs): kies meest recentelijk gewijzigde submap."""
    playlists = tmp_path / "Playlists"
    playlists.mkdir()
    before = {"Playlists"}

    (playlists / "Oud").mkdir()
    time.sleep(0.02)
    (playlists / "Nieuw").mkdir()

    result = _content_name(str(tmp_path), before)
    assert result == "Nieuw"


def test_content_name_leeg_geeft_none(tmp_path):
    assert _content_name(str(tmp_path), set()) is None


# ── Helpers: panic-detectie ────────────────────────────────────────────────────

def test_is_go_panic_herkent_goroutine():
    assert _is_go_panic(["goroutine 1 [running]:", "runtime.throw()"])


def test_is_go_panic_geen_panic():
    assert not _is_go_panic(["Downloading track 1", "Finished downloading"])


def test_panic_reason_pakt_panic_regel():
    lines = ["goroutine 1", "panic: runtime error: index out of range"]
    assert "index out of range" in _panic_reason(lines)


def test_panic_reason_pakt_network_hint():
    lines = ["goroutine 1", "connection reset by peer: timeout exceeded"]
    assert "timeout" in _panic_reason(lines)


def test_panic_reason_fallback():
    assert "crash" in _panic_reason(["goroutine 1", "random line"]).lower()


# ── BinaryBeatportProvider._prepare ───────────────────────────────────────────

def test_prepare_geen_config_dir_geeft_none(tmp_path):
    provider = BinaryBeatportProvider()
    job_updates = {}

    def fake_update(job_id, **kwargs):
        job_updates.update(kwargs)

    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job", side_effect=fake_update):
        s.BEATPORTDL_CONFIG_DIR = ""
        ctx = provider._prepare("https://beatport.com/playlists/x/1", str(tmp_path), "job1")

    assert ctx is None
    assert job_updates.get("status") == "error"
    assert "geconfigureerd" in job_updates.get("error", "").lower()


def test_prepare_config_bestand_ontbreekt(tmp_path):
    provider = BinaryBeatportProvider()
    job_updates = {}

    def fake_update(job_id, **kwargs):
        job_updates.update(kwargs)

    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job", side_effect=fake_update):
        s.BEATPORTDL_CONFIG_DIR = str(tmp_path)  # bestaat, maar geen config.yml
        ctx = provider._prepare("https://beatport.com/playlists/x/1", str(tmp_path / "dl"), "job2")

    assert ctx is None
    assert job_updates.get("status") == "error"


def test_prepare_genereert_config_met_show_progress_false(tmp_path):
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    dl_dir = tmp_path / "downloads"
    dl_dir.mkdir()

    # Minimale beatportdl config
    (config_dir / "beatportdl-config.yml").write_text(
        "quality: lossless\nshow_progress: true\n",
        encoding="utf-8",
    )

    provider = BinaryBeatportProvider()
    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job"):
        s.BEATPORTDL_CONFIG_DIR = str(config_dir)
        ctx = provider._prepare("https://beatport.com/playlists/x/1", str(dl_dir), "job3")

    assert ctx is not None
    cfg_text = open(os.path.join(ctx.work_dir, "beatportdl-config.yml"), encoding="utf-8").read()
    assert "show_progress: false" in cfg_text
    assert "quality: lossless" in cfg_text


def test_prepare_overschrijft_downloads_directory(tmp_path):
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    dl_dir = tmp_path / "downloads"
    dl_dir.mkdir()

    (config_dir / "beatportdl-config.yml").write_text(
        "downloads_directory: /old/path\n",
        encoding="utf-8",
    )

    provider = BinaryBeatportProvider()
    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job"):
        s.BEATPORTDL_CONFIG_DIR = str(config_dir)
        ctx = provider._prepare("https://beatport.com/playlists/x/1", str(dl_dir), "job4")

    assert ctx is not None
    cfg_text = open(os.path.join(ctx.work_dir, "beatportdl-config.yml"), encoding="utf-8").read()
    assert str(dl_dir) in cfg_text


def test_prepare_kopieert_credentials(tmp_path):
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    dl_dir = tmp_path / "downloads"
    dl_dir.mkdir()

    (config_dir / "beatportdl-config.yml").write_text("quality: lossless\n", encoding="utf-8")
    (config_dir / "beatportdl-credentials.json").write_text(
        '{"access_token":"tok","refresh_token":"ref"}', encoding="utf-8"
    )

    provider = BinaryBeatportProvider()
    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job"):
        s.BEATPORTDL_CONFIG_DIR = str(config_dir)
        ctx = provider._prepare("https://beatport.com/playlists/x/1", str(dl_dir), "job5")

    assert ctx is not None
    creds_path = os.path.join(ctx.work_dir, "beatportdl-credentials.json")
    assert os.path.exists(creds_path)


def test_prepare_snapshot_before_dirs(tmp_path):
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    dl_dir = tmp_path / "downloads"
    dl_dir.mkdir()
    (dl_dir / "Playlists").mkdir()
    (config_dir / "beatportdl-config.yml").write_text("quality: lossless\n", encoding="utf-8")

    provider = BinaryBeatportProvider()
    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job"):
        s.BEATPORTDL_CONFIG_DIR = str(config_dir)
        ctx = provider._prepare("https://beatport.com/playlists/x/1", str(dl_dir), "job6")

    assert ctx is not None
    assert "Playlists" in ctx.before_dirs


def test_prepare_retourneert_beatportdl_cmd(tmp_path):
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    dl_dir = tmp_path / "downloads"
    dl_dir.mkdir()
    (config_dir / "beatportdl-config.yml").write_text("quality: lossless\n", encoding="utf-8")

    provider = BinaryBeatportProvider()
    url = "https://beatport.com/playlists/test/123"
    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job"):
        s.BEATPORTDL_CONFIG_DIR = str(config_dir)
        ctx = provider._prepare(url, str(dl_dir), "job7")

    assert ctx is not None
    assert ctx.cmd[0] == "beatportdl"
    assert url in ctx.cmd


# ── BinaryBeatportProvider.download ───────────────────────────────────────────

def _mock_proc(lines: list[str], returncode: int = 1):
    """Maakt een nep-asyncio.Process met de gegeven stdout-regels."""
    proc = MagicMock()
    proc.returncode = returncode

    encoded = [l.encode() + b"\n" for l in lines] + [b""]

    async def _readline():
        if encoded:
            return encoded.pop(0)
        return b""

    proc.stdout = MagicMock()
    proc.stdout.readline = AsyncMock(side_effect=encoded)
    proc.wait = AsyncMock()
    proc.kill = MagicMock()
    return proc


def _readline_side_effect(lines: list[str]):
    """Side-effect generator voor proc.stdout.readline."""
    encoded = [l.encode() + b"\n" for l in lines] + [b""]
    idx = [0]

    async def readline():
        val = encoded[idx[0]] if idx[0] < len(encoded) else b""
        idx[0] += 1
        return val

    return readline


def test_download_config_fout_geeft_failure(tmp_path):
    provider = BinaryBeatportProvider()

    with patch.object(provider, "_prepare", return_value=None):
        result = asyncio.run(
            provider.download(
                url="https://beatport.com/playlists/x/1",
                download_dir=str(tmp_path),
                fmt="flac",
                job_id="job-cfg-fout",
                crade_id=None,
                crade_name=None,
            )
        )

    assert not result.success
    assert result.error


def test_download_succes_met_bestanden_op_disk(tmp_path):
    """Succes als er een nieuwe map met content wordt aangemaakt."""
    dl_dir = tmp_path / "downloads"
    dl_dir.mkdir()
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    (config_dir / "beatportdl-config.yml").write_text("quality: lossless\n", encoding="utf-8")

    lines = [
        "Downloading My Playlist (Progressive House) [FLAC]",
        "Finished downloading Track One (Original Mix) [FLAC]",
    ]

    proc = MagicMock()
    proc.returncode = 1  # beatportdl geeft altijd exit 1
    proc.stdout.readline = AsyncMock(side_effect=[l.encode() + b"\n" for l in lines] + [b""])
    proc.wait = AsyncMock()
    proc.kill = MagicMock()

    async def fake_exec(*args, **kwargs):
        # Maak een nep-playlist-map aan na "start"
        (dl_dir / "Playlists").mkdir(exist_ok=True)
        (dl_dir / "Playlists" / "My_Playlist").mkdir(exist_ok=True)
        return proc

    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job"), \
         patch("asyncio.create_subprocess_exec", new=fake_exec), \
         patch("routers.providers.beatport.watcher.update_job"):
        s.BEATPORTDL_CONFIG_DIR = str(config_dir)
        s.DOWNLOAD_DIR = str(dl_dir)
        result = asyncio.run(
            provider_download_helper(
                BinaryBeatportProvider(),
                url="https://beatport.com/playlists/x/1",
                download_dir=str(dl_dir),
                fmt="flac",
                job_id="job-ok",
                crade_id=None,
                crade_name=None,
            )
        )

    assert result.success
    assert result.playlist_name == "My Playlist"
    assert result.move_dir is False


async def provider_download_helper(provider, **kwargs):
    return await provider.download(**kwargs)


def test_download_mislukt_zonder_bestanden_en_met_fouten(tmp_path):
    dl_dir = tmp_path / "downloads"
    dl_dir.mkdir()
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    (config_dir / "beatportdl-config.yml").write_text("quality: lossless\n", encoding="utf-8")

    lines = [
        "Connecting to Beatport...",
        "error: unauthorized — invalid credentials",
    ]

    proc = MagicMock()
    proc.returncode = 1
    proc.stdout.readline = AsyncMock(side_effect=[l.encode() + b"\n" for l in lines] + [b""])
    proc.wait = AsyncMock()
    proc.kill = MagicMock()

    async def fake_exec(*args, **kwargs):
        return proc

    with patch("routers.providers.beatport.binary.settings") as s, \
         patch("routers.providers.beatport.binary.update_job"), \
         patch("asyncio.create_subprocess_exec", new=fake_exec), \
         patch("routers.providers.beatport.watcher.update_job"):
        s.BEATPORTDL_CONFIG_DIR = str(config_dir)
        s.DOWNLOAD_DIR = str(dl_dir)
        result = asyncio.run(
            provider_download_helper(
                BinaryBeatportProvider(),
                url="https://beatport.com/playlists/x/1",
                download_dir=str(dl_dir),
                fmt="flac",
                job_id="job-fail",
                crade_id=None,
                crade_name=None,
            )
        )

    assert not result.success
    assert result.error


# ── BinaryBeatportProvider.cancel ─────────────────────────────────────────────

def test_cancel_stop_event_gezet():
    provider = BinaryBeatportProvider()
    assert not provider._stop.is_set()
    asyncio.run(provider.cancel())
    assert provider._stop.is_set()


def test_cancel_doodt_proc():
    provider = BinaryBeatportProvider()
    proc = MagicMock()
    provider._proc = proc
    asyncio.run(provider.cancel())
    proc.kill.assert_called_once()


def test_cancel_zonder_proc_geen_exception():
    provider = BinaryBeatportProvider()
    provider._proc = None
    asyncio.run(provider.cancel())  # mag geen exception geven


# ── watch_progress ─────────────────────────────────────────────────────────────

def test_watch_progress_stopt_direct_na_stop(tmp_path):
    """Als stop al gezet is voor de eerste tick, mogen er geen DB-schrijfacties zijn."""
    stop = asyncio.Event()
    stop.set()
    updates = []

    async def fake_update(job_id, **kwargs):
        updates.append(kwargs)

    async def run():
        await watch_progress(str(tmp_path), "job-x", stop, set())

    with patch("routers.providers.beatport.watcher.update_job", side_effect=fake_update):
        asyncio.run(run())

    assert updates == []


def test_watch_progress_telt_audio_bestanden(tmp_path):
    """Na één tick moet het aantal FLAC-bestanden worden gerapporteerd."""
    stop = asyncio.Event()
    (tmp_path / "track1.flac").write_bytes(b"FLAC")
    (tmp_path / "track2.flac").write_bytes(b"FLAC")
    (tmp_path / "cover.jpg").write_bytes(b"JPG")  # mag niet meegeteld worden

    captured = {}

    async def run():
        from unittest.mock import AsyncMock

        async def fast_sleep(_n):
            pass  # direct doorgaan zonder te wachten

        def update_and_stop(job_id, **kw):
            captured.update(kw)
            stop.set()  # stop NADAT update_job aangeroepen is

        with patch("asyncio.sleep", new=AsyncMock(side_effect=fast_sleep)), \
             patch("routers.providers.beatport.watcher.update_job", side_effect=update_and_stop):
            await watch_progress(str(tmp_path), "job-y", stop, set())

    asyncio.run(run())
    assert "2 nummers" in captured.get("progress_log", "")


def test_watch_progress_detecteert_playlist_naam(tmp_path):
    """Playlist-naam wordt herkend via mapstructuur downloads_dir/Playlists/Naam/."""
    stop = asyncio.Event()
    (tmp_path / "Playlists").mkdir()
    (tmp_path / "Playlists" / "My_Playlist").mkdir()
    (tmp_path / "Playlists" / "My_Playlist" / "track.flac").write_bytes(b"FLAC")

    captured = {}

    async def run():
        from unittest.mock import AsyncMock

        async def fast_sleep(_n):
            pass

        def update_and_stop(job_id, **kw):
            captured.update(kw)
            stop.set()

        with patch("asyncio.sleep", new=AsyncMock(side_effect=fast_sleep)), \
             patch("routers.providers.beatport.watcher.update_job", side_effect=update_and_stop):
            await watch_progress(str(tmp_path), "job-z", stop, set())

    asyncio.run(run())
    assert "My Playlist" in captured.get("progress_log", "")
