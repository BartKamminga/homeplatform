from datetime import datetime, timedelta

from models.hockey_discovery import DataShapeFlag, HockeyCompetition, HockeyPoule
from routers.hockey_vanger_data_shape import list_data_shape_flags


def _setup_flag(session, poule_id, competition_name, missing_field="district", days_ago=0):
    comp = HockeyCompetition(
        external_id=f"{competition_name}|Topklasse|Zuid-Holland|2026-2027",
        name=competition_name, class_name="Topklasse", district="Zuid-Holland",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    poule = HockeyPoule(poule_id=poule_id, name="Poule B", competition_id=comp.id, season="2026-2027")
    session.add(poule)

    created_at = datetime.utcnow() - timedelta(days=days_ago)
    session.add(DataShapeFlag(
        poule_id=poule_id, competition_id=comp.id, missing_field=missing_field,
        detail="HelloFresh " + competition_name, created_at=created_at,
    ))
    session.commit()
    return comp, poule


def test_list_data_shape_flags_returns_recent_rows_with_labels(session):
    _setup_flag(session, poule_id=701, competition_name="Meisjes O14 Herfst")

    result = list_data_shape_flags(days=14, limit=100, session=session, _=None)

    assert result["total"] == 1
    row = result["rows"][0]
    assert row["poule_id"] == 701
    assert row["poule_name"] == "Poule B"
    assert row["competition_name"] == "Meisjes O14 Herfst"
    assert row["missing_field"] == "district"
    assert row["detail"] == "HelloFresh Meisjes O14 Herfst"


def test_list_data_shape_flags_excludes_flags_outside_the_window(session):
    _setup_flag(session, poule_id=702, competition_name="Jongens O16 Herfst", days_ago=30)

    result = list_data_shape_flags(days=14, limit=100, session=session, _=None)

    assert result["total"] == 0
    assert result["rows"] == []
