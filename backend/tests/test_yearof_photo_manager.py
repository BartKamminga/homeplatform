"""Item 1213: beheerlijst en bulk-acties voor het fotobeheer."""

from models.yearof import (
    YearOfContributorLink,
    YearOfPhoto,
    YearOfPhotoPlayerTag,
    YearOfPlayer,
    YearOfReport,
    YearOfTeamLink,
)
from datetime import datetime, timedelta

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _setup(session):
    player = YearOfPlayer(name="Jip")
    team = YearOfTeamLink(id="team01")
    invul = YearOfContributorLink(id="invul1", match_ref="m1", player_id=None, report_type="interview",
                                  expires_at=datetime.utcnow() + timedelta(days=5))
    report = YearOfReport(match_ref="m1", report_type="interview", title="Mijn wedstrijd", body="x")
    session.add_all([player, team, invul, report])
    session.commit()
    loose = YearOfPhoto(match_ref="m1", status="concept", uploader_code="team01")
    in_report = YearOfPhoto(match_ref="m1", report_id=report.id, status="concept", uploader_code="invul1")
    admin = YearOfPhoto(match_ref="m2", status="published")
    session.add_all([loose, in_report, admin])
    session.commit()
    session.add(YearOfPhotoPlayerTag(photo_id=admin.id, player_id=player.id, favorite=True))
    session.commit()
    return player, report, loose, in_report, admin


def test_manager_list_has_source_tags_and_no_codes(client, admin_token, session):
    player, report, loose, in_report, admin = _setup(session)
    rows = {r["id"]: r for r in client.get(f"{API}/photos/manager", headers=_auth(admin_token)).json()}

    assert rows[loose.id]["source"]["kind"] == "sitelink"
    assert rows[in_report.id]["source"]["kind"] == "invullink"
    assert rows[in_report.id]["report"]["title"] == "Mijn wedstrijd"
    assert rows[admin.id]["source"]["kind"] == "beheer"
    assert rows[admin.id]["player_ids"] == [player.id] and rows[admin.id]["favorite_player_ids"] == [player.id]
    assert all("uploader_code" not in r for r in rows.values())
    assert client.get(f"{API}/photos/manager").status_code == 401


def test_bulk_actions(client, admin_token, session):
    player, report, loose, in_report, admin = _setup(session)
    ids = [loose.id, in_report.id, admin.id]

    def bulk(action, value=None, which=ids):
        res = client.post(f"{API}/photos/bulk", json={"ids": which, "action": action, "value": value}, headers=_auth(admin_token))
        assert res.status_code == 200, res.text
        return res.json()

    assert bulk("publish") == {"updated": 3, "skipped": 0}
    bulk("concept", which=[admin.id])
    bulk("type", "team")
    assert bulk("move", "m3") == {"updated": 2, "skipped": 1}  # foto bij verslag blijft staan
    bulk("tag", player.id)
    bulk("highlight_on")

    session.expire_all()
    rows = {r["id"]: r for r in client.get(f"{API}/photos/manager", headers=_auth(admin_token)).json()}
    assert rows[loose.id]["status"] == "published" and rows[admin.id]["status"] == "concept"
    assert {r["photo_type"] for r in rows.values()} == {"team"}
    assert rows[loose.id]["match_ref"] == "m3" and rows[in_report.id]["match_ref"] == "m1"
    assert all(player.id in r["player_ids"] for r in rows.values())
    assert all(r["match_highlight"] for r in rows.values())

    bulk("untag", player.id, which=[loose.id])
    assert bulk("delete", which=[loose.id]) == {"updated": 1, "skipped": 0}
    rows = client.get(f"{API}/photos/manager", headers=_auth(admin_token)).json()
    assert loose.id not in {r["id"] for r in rows}

    res = client.post(f"{API}/photos/bulk", json={"ids": ids, "action": "type", "value": "onzin"}, headers=_auth(admin_token))
    assert res.status_code == 400
    assert client.post(f"{API}/photos/bulk", json={"ids": ids, "action": "publish"}).status_code == 401
