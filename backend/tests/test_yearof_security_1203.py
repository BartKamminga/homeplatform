"""Item 1203: lekken dichten - interne codes in responses, open foto-upload,
kleinere toegangsgaten."""

from datetime import datetime, timedelta

import pytest

from models.yearof import (
    YearOfContributorLink,
    YearOfCustomEntry,
    YearOfPhoto,
    YearOfPlayer,
    YearOfPlayerEdit,
    YearOfReport,
    YearOfShortLink,
    YearOfTeamLink,
)
from routers.yearof_mo14 import photos as photos_module
from routers.yearof_mo14._shared import new_link_code

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _no_file_writes(monkeypatch):
    monkeypatch.setattr(photos_module, "_save_photo_variants", lambda photo_id, content: None)


def _setup(session):
    future = datetime.utcnow() + timedelta(days=5)
    team = YearOfTeamLink(id="team01", expires_at=future)
    match_link = YearOfShortLink(id="wedst1", link_type="match", match_ref="m1", expires_at=future)
    invul = YearOfContributorLink(id="invul1", match_ref="m1", report_type="wedstrijdverslag", expires_at=future)
    expired = YearOfContributorLink(id="oud001", match_ref="m1", report_type="wedstrijdverslag",
                                    expires_at=datetime.utcnow() - timedelta(days=1))
    report = YearOfReport(match_ref="m1", report_type="wedstrijdverslag", title="Verslag", body="x",
                          status="published", match_highlight=True, contributor_code="invul1")
    session.add_all([team, match_link, invul, expired, report])
    session.commit()
    photo = YearOfPhoto(match_ref="m1", status="published", match_highlight=True, uploader_code="team01")
    session.add(photo)
    session.commit()
    return report, photo


def _upload(client, headers=None, **form):
    return client.post(f"{API}/photos", data=form, headers=headers or {},
                       files={"file": ("a.jpg", b"fake", "image/jpeg")})


def test_public_lists_hide_internal_codes(client, session):
    _setup(session)
    for code in ("team01", "wedst1"):
        photos = client.get(f"{API}/photos?match_ref=m1&code={code}").json()
        reports = client.get(f"{API}/reports?match_ref=m1&code={code}").json()
        assert photos and all("uploader_code" not in p for p in photos)
        assert reports and all("contributor_code" not in r for r in reports)


def test_upload_requires_valid_link_or_admin(client, session, admin_token):
    _setup(session)
    assert _upload(client, match_ref="m1").status_code == 403
    assert _upload(client, match_ref="m1", code="wedst1").status_code == 403
    assert _upload(client, match_ref="m1", code="oud001").status_code == 403
    assert _upload(client, match_ref="m1", code="team01").status_code == 201
    assert _upload(client, match_ref="m1", code="invul1").status_code == 201
    assert _upload(client, _auth(admin_token), match_ref="m1").status_code == 201


def test_upload_via_link_never_goes_live_directly(client, session, admin_token):
    report, _ = _setup(session)
    via_team = _upload(client, match_ref="m1", report_id=report.id, code="team01").json()
    via_invul = _upload(client, report_id=report.id, code="invul1").json()
    via_admin = _upload(client, _auth(admin_token), report_id=report.id).json()
    assert via_team["status"] == "concept" and "uploader_code" not in via_team
    assert via_invul["status"] == "concept"
    assert via_admin["status"] == "published"


def test_contributor_link_only_uploads_to_its_own_match_and_report(client, session):
    _setup(session)
    other = YearOfReport(match_ref="m2", title="Ander", body="x", status="published")
    session.add(other)
    session.commit()
    assert _upload(client, report_id=other.id, code="invul1").status_code == 403
    photo = _upload(client, match_ref="m2", code="invul1").json()
    assert photo["match_ref"] == "m1"


def test_photo_tags_and_photo_block_need_access(client, session):
    _, photo = _setup(session)
    assert client.get(f"{API}/photos/{photo.id}/tags").status_code == 403
    assert client.get(f"{API}/photos/{photo.id}/tags?code=wedst1").status_code == 200
    assert client.get(f"{API}/matches/m1/photo-block").status_code == 403
    assert client.get(f"{API}/matches/m1/photo-block?code=wedst1").status_code == 200
    assert client.get(f"{API}/matches/m1/photo-block?code=team01").status_code == 200


def test_entries_hide_archived_for_visitors(client, session, admin_token):
    _setup(session)
    session.add_all([
        YearOfCustomEntry(kind="oefen", title="Live", date="2026-10-01"),
        YearOfCustomEntry(kind="oefen", title="Weg", date="2026-10-02", archived_at=datetime.utcnow()),
    ])
    session.commit()
    public = [e["title"] for e in client.get(f"{API}/entries?code=team01").json()]
    admin = [e["title"] for e in client.get(f"{API}/entries", headers=_auth(admin_token)).json()]
    assert public == ["Live"]
    assert set(admin) == {"Live", "Weg"}


def test_apply_player_edit_only_for_concept(client, session, admin_token):
    player = YearOfPlayer(name="Jip")
    session.add(player)
    session.commit()
    edit = YearOfPlayerEdit(player_id=player.id, nickname="J", status="rejected")
    session.add(edit)
    session.commit()
    assert client.post(f"{API}/player-edits/{edit.id}/apply", headers=_auth(admin_token)).status_code == 409


def test_new_link_code_shares_namespace(session, monkeypatch):
    session.add(YearOfContributorLink(id="aaaaaa", match_ref="m1", expires_at=datetime.utcnow()))
    session.commit()
    picks = iter("aaaaaa" + "bbbbbb")
    monkeypatch.setattr("routers.yearof_mo14._shared.secrets.choice", lambda chars: next(picks))
    assert new_link_code(session) == "bbbbbb"
