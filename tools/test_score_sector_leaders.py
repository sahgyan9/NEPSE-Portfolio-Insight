"""Tests for tools/score_sector_leaders.py: prior-year comparable used by the checklist."""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from tools.score_sector_leaders import (build_metric_table, dividend_stats, prior_fy,
                                        prior_year_quarter, split_dividend)


def test_split_dividend_drops_tax_only_cash():
    assert split_dividend(21.0, 1.1053) == (21.0, 0.0)     # 1.1053 = 5% of 22.1053
    assert split_dividend(5.0, 10.8) == (5.0, 10.8)        # real cash alongside bonus
    assert split_dividend(0.0, 12.5) == (0.0, 12.5)        # cash only is never tax-only
    assert split_dividend(None, None) == (0.0, 0.0)


def test_dividend_stats_separates_cash_and_bonus():
    rows = [{"bonusPercent": 20, "cashPercent": 5, "totalPercent": 25},
            {"bonusPercent": 19, "cashPercent": 1, "totalPercent": 20},      # tax-only cash
            {"bonusPercent": 0, "cashPercent": 0, "totalPercent": 0}]
    s = dividend_stats(rows)
    assert s["bonus_avg5"] == pytest.approx(15.0)          # legacy total is unchanged
    assert s["bonus_years_frac"] == pytest.approx(2 / 5)
    assert s["stock_avg5"] == pytest.approx(13.0)
    assert s["cash_avg5"] == pytest.approx(5 / 3)


def test_dividend_stats_empty():
    assert all(v is None for v in dividend_stats([]).values())


def test_growth_metric_prefers_profit_growth():
    t = build_metric_table({
        "A": {"profit_growth": 10.0, "eps_growth": -15.0},   # bonus issue diluted EPS
        "B": {"profit_growth": None, "eps_growth": 8.0},     # falls back to EPS growth
        "C": {"profit_growth": 400.0, "eps_growth": 5.0},    # winsorised
    })
    assert t["A"]["earn_growth"] == 10.0
    assert t["B"]["earn_growth"] == 8.0
    assert t["C"]["earn_growth"] == 150


def q(fy, quarter):
    return {"fy": fy, "quarter": quarter}


def test_prior_fy():
    assert prior_fy("2083-84") == "2082-83"
    assert prior_fy("2069-70") == "2068-69"
    assert prior_fy("2100-01") == "2099-00"


def test_prior_fy_rejects_malformed():
    assert prior_fy(None) is None
    assert prior_fy("") is None
    assert prior_fy("2083/84") is None


def test_picks_immediately_preceding_year_not_oldest():
    # 28-quarter style file: several older Q1s exist; oldest-first order as in load_universe
    qs = [q(fy, n) for fy in ("2068-69", "2075-76", "2081-82", "2082-83", "2083-84")
          for n in (1, 2, 3, 4)]
    qs = [x for x in qs if not (x["fy"] == "2083-84" and x["quarter"] > 1)]
    last = qs[-1]
    assert last == q("2083-84", 1)
    assert prior_year_quarter(qs, last) == q("2082-83", 1)


def test_none_when_prior_year_quarter_missing():
    # prior year's Q2 is absent; must not fall back to an older Q2
    qs = [q("2068-69", 2), q("2080-81", 2), q("2082-83", 1), q("2082-83", 3),
          q("2083-84", 1), q("2083-84", 2)]
    assert prior_year_quarter(qs, qs[-1]) is None


def test_none_when_only_one_year():
    qs = [q("2083-84", 1), q("2083-84", 2)]
    assert prior_year_quarter(qs, qs[-1]) is None


def test_none_when_last_fy_malformed():
    qs = [q("2082-83", 1), {"fy": None, "quarter": 1}]
    assert prior_year_quarter(qs, qs[-1]) is None
