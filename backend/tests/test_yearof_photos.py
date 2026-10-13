"""Item 1204: karakteriseringstests fotos - upload/varianten, publieke lijst,
moderatie, bijwerken, likes en tags. Leggen het huidige gedrag vast als
vangnet voor de refactor (1205/1206). Toegang bij upload staat in
test_yearof_security_1203.py, archiveren in test_yearof_photo_manager.py."""

from datetime import datetime, timedelta

import pytest
from sqlmodel import select

from models.yearof import YearOfPhoto, YearOfPlayer, YearOfReport, YearOfShortLink, YearOfTeamLink
from routers.yearof_mo14 import photos as photos_module

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _no_file_writes(monkeypatch):
    monkeypatch.setattr(photos_module, "_save_photo_variants", lambda photo_id, content: None)
    monkeypatch.setattr(photos_module, "_save_video", lambda photo_id, content, ext: None)


def _upload(client, token, filename="a.jpg", content_type="image/jpeg", **form):
    return client.post(f"{API}/photos", data=form, headers=_auth(token),
                       files={"file": (filename, b"fake", content_type)})


def _photo(session, **kw):
    photo = YearOfPhoto(**{"match_ref": "m1", "status": "published", **kw})
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


# --- upload ------------------------------------------------------------------

def test_admin_upload_photo_is_concept(client, admin_token):
    res = _upload(client, admin_token, match_ref="m1", photo_type="team")
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "concept"
    assert body["media_type"] == "photo"
    assert body["photo_type"] == "team"
    assert body["file_ext"] is None
    assert body["published_at"] is None
    assert "uploader_code" not in body


def test_admin_upload_to_published_report_goes_live_and_takes_its_match(client, admin_token, session):
    report = YearOfReport(match_ref="m7", report_type="nieuws", title="t", body="b", status="published")
    session.add(report)
    session.commit()
    body = _upload(client, admin_token, match_ref="anders", report_id=report.id).json()
    assert body["status"] == "published"
    assert body["published_at"] is not None
    assert body["match_ref"] == "m7"  # match_ref volgt altijd het verslag


def test_admin_upload_to_concept_report_stays_concept(client, admin_token, session):
    report = YearOfReport(match_ref="m7", report_type="nieuws", title="t", body="b", status="concept")
    session.add(report)
    session.commit()
    assert _upload(client, admin_token, report_id=report.id).json()["status"] == "concept"


def test_upload_unknown_report_404(client, admin_token):
    assert _upload(client, admin_token, report_id="bestaat-niet").status_code == 404


def test_upload_video_keeps_extension(client, admin_token):
    body = _upload(client, admin_token, filename="clip.MP4", content_type="video/mp4", match_ref="m1").json()
    assert body["media_type"] == "video"
    assert body["file_ext"] == ".mp4"


@pytest.mark.parametrize("filename,content_type", [
    ("a.gif", "image/gif"),        # extensie niet toegestaan
    ("a.jpg", "text/plain"),       # type niet toegestaan
    ("a.avi", "video/mp4"),        # video met verkeerde extensie
    ("a.mp4", "application/zip"),  # extensie video, type niet
])
def test_upload_rejects_wrong_type_or_extension(client, admin_token, filename, content_type):
    assert _upload(client, admin_token, filename=filename, content_type=content_type).status_code == 400


def test_upload_without_extension_counts_as_jpg(client, admin_token):
    assert _upload(client, admin_token, filename="plak", content_type="image/png").status_code == 201


def test_upload_too_large_rejected(client, admin_token, monkeypatch):
    monkeypatch.setattr(photos_module, "PHOTO_MAX_SIZE_MB", 0)
    assert _upload(client, admin_token).status_code == 400


def test_unprocessable_image_removes_row(client, admin_token, session, monkeypatch):
    def boom(photo_id, content):
        raise ValueError("kapot")
    monkeypatch.setattr(photos_module, "_save_photo_variants", boom)
    assert _upload(client, admin_token, match_ref="m1").status_code == 400
    assert session.exec(select(YearOfPhoto)).all() == []


def test_team_link_upload_is_attributed(client, session):
    session.add(YearOfTeamLink(id="team01", expires_at=datetime.utcnow() + timedelta(days=5)))
    session.commit()
    res = client.post(f"{API}/photos", data={"code": " TEAM01 ", "match_ref": "m1"},
                      files={"file": ("a.jpg", b"fake", "image/jpeg")})
    assert res.status_code == 201
    session.expire_all()
    assert session.get(YearOfPhoto, res.json()["id"]).uploader_code == "team01"


