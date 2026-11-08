"""Tests for tools/backtest_sector_leaders.py: look-ahead guards and return mechanics."""
import os
import sys
from datetime import date

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.backtest_sector_leaders import (Prices, build_record, check_frozen, rebalance_dates,
                                           spearman)
from tools.report_availability import quarter_end

CAL = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
       "2026-12-14", "2026-12-15", "2026-12-16", "2026-12-17"]


def make_prices():
    series = {
        "AAA": {"dates": CAL, "adj": [100, 100, 100, 100, 100, 100, 110, 120, 130],
                "turn": {d: 200_000.0 for d in CAL}},
        # BBB trades only on 3 of the last 20 sessions and stops after 2026-12-15
        "BBB": {"dates": ["2026-11-01", "2026-12-14", "2026-12-15"], "adj": [50, 50, 40],
                "turn": {"2026-11-01": 1e6, "2026-12-14": 1e6, "2026-12-15": 1e6}},
    }
    return Prices(series, CAL)


def quarter(fy, q, eps):
    return {"fy": fy, "quarter": q, "_qe": quarter_end(fy, q),
            "computed": {"eps_ttm": eps, "bvps": 200.0, "roe_ttm": 15.0, "net_profit_ttm": 10.0,
                         "revenue_ttm": 100.0},
            "raw": {"Total Assets": 1000.0, "Total Equity": 100.0, "Borrowings": 50.0},
            "yoy": {}}


DOC = {"name": "Test Hydro Ltd", "sector": "Hydropower",
       "quarters": [quarter("2082-83", 4, 10.0), quarter("2083-84", 1, 20.0)]}


def test_report_not_used_before_lag():
    # Q1 2083/84 ended 2026-10-17; with a 60-day lag it is public from 2026-12-16.
    before = build_record("AAA", DOC, date(2026, 12, 15), 60, make_prices(), {})
    after = build_record("AAA", DOC, date(2026, 12, 16), 60, make_prices(), {})
    assert before["period"] == "2082-83-Q4" and before["eps_ttm"] == 10.0
    assert after["period"] == "2083-84-Q1" and after["eps_ttm"] == 20.0


def test_no_record_when_nothing_public():
    doc = {"name": "X", "sector": "Hydropower", "quarters": [quarter("2083-84", 1, 20.0)]}
    assert build_record("AAA", doc, date(2026, 11, 5), 60, make_prices(), {}) is None


def test_valuation_uses_signal_day_price():
    rec = build_record("AAA", DOC, date(2026, 12, 16), 60, make_prices(), {})
    assert rec["ltp"] == 120 and rec["pe"] == pytest.approx(120 / 20.0)
    assert rec["pb"] == pytest.approx(120 / 200.0)


def test_derived_roa_and_margin_annualise_ytd():
    rec = build_record("AAA", DOC, date(2026, 12, 16), 60, make_prices(), {})
    assert rec["roa"] == pytest.approx(10.0 * 4 / 1 / 1000.0 * 100)   # Q1 YTD x 4
    assert rec["net_margin"] == pytest.approx(10.0)


def test_future_dividends_ignored():
    divs = {"AAA": [{"announcementDateAD": "2026-11-02", "totalPercent": 10, "cashPercent": 5},
                    {"announcementDateAD": "2026-12-17", "totalPercent": 99, "cashPercent": 99}]}
    rec = build_record("AAA", DOC, date(2026, 12, 16), 60, make_prices(), divs)
    assert rec["bonus_avg5"] == 10 and rec["div_yield"] == pytest.approx(5 / 120)


def test_stale_and_turnover():
    rec = build_record("BBB", DOC, date(2026, 12, 17), 60, make_prices(), {})
    assert rec["days_since_trade"] == 2 and rec["price_is_stale"] is False
    # 9 sessions in window, BBB traded on 3 -> median of [1e6 x3, 0 x6] = 0
    assert rec["turnover"] == 0


def test_period_return_and_stopped_stock():
    p = make_prices()
    assert p.period_return("AAA", "2026-12-15", "2026-12-17") == pytest.approx(130 / 110 - 1)
    # BBB stops trading after 2026-12-15: valued at its last close
    assert p.period_return("BBB", "2026-12-14", "2026-12-17") == pytest.approx(40 / 50 - 1)


def test_sessions():
    p = make_prices()
    assert p.session_on_or_before("2026-12-10") == "2026-11-05"
    assert p.session_after("2026-11-05") == "2026-12-14"


def test_spearman():
    assert spearman([1, 2, 3, 4], [10, 20, 30, 40]) == pytest.approx(1.0)
    assert spearman([1, 2, 3, 4], [4, 3, 2, 1]) == pytest.approx(-1.0)
    assert spearman([1, 2], [1, 2]) is None


def test_rebalance_calendar():
    d = rebalance_dates()
    assert len(d) == 16 and d == sorted(d)
    assert d[0] == date(2022, 12, 16)


def test_frozen_algorithm_unchanged():
    check_frozen()
