"""VBT-workouts: seed van het FTP Builder-plan, planvorm, .zwo-import en eigendom."""
from services import vbt_workouts as svc


def _h(token):
    return {"Authorization": f"Bearer {token}"}


ZWO = b"""<workout_file>
  <author>Test</author>
  <name>Sweet Spot Test</name>
  <description>2x10</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="600" PowerLow="0.40" PowerHigh="0.75" Cadence="85"/>
    <IntervalsT Repeat="2" OnDuration="600" OffDuration="300" OnPower="0.90" OffPower="0.55" Cadence="90" CadenceResting="85"/>
    <SteadyState Duration="120" Power="0.65"><textevent timeoffset="0" message="Easy"/></SteadyState>
    <FreeRide Duration="300"/>
    <Cooldown Duration="300" PowerLow="0.60" PowerHigh="0.40"/>
  </workout>
</workout_file>"""


def test_seed_plan_shape_and_idempotent(client, session, user_token):
    svc.seed_plan(session, "ftp_builder.json")
    svc.seed_plan(session, "ftp_builder.json")   # nog een keer: geen dubbele workouts

    plans = client.get("/api/vbt/plans", headers=_h(user_token)).json()
    assert [p["slug"] for p in plans] == ["ftp-builder"]

    plan = client.get("/api/vbt/plans/ftp-builder", headers=_h(user_token)).json()
    assert len(plan["weeks"]) == 6
    assert plan["dayOffsets"] == [0, 1, 3, 5, 6]
    days = [d for w in plan["weeks"] for d in w]
    assert len(days) == 30
    first = plan["weeks"][0][0]
    assert first["id"] == "ftpb-w1d1" and first["name"] == "Foundation" and first["duration"] == 48 * 60
    assert plan["weeks"][0][4]["rest"] is True
    assert plan["weeks"][5][4]["free"] is True and plan["weeks"][5][4]["duration"] == 2700

    workouts = client.get("/api/vbt/workouts", headers=_h(user_token)).json()
    assert len(workouts) == 22   # dubbele dagen (bv. w3d1 = w3d3) delen één workout


def test_seed_build_me_up_and_choose_plan(client, session, user_token):
    svc.seed_plan(session, "ftp_builder.json")
    svc.seed_plan(session, "build_me_up.json")
    svc.seed_plan(session, "build_me_up.json")   # idempotent

    plans = client.get("/api/vbt/plans", headers=_h(user_token)).json()
    assert [p["slug"] for p in plans] == ["build-me-up", "ftp-builder"]

    plan = client.get("/api/vbt/plans/build-me-up", headers=_h(user_token)).json()
    assert len(plan["weeks"]) == 13 and all(len(w) == 5 for w in plan["weeks"])
    days = [d for w in plan["weeks"] for d in w if not d["rest"]]
    assert len(days) == 52
    assert plan["weeks"][0][0]["name"] == "Ramp Test" and plan["weeks"][12][-2]["name"] == "FTP Test"
    assert plan["weeks"][1][1]["name"] == "Devedeset" and plan["weeks"][1][1]["duration"] == 3600

    r = client.put("/api/vbt/profile", headers=_h(user_token), json={"planSlug": "build-me-up"})
    assert r.status_code == 200 and r.json()["planSlug"] == "build-me-up"
    assert client.put("/api/vbt/profile", headers=_h(user_token), json={"planSlug": "nope"}).status_code == 422


def test_parse_zwo():
    wo = svc.parse_zwo(ZWO)
    assert wo["name"] == "Sweet Spot Test"
    steps = wo["steps"]
    assert steps[0] == {"d": 600, "a": 40.0, "b": 75.0, "c": 85}
    assert [s["a"] for s in steps[1:5]] == [90.0, 55.0, 90.0, 55.0]
    assert steps[2]["c"] == 85 and steps[1]["c"] == 90
    assert steps[6]["free"] is True
    assert svc.duration_of(steps) == 600 + 2 * 900 + 120 + 300 + 300


def test_import_zwo_dedup_and_rejects(client, user_token):
    bad = b"<!DOCTYPE x [<!ENTITY a 'b'>]><workout_file/>"
    run = b"<workout_file><name>Run</name><sportType>run</sportType><workout/></workout_file>"
    r = client.post("/api/vbt/workouts/import", headers=_h(user_token), files=[
        ("files", ("ss.zwo", ZWO, "application/xml")),
        ("files", ("ss-again.zwo", ZWO, "application/xml")),
        ("files", ("evil.zwo", bad, "application/xml")),
        ("files", ("run.zwo", run, "application/xml")),
    ]).json()
    assert [w["name"] for w in r["imported"]] == ["Sweet Spot Test"]
    assert r["imported"][0]["mine"] is True
    reasons = {s["file"]: s["reason"] for s in r["skipped"]}
    assert "al in je bibliotheek" in reasons["ss-again.zwo"]
    assert "DOCTYPE" in reasons["evil.zwo"]
    assert "run" in reasons["run.zwo"]


def test_imported_workouts_are_private(client, user_token, admin_token):
    wo = client.post("/api/vbt/workouts/import", headers=_h(user_token),
                     files=[("files", ("ss.zwo", ZWO, "application/xml"))]).json()["imported"][0]
    assert client.get(f"/api/vbt/workouts/{wo['id']}", headers=_h(admin_token)).status_code == 404
    assert all(w["id"] != wo["id"] for w in client.get("/api/vbt/workouts", headers=_h(admin_token)).json())
    assert client.delete(f"/api/vbt/workouts/{wo['id']}", headers=_h(admin_token)).status_code == 404
    assert client.delete(f"/api/vbt/workouts/{wo['id']}", headers=_h(user_token)).status_code == 200


def test_plan_workouts_cannot_be_deleted(client, session, user_token):
    svc.seed_plan(session, "ftp_builder.json")
    wo = client.get("/api/vbt/workouts", headers=_h(user_token)).json()[0]
    assert client.delete(f"/api/vbt/workouts/{wo['id']}", headers=_h(user_token)).status_code == 404
