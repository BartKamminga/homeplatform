"""Tests voor de kleine, pure AppSetting-helpers in services/hockey_vanger_settings.py
(item 1019: _get_bool_setting en het zaal-seizoensvenster)."""

from datetime import datetime

from models.settings import AppSetting
from services.hockey_vanger_settings import _get_bool_setting, is_in_zaal_window


def test_get_bool_setting_defaults_when_no_row_exists(session):
    assert _get_bool_setting(session, "some_toggle", True) is True
    assert _get_bool_setting(session, "some_toggle", False) is False


def test_get_bool_setting_reads_explicit_value(session):
    session.add(AppSetting(key="some_toggle", value="0"))
    session.commit()
    assert _get_bool_setting(session, "some_toggle", True) is False

    session.add(AppSetting(key="other_toggle", value="1"))
    session.commit()
    assert _get_bool_setting(session, "other_toggle", False) is True


def test_is_in_zaal_window_within_a_normal_range():
    # venster 15/11 t/m 15/3 - geen jaarwisseling in dit deelbereik
    assert is_in_zaal_window(datetime(2026, 12, 1), 15, 11, 15, 3) is True
    assert is_in_zaal_window(datetime(2026, 11, 20), 15, 11, 15, 3) is True


def test_is_in_zaal_window_handles_the_year_boundary():
    # venster loopt van november naar maart, dus over de jaargrens heen
    assert is_in_zaal_window(datetime(2027, 1, 15), 15, 11, 15, 3) is True
    assert is_in_zaal_window(datetime(2027, 3, 10), 15, 11, 15, 3) is True


def test_is_in_zaal_window_outside_the_range():
    assert is_in_zaal_window(datetime(2026, 6, 1), 15, 11, 15, 3) is False
    assert is_in_zaal_window(datetime(2026, 11, 10), 15, 11, 15, 3) is False  # net vóór start
    assert is_in_zaal_window(datetime(2027, 3, 20), 15, 11, 15, 3) is False  # net na einde


def test_is_in_zaal_window_boundary_days_are_inclusive():
    assert is_in_zaal_window(datetime(2026, 11, 15), 15, 11, 15, 3) is True
    assert is_in_zaal_window(datetime(2027, 3, 15), 15, 11, 15, 3) is True
