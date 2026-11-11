"""Unit tests for the risk engine maths. Synthetic data only: nothing here touches db/."""

import json
import math
import os
import random
import sys
from datetime import date, timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402
import portfolio_risk as pr  # noqa: E402


def test_week_start_is_sunday():
    # 2026-11-01 is a Sunday; the Thursday of that NEPSE week and the Sunday share a key.
    assert pr.week_start(date(2026, 11, 1)) == date(2026, 11, 1)
    assert pr.week_start(date(2026, 11, 5)) == date(2026, 11, 1)
    assert pr.week_start(date(2026, 11, 7)) == date(2026, 11, 1)
    assert pr.week_start(date(2026, 11, 8)) == date(2026, 11, 8)


def test_max_drawdown():
    assert pr.max_drawdown([100, 120, 90, 110]) == pytest.approx(0.25)
    assert pr.max_drawdown([100, 101, 102]) == 0.0


def test_xirr_simple_and_multiple_flows():
    assert pr.xirr([(date(2025, 1, 1), -1000), (date(2026, 1, 1), 1100)]) == pytest.approx(0.10, abs=1e-3)
    # Two deposits a year apart, both growing 10% a year.
    end = 1000 * 1.1 ** 2 + 1000 * 1.1
    r = pr.xirr([(date(2024, 1, 1), -1000), (date(2025, 1, 1), -1000), (date(2026, 1, 1), end)])
    assert r == pytest.approx(0.10, abs=2e-3)
    assert pr.xirr([(date(2025, 1, 1), -1000)]) is None
    assert pr.xirr([(date(2025, 1, 1), 1000), (date(2026, 1, 1), 1100)]) is None


def test_risk_decomposition_two_assets():
    # Uncorrelated, equal weights, vols 10% and 30%: variance shares 10% and 90%.
    vol, shares = pr.risk_decomposition([0.5, 0.5], [0.1, 0.3], [[1, 0], [0, 1]])
    assert vol == pytest.approx(math.sqrt(0.25 * 0.01 + 0.25 * 0.09))
    assert shares == pytest.approx([0.1, 0.9])
    assert sum(shares) == pytest.approx(1.0)
    # Perfectly correlated: portfolio vol is the weighted average, no diversification.
    vol, _ = pr.risk_decomposition([0.5, 0.5], [0.1, 0.3], [[1, 1], [1, 1]])
    assert vol == pytest.approx(0.2)


def test_aligned_returns_fills_gaps_and_drops_bad_jumps():
    cal = [date(2026, 1, 4) + timedelta(weeks=i) for i in range(5)]
    weekly = {cal[1]: 100.0, cal[2]: 110.0, cal[4]: 400.0}
    rets = pr.aligned_returns(weekly, cal)
    assert rets[0] is None and rets[1] is None       # no price yet / first price
    assert rets[2] == pytest.approx(0.10)
    assert rets[3] == 0.0                            # no trade: carried forward
    assert rets[4] is None                           # +264% in a week is a data fault


def test_correlation_needs_enough_overlap():
    a = [0.01 * ((i % 5) - 2) for i in range(60)]
    assert pr.correlation(a, a) == pytest.approx(1.0)
    assert pr.correlation(a[:10], a[:10]) is None


def test_reconstruct_flows_uses_bills_then_falls_back():
    holdings = [
        {"symbol": "AAA", "quantity": 30, "avgCost": 100.0, "dateAdded": "2025-06-01"},
        {"symbol": "BBB", "quantity": 10, "avgCost": 50.0, "dateAdded": "2025-07-01"},
    ]
    tx = [
        {"type": "BUY", "symbol": "AAA", "quantity": 20, "price": 90, "date": "2025-01-10"},
        {"type": "BUY", "symbol": "CCC", "quantity": 5, "price": 200, "date": "2025-02-01"},
        {"type": "SELL", "symbol": "CCC", "quantity": 5, "price": 260, "date": "2025-03-01"},
    ]
    flows, share = pr.reconstruct_flows(holdings, tx)
    assert (date(2025, 1, 10), -1800.0) in flows          # billed purchase
    assert (date(2025, 6, 1), -1000.0) in flows           # 10 unexplained shares at average cost
    assert (date(2025, 7, 1), -500.0) in flows            # no bills at all
    assert (date(2025, 3, 1), 1300.0) in flows            # closed position still counts
    assert share == pytest.approx(1800 / 3500)