# --- publieke lijst en moderatie -----------------------------------------------

def test_public_list_only_published_newest_first(client, admin_token, session):
    old = _photo(session, created_at=datetime.utcnow() - timedelta(hours=1))
    new = _photo(session)
    _photo(session, status="concept")
    _photo(session, match_ref="m2")
    ids = [p["id"] for p in client.get(f"{API}/photos?match_ref=m1", headers=_auth(admin_token)).json()]
    assert ids == [new.id, old.id]


def test_public_list_filters_report_and_player(client, admin_token, session):
    player = YearOfPlayer(name="Anna")
    session.add(player)
    session.commit()
    in_report = _photo(session, report_id="r1")
    tagged = _photo(session)
    client.post(f"{API}/photos/{tagged.id}/tags/{player.id}", headers=_auth(admin_token))
    by_report = client.get(f"{API}/photos?report_id=r1", headers=_auth(admin_token)).json()
    by_player = client.get(f"{API}/photos?player_id={player.id}", headers=_auth(admin_token)).json()
    assert [p["id"] for p in by_report] == [in_report.id]
    assert [p["id"] for p in by_player] == [tagged.id]


def test_match_link_sees_only_highlights(client, session):
    session.add(YearOfShortLink(id="wedst1", link_type="match", match_ref="m1",
                                expires_at=datetime.utcnow() + timedelta(days=5)))
    session.commit()
    star = _photo(session, match_highlight=True)
    _photo(session)
    ids = [p["id"] for p in client.get(f"{API}/photos?match_ref=m1&code=wedst1").json()]
    assert ids == [star.id]
    assert client.get(f"{API}/photos?match_ref=m2&code=wedst1").status_code == 403


def test_moderation_includes_concepts_and_tags(client, admin_token, session):
    player = YearOfPlayer(name="Anna")
    session.add(player)
    session.commit()
    concept = _photo(session, status="concept", uploader_code="team01")
    client.post(f"{API}/photos/{concept.id}/tags/{player.id}", headers=_auth(admin_token))
    rows = client.get(f"{API}/photos/moderation", headers=_auth(admin_token)).json()
    assert rows[0]["player_ids"] == [player.id]
    assert rows[0]["uploader_code"] == "team01"  # beheer ziet de attributie wel
    assert client.get(f"{API}/photos/moderation").status_code == 401


# --- bijwerken, likes, tags ------------------------------------------------------

def test_update_publishes_once(client, admin_token, session):
    photo = _photo(session, status="concept")
    first = client.patch(f"{API}/photos/{photo.id}", json={"status": "published", "caption": "Mooi"},
                         headers=_auth(admin_token)).json()
    assert first["caption"] == "Mooi"
    assert first["published_at"] is not None
    again = client.patch(f"{API}/photos/{photo.id}", json={"status": "concept"}, headers=_auth(admin_token)).json()
    assert again["published_at"] == first["published_at"]  # huidig gedrag: blijft staan na terugzetten


def test_like_and_unlike_never_below_zero(client, admin_token, session):
    photo = _photo(session)
    url = f"{API}/photos/{photo.id}/like"
    assert client.post(url, headers=_auth(admin_token)).json() == {"like_count": 1}
    assert client.delete(url, headers=_auth(admin_token)).json() == {"like_count": 0}
    assert client.delete(url, headers=_auth(admin_token)).json() == {"like_count": 0}
    assert client.post(url).status_code == 403  # zonder code of login


def test_tag_is_idempotent_and_untag_always_ok(client, admin_token, session):
    player = YearOfPlayer(name="Anna")
    session.add(player)
    session.commit()
    photo = _photo(session)
    url = f"{API}/photos/{photo.id}/tags/{player.id}"
    first = client.post(url, headers=_auth(admin_token)).json()
    assert client.post(url, headers=_auth(admin_token)).json()["id"] == first["id"]
    assert len(client.get(f"{API}/photos/{photo.id}/tags", headers=_auth(admin_token)).json()) == 1
    assert client.delete(url, headers=_auth(admin_token)).json() == {"ok": True}
    assert client.delete(url, headers=_auth(admin_token)).json() == {"ok": True}
    assert client.post(f"{API}/photos/{photo.id}/tags/onbekend", headers=_auth(admin_token)).status_code == 404
