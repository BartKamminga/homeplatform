"""Tests voor downloader_worker._run_inner - de orchestratie rond de
source-agnostische DownloadProvider-abstractie (job laden, provider
aanroepen, DownloadResult naar job-status vertalen, stall-auto-retry).

Vervangt het _run_download-deel van het oude, kapotte test_beatcrades.py
(mockte destijds nog rechtstreeks asyncio.create_subprocess_exec - dat zit
sinds de provider-refactor een laag dieper, per-provider getest in
tests/providers/test_binary.py / test_ytdlp.py)."""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from models.downloader import DownloadCrade, DownloadJob
from routers.downloader_worker import _run_inner
from routers.providers.base import DownloadResult


@pytest.fixture(name="mem_engine")
def mem_engine_fixture():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(eng)
    yield eng
    SQLModel.metadata.drop_all(eng)


def _seed_job(engine, url="https://www.beatport.com/track/foo/1", source="beatport", fmt="flac"):
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


def test_run_inner_success_sets_done_and_output_path(mem_engine, tmp_path):
    job_id = _seed_job(mem_engine)
    provider = AsyncMock()
    provider.download = AsyncMock(return_value=DownloadResult(success=True, output_path="Artist_-_Track.flac", track_count=3))
    provider.name = "beatportdl"

    with (
        patch("routers.downloader_worker.engine", mem_engine),
        patch("routers.downloader_helpers.engine", mem_engine),
        patch("routers.downloader_worker.settings") as s,
        patch("routers.downloader_worker.get_provider", return_value=provider),
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        asyncio.run(_run_inner(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.status == "done"
    assert job.output_path == "Artist_-_Track.flac"
    assert job.error is None


def test_run_inner_failure_sets_error(mem_engine, tmp_path):
    job_id = _seed_job(mem_engine)
    provider = AsyncMock()
    provider.download = AsyncMock(return_value=DownloadResult(success=False, error="unauthorized — invalid credentials"))
    provider.name = "beatportdl"

    with (
        patch("routers.downloader_worker.engine", mem_engine),
        patch("routers.downloader_helpers.engine", mem_engine),
        patch("routers.downloader_worker.settings") as s,
        patch("routers.downloader_worker.get_provider", return_value=provider),
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        asyncio.run(_run_inner(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.status == "error"
    assert "unauthorized" in job.error.lower()


def test_run_inner_tool_not_found_sets_readable_error(mem_engine, tmp_path):
    job_id = _seed_job(mem_engine)
    provider = AsyncMock()

    async def raise_fnf(**kwargs):
        err = FileNotFoundError()
        err.filename = "beatportdl"
        raise err
    provider.download = raise_fnf
    provider.name = "beatportdl"

    with (
        patch("routers.downloader_worker.engine", mem_engine),
        patch("routers.downloader_helpers.engine", mem_engine),
        patch("routers.downloader_worker.settings") as s,
        patch("routers.downloader_worker.get_provider", return_value=provider),
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        asyncio.run(_run_inner(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.status == "error"
    assert "beatportdl" in job.error
    assert "niet gevonden" in job.error


def test_run_inner_stalled_result_requeues_and_schedules_retry(mem_engine, tmp_path):
    """Een stalled=True-resultaat zet de job terug op 'queued' en plant een
    eenmalige auto-herstart via asyncio.create_task (niet zelf afgewacht)."""
    job_id = _seed_job(mem_engine)
    provider = AsyncMock()
    provider.download = AsyncMock(return_value=DownloadResult(success=False, stalled=True, error="stuck"))
    provider.name = "beatportdl"

    with (
        patch("routers.downloader_worker.engine", mem_engine),
        patch("routers.downloader_helpers.engine", mem_engine),
        patch("routers.downloader_worker.settings") as s,
        patch("routers.downloader_worker.get_provider", return_value=provider),
        patch("asyncio.create_task") as create_task,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        asyncio.run(_run_inner(job_id))

    job = _fetch_job(mem_engine, job_id)
    assert job.status == "queued"
    assert job.error is None
    create_task.assert_called_once()


def test_run_inner_playlist_name_renames_crade(mem_engine, tmp_path):
    job_id = _seed_job(mem_engine)
    provider = AsyncMock()
    provider.download = AsyncMock(return_value=DownloadResult(success=True, playlist_name="My Playlist", move_dir=True))
    provider.name = "beatportdl"

    with (
        patch("routers.downloader_worker.engine", mem_engine),
        patch("routers.downloader_helpers.engine", mem_engine),
        patch("routers.downloader_worker.settings") as s,
        patch("routers.downloader_worker.get_provider", return_value=provider),
        patch("routers.downloader_worker.rename_crade") as rename_crade,
    ):
        s.DOWNLOAD_DIR = str(tmp_path)
        asyncio.run(_run_inner(job_id))

    job = _fetch_job(mem_engine, job_id)
    crade_id = job.crade_id
    rename_crade.assert_called_once_with(crade_id, "My Playlist", move_dir=True)
