"""Tests voor YtdlpProvider."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from routers.providers.ytdlp.provider import (
    PLAYLIST_NAME_RE,
    YtdlpProvider,
    _build_cmd,
    _build_error,
)
from routers.providers.base import DownloadResult


# ── _build_cmd ─────────────────────────────────────────────────────────────────

def test_build_cmd_begint_met_yt_dlp():
    cmd = _build_cmd("https://youtu.be/abc", "mp3", "/downloads")
    assert cmd[0] == "yt-dlp"


def test_build_cmd_bevat_extract_audio_flag():
    cmd = _build_cmd("https://youtu.be/abc", "mp3", "/downloads")
    assert "-x" in cmd


def test_build_cmd_bevat_audio_format():
    cmd = _build_cmd("https://youtu.be/abc", "flac", "/downloads")
    idx = cmd.index("--audio-format")
    assert cmd[idx + 1] == "flac"


def test_build_cmd_bevat_output_dir():
    cmd = _build_cmd("https://youtu.be/abc", "mp3", "/mijn/downloads")
    idx = cmd.index("-P")
    assert cmd[idx + 1] == "/mijn/downloads"


def test_build_cmd_bevat_url():
    url = "https://www.youtube.com/watch?v=abc123"
    cmd = _build_cmd(url, "mp3", "/downloads")
    assert url in cmd


# ── PLAYLIST_NAME_RE ───────────────────────────────────────────────────────────

def test_playlist_regex_herkent_youtube_format():
    line = "[youtube:tab] Playlist Techno Sessions: Downloading 42 items of 42"
    m = PLAYLIST_NAME_RE.match(line)
    assert m is not None
    assert m.group(1) == "Techno Sessions"


def test_playlist_regex_soundcloud_format():
    line = "[soundcloud:set] Playlist Deep House Mix: Downloading 12 items of 12"
    m = PLAYLIST_NAME_RE.match(line)
    assert m is not None
    assert m.group(1) == "Deep House Mix"


def test_playlist_regex_geen_match_op_download_regel():
    line = "[download] 50.0% of 10.00MiB at 1.50MiB/s"
    assert PLAYLIST_NAME_RE.match(line) is None


def test_playlist_regex_geen_match_op_lege_regel():
    assert PLAYLIST_NAME_RE.match("") is None


# ── _build_error ───────────────────────────────────────────────────────────────

def test_build_error_met_error_hints():
    proc = MagicMock(); proc.returncode = 1
    result = _build_error(proc, ["ERROR: no such format", "ERROR: 403 forbidden"], [])
    assert "[exit 1]" in result
    assert "403" in result


def test_build_error_zonder_hints_geeft_laatste_regels():
    proc = MagicMock(); proc.returncode = 2
    lines = [f"Line {i}" for i in range(15)]
    result = _build_error(proc, [], lines)
    assert "[exit 2]" in result
    assert "Line 14" in result


# ── YtdlpProvider.name ────────────────────────────────────────────────────────

def test_ytdlp_provider_name():
    assert YtdlpProvider().name == "yt-dlp"


# ── YtdlpProvider.download ────────────────────────────────────────────────────

def _make_proc(lines: list[str], returncode: int):
    """Maak een nep-asyncio.Process met gegeven stdout-regels."""
    proc = MagicMock()
    proc.returncode = returncode
    proc.wait = AsyncMock()
    proc.kill = MagicMock()

    encoded = [l.encode() + b"\n" for l in lines] + [b""]
    idx = [0]

    async def readline():
        val = encoded[idx[0]] if idx[0] < len(encoded) else b""
        idx[0] = min(idx[0] + 1, len(encoded) - 1)
        return val

    proc.stdout = MagicMock()
    proc.stdout.readline = readline
    return proc


def test_download_succes_exit_0():
    proc = _make_proc(["[youtube] Downloading video info", "Destination: track.mp3"], 0)

    async def fake_exec(*args, **kwargs):
        return proc

    with patch("asyncio.create_subprocess_exec", new=fake_exec), \
         patch("routers.providers.ytdlp.provider.update_job"):
        result = asyncio.run(
            YtdlpProvider().download(
                url="https://youtu.be/abc",
                download_dir="/tmp/dl",
                fmt="mp3",
                job_id="job-ok",
                crade_id=None,
                crade_name=None,
            )
        )

    assert result.success
    assert result.move_dir is True
    assert result.error is None


def test_download_fout_bij_non_zero_exit():
    proc = _make_proc(["ERROR: Video unavailable"], 1)

    async def fake_exec(*args, **kwargs):
        return proc

    with patch("asyncio.create_subprocess_exec", new=fake_exec), \
         patch("routers.providers.ytdlp.provider.update_job"):
        result = asyncio.run(
            YtdlpProvider().download(
                url="https://youtu.be/abc",
                download_dir="/tmp/dl",
                fmt="mp3",
                job_id="job-fail",
                crade_id=None,
                crade_name=None,
            )
        )

    assert not result.success
    assert result.error
    assert "[exit 1]" in result.error


def test_download_detecteert_playlist_naam():
    lines = [
        "[youtube:tab] Playlist Techno Essentials: Downloading 20 items of 20",
        "Destination: track.flac",
    ]
    proc = _make_proc(lines, 0)

    async def fake_exec(*args, **kwargs):
        return proc

    with patch("asyncio.create_subprocess_exec", new=fake_exec), \
         patch("routers.providers.ytdlp.provider.update_job"):
        result = asyncio.run(
            YtdlpProvider().download(
                url="https://youtube.com/playlist?list=abc",
                download_dir="/tmp/dl",
                fmt="flac",
                job_id="job-playlist",
                crade_id=None,
                crade_name=None,
            )
        )

    assert result.success
    assert result.playlist_name == "Techno Essentials"


def test_download_geen_playlist_naam_als_geen_match():
    proc = _make_proc(["[youtube] Downloading", "Destination: track.mp3"], 0)

    async def fake_exec(*args, **kwargs):
        return proc

    with patch("asyncio.create_subprocess_exec", new=fake_exec), \
         patch("routers.providers.ytdlp.provider.update_job"):
        result = asyncio.run(
            YtdlpProvider().download(
                url="https://youtu.be/single",
                download_dir="/tmp/dl",
                fmt="mp3",
                job_id="job-single",
                crade_id=None,
                crade_name=None,
            )
        )

    assert result.success
    assert result.playlist_name is None


# ── YtdlpProvider._read_loop ──────────────────────────────────────────────────

def test_read_loop_percentage_overschrijft_vorige():
    """[download] NN%-regels overschrijven de vorige in de buffer."""
    lines_input = [
        "[download]  10% of 10.00MiB",
        "[download]  50% of 10.00MiB",
        "[download] 100% of 10.00MiB",
        "Destination: track.mp3",
    ]
    proc = _make_proc(lines_input, 0)
    provider = YtdlpProvider()
    provider._proc = proc

    with patch("routers.providers.ytdlp.provider.update_job"):
        lines, _, _ = asyncio.run(provider._read_loop("job-pct"))

    pct_lines = [l for l in lines if "[download]" in l]
    assert len(pct_lines) == 1
    assert "100%" in pct_lines[0]


def test_read_loop_flusht_na_vijf_regels():
    """Na elke 5 nieuwe regels wordt update_job aangeroepen."""
    lines_input = [f"Line {i}" for i in range(6)]
    proc = _make_proc(lines_input, 0)
    provider = YtdlpProvider()
    provider._proc = proc

    calls = []
    with patch("routers.providers.ytdlp.provider.update_job",
               side_effect=lambda job_id, **kw: calls.append(kw)):
        asyncio.run(provider._read_loop("job-flush"))

    assert any("progress_log" in c for c in calls)


def test_read_loop_verzamelt_error_hints():
    """Regels met fout-trefwoorden worden apart bijgehouden."""
    lines_input = [
        "Downloading...",
        "ERROR: HTTP Error 403: Forbidden",
        "Aborting...",
    ]
    proc = _make_proc(lines_input, 0)
    provider = YtdlpProvider()
    provider._proc = proc

    with patch("routers.providers.ytdlp.provider.update_job"):
        _, _, error_hints = asyncio.run(provider._read_loop("job-err"))

    assert any("403" in h for h in error_hints)


# ── YtdlpProvider.cancel ──────────────────────────────────────────────────────

def test_cancel_doodt_proc():
    provider = YtdlpProvider()
    proc = MagicMock()
    provider._proc = proc
    asyncio.run(provider.cancel())
    proc.kill.assert_called_once()


def test_cancel_zonder_proc_geen_exception():
    provider = YtdlpProvider()
    provider._proc = None
    asyncio.run(provider.cancel())  # mag niet crashen
