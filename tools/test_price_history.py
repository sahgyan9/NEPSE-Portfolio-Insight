"""Offline tests for tools/fetch_price_history.py (no network)."""
import os
import sys

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.fetch_price_history import compare_closes, parse_tv, validate

# 2024-01-01 05:45 UTC == 11:30 NPT (NEPSE opens 11:00 NPT)
D1 = 1704087900
DAY = 86400


def test_parse_tv_converts_and_sorts():
    payload = {"s": "ok", "t": [D1 + DAY, D1], "o": [11, 10], "h": [12, 11],
               "l": [10, 9], "c": [11.5, 10.5], "v": [200, 100]}
    rows = parse_tv(payload)
    assert rows == [
        ["2024-01-01", 10.0, 11.0, 9.0, 10.5, 100.0],
        ["2024-01-02", 11.0, 12.0, 10.0, 11.5, 200.0],
    ]


def test_parse_tv_post_2018_stamp_keeps_trading_date():
    # Provider stamps post-2018 bars at 20:45 UTC (02:30 NPT next day).
    # Sunday 2023-12-31 20:45 UTC must stay Sunday 2023-12-31, not become Monday.
    ts = 1704055500
    rows = parse_tv({"t": [ts], "o": [1], "h": [1], "l": [1], "c": [1], "v": [1]})
    assert rows[0][0] == "2023-12-31"


def test_parse_tv_no_data_and_empty():
    assert parse_tv({"s": "no_data"}) == []
    assert parse_tv({"s": "ok", "t": []}) == []
    assert parse_tv(None) == []


def test_parse_tv_duplicate_date_keeps_last():
    payload = {"t": [D1, D1 + 60], "o": [1, 2], "h": [1, 2], "l": [1, 2], "c": [1, 2], "v": [1, 2]}
    rows = parse_tv(payload)
    assert len(rows) == 1 and rows[0][4] == 2.0


def test_parse_tv_rejects_ragged_columns():
    with pytest.raises(ValueError):
        parse_tv({"t": [D1, D1 + DAY], "o": [1], "h": [1, 1], "l": [1, 1], "c": [1, 1]})


def test_validate_clean_series():
    rows = [["2024-01-01", 10, 11, 9, 10.5, 100], ["2024-01-02", 10, 12, 10, 11, 50]]
    assert validate(rows) == []


def test_validate_flags_bad_bars():
    rows = [
        ["2024-01-02", 10, 11, 9, 10, 1],
        ["2024-01-01", 10, 11, 9, 10, 1],   # out of order
        ["2024-01-03", 10, 9, 11, 10, 1],   # high < low
        ["2024-01-04", 10, 11, 9, 12, 1],   # close above high
        ["2024-01-05", 10, 11, 9, 0, 1],    # zero close
    ]
    issues = validate(rows)
    assert len(issues) == 4
    assert any("not strictly after" in i for i in issues)
    assert any("high 9 < low 11" in i for i in issues)
    assert any("outside" in i for i in issues)
    assert any("non-positive" in i for i in issues)


def test_compare_closes():
    a = [["2024-01-01", 0, 0, 0, 100, 0], ["2024-01-02", 0, 0, 0, 102, 0], ["2024-01-03", 0, 0, 0, 50, 0]]
    b = [["2024-01-01", 0, 0, 0, 100, 0], ["2024-01-02", 0, 0, 0, 100, 0]]
    r = compare_closes(a, b)
    assert r["common_days"] == 2
    assert r["only_in_primary"] == 1
    assert r["only_in_secondary"] == 0
    assert r["median_abs_diff_pct"] == 1.0
    assert r["days_over_1pct"] == 1


def test_compare_closes_no_overlap():
    assert compare_closes([], [["2024-01-01", 0, 0, 0, 1, 0]]) == {"common_days": 0}
