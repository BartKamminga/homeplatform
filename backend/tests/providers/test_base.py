"""Tests voor DownloadProvider ABC, DownloadResult en de provider-factory."""

import asyncio
from unittest.mock import patch

import pytest

from routers.providers.base import DownloadProvider, DownloadResult
from routers.providers.factory import get_provider
from routers.providers.beatport.binary import BinaryBeatportProvider
from routers.providers.beatport.native.provider import NativeBeatportProvider
from routers.providers.ytdlp.provider import YtdlpProvider


# ── DownloadResult ─────────────────────────────────────────────────────────────

def test_result_success_defaults():
    r = DownloadResult(success=True)
    assert r.playlist_name is None
    assert r.track_count == 0
    assert r.output_path is None
    assert r.move_dir is False
    assert r.error is None


def test_result_failure_defaults():
    r = DownloadResult(success=False)
    assert r.success is False
    assert r.error is None


def test_result_all_fields():
    r = DownloadResult(
        success=True,
        playlist_name="Techno Essentials",
        track_count=12,
        output_path="Playlists/Techno_Essentials",
        move_dir=False,
    )
    assert r.success
    assert r.playlist_name == "Techno Essentials"
    assert r.track_count == 12
    assert r.output_path == "Playlists/Techno_Essentials"
    assert r.move_dir is False


def test_result_with_error():
    r = DownloadResult(success=False, error="Verbinding mislukt")
    assert not r.success
    assert r.error == "Verbinding mislukt"


# ── DownloadProvider ABC ───────────────────────────────────────────────────────

def test_provider_is_abstract():
    with pytest.raises(TypeError):
        DownloadProvider()


def test_binary_provider_name():
    assert BinaryBeatportProvider().name == "beatportdl-binary"


def test_ytdlp_provider_name():
    assert YtdlpProvider().name == "yt-dlp"


def test_native_provider_name():
    assert NativeBeatportProvider().name == "beatport-native"


def test_native_provider_stub_returns_failure():
    """Stub retourneert altijd failure totdat de implementatie klaar is."""
    result = asyncio.run(
        NativeBeatportProvider().download(
            url="https://www.beatport.com/playlists/test/1",
            download_dir="/tmp",
            fmt="flac",
            job_id="test-job",
            crade_id=None,
            crade_name=None,
        )
    )
    assert not result.success
    assert result.error


# ── Factory ────────────────────────────────────────────────────────────────────

def test_factory_beatport_geeft_binary(monkeypatch):
    monkeypatch.setattr("routers.providers.factory.settings.BEATPORT_PROVIDER", "binary")
    provider = get_provider("beatport")
    assert isinstance(provider, BinaryBeatportProvider)


def test_factory_beatsource_geeft_binary(monkeypatch):
    monkeypatch.setattr("routers.providers.factory.settings.BEATPORT_PROVIDER", "binary")
    provider = get_provider("beatsource")
    assert isinstance(provider, BinaryBeatportProvider)


def test_factory_beatport_native(monkeypatch):
    monkeypatch.setattr("routers.providers.factory.settings.BEATPORT_PROVIDER", "native")
    provider = get_provider("beatport")
    assert isinstance(provider, NativeBeatportProvider)


def test_factory_youtube_geeft_ytdlp():
    assert isinstance(get_provider("youtube"), YtdlpProvider)


def test_factory_soundcloud_geeft_ytdlp():
    assert isinstance(get_provider("soundcloud"), YtdlpProvider)


def test_factory_auto_geeft_ytdlp():
    assert isinstance(get_provider("auto"), YtdlpProvider)


def test_factory_nieuwe_instantie_per_aanroep(monkeypatch):
    """Elke aanroep retourneert een nieuwe instantie."""
    monkeypatch.setattr("routers.providers.factory.settings.BEATPORT_PROVIDER", "binary")
    p1 = get_provider("beatport")
    p2 = get_provider("beatport")
    assert p1 is not p2