def test_normalize_sector_orders_non_life_before_life():
    assert pc.normalize_sector("Non-Life Insurance") == "Non-Life Insurance"
    assert pc.normalize_sector("Life Insurance") == "Life Insurance"
    assert pc.normalize_sector("Hotels & Tourism") == "Hotels"
    assert pc.normalize_sector("unknown") == "Others"
    assert pc.normalize_sector(None) == "Others"


def _write_prices(directory, symbol, closes, last_day):
    rows = []
    day = last_day - timedelta(weeks=len(closes) - 1)
    for c in closes:
        rows.append([day.isoformat(), c, c, c, c, 1000.0])
        day += timedelta(weeks=1)
    with open(os.path.join(directory, f"{symbol}.json"), "w", encoding="utf-8") as f:
        json.dump({"symbol": symbol, "adjusted": {"rows": rows}, "raw": {"rows": rows}}, f)


def test_analyze_end_to_end_on_synthetic_market(tmp_path, monkeypatch):
    """A calm stock and a wild stock at equal weight: the wild one must carry most of the risk."""
    rng = random.Random(7)
    prices_dir = str(tmp_path)
    monkeypatch.setattr(pc, "PRICES_DIR", prices_dir)
    monkeypatch.setattr(pc, "QUARTERLY_DIR", str(tmp_path / "none"))
    last = date(2026, 11, 5)
    weeks = 130

    def path(sigma):
        level, out = 100.0, []
        for _ in range(weeks):
            level *= 1.0 + rng.gauss(0.001, sigma)
            out.append(round(level, 2))
        return out

    for i in range(25):  # background market so the index has enough members
        _write_prices(prices_dir, f"M{i:02d}", path(0.02), last)
    calm, wild = path(0.01), path(0.05)
    _write_prices(prices_dir, "CALM", calm, last)
    _write_prices(prices_dir, "WILD", wild, last)

    portfolio = {
        "holdings": [
            {"symbol": "CALM", "quantity": 1000 / calm[-1], "avgCost": 100.0, "dateAdded": "2025-01-05"},
            {"symbol": "WILD", "quantity": 1000 / wild[-1], "avgCost": 100.0, "dateAdded": "2025-01-05"},
            {"symbol": "NEWIPO", "quantity": 1, "avgCost": 100.0, "dateAdded": "2026-10-01"},
        ],
        "transactions": [],
    }
    report = pr.analyze(portfolio, {}, prices_dir=prices_dir, today=last)
    assert "error" not in report
    by = {h["symbol"]: h for h in report["holdings"]}
    assert by["WILD"]["riskShare"] > 0.8 > by["CALM"]["riskShare"]
    assert by["WILD"]["volatility"] == pytest.approx(0.05 * math.sqrt(52), rel=0.25)
    assert sum(h["riskShare"] for h in report["holdings"]) == pytest.approx(1.0, abs=0.01)
    assert sum(h["weight"] for h in report["holdings"]) == pytest.approx(1.0, abs=0.01)
    assert by["NEWIPO"]["measured"] is False            # no history: estimated, and said so
    assert {p["symbol"] for p in report["coverage"]["proxied"]} == {"NEWIPO"}
    assert any(f["code"] == "risk_heavy" and "WILD" in f["symbols"] for f in report["findings"])
    assert 0 <= report["portfolio"]["maxDrawdown"] < 1
    assert len(report["history"]) == report["lookbackWeeks"] + 1
    n = len(report["correlation"]["symbols"])
    assert all(len(row) == n for row in report["correlation"]["matrix"])


def test_analyze_handles_empty_portfolio():
    assert "error" in pr.analyze({"holdings": []}, {})
