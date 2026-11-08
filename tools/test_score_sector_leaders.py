"""Tests for tools/score_sector_leaders.py: prior-year comparable used by the checklist."""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.score_sector_leaders import prior_fy, prior_year_quarter


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
