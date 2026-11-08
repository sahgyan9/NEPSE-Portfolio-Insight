"""Tests for tools/report_availability.py (no network, no db writes)."""
import os
import sys
from datetime import date

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.report_availability import available_on, fy_start_year, quarter_end


def test_fy_start_year():
    assert fy_start_year("2083-84") == 2083
    assert fy_start_year("2099-00") == 2099  # century wrap in the short form


@pytest.mark.parametrize("bad", ["2083/84", "083-084", "2083-85", "", None])
def test_fy_start_year_rejects_bad(bad):
    with pytest.raises(ValueError):
        fy_start_year(bad)


def test_quarter_ends_fy_2083_84():
    # Ashwin, Poush, Chaitra end in BS 2083; Ashadh ends in BS 2084.
    assert quarter_end("2083-84", 1) == date(2026, 10, 17)
    assert quarter_end("2083-84", 2) == date(2027, 1, 14)
    assert quarter_end("2083-84", 3) == date(2027, 4, 13)
    assert quarter_end("2083-84", 4) == date(2027, 7, 16)


def test_quarters_are_ordered_and_about_three_months_apart():
    ends = [quarter_end("2079-80", q) for q in (1, 2, 3, 4)]
    gaps = [(b - a).days for a, b in zip(ends, ends[1:])]
    assert all(85 <= g <= 95 for g in gaps)
    # next fiscal year's Q1 follows this year's Q4
    assert 85 <= (quarter_end("2080-81", 1) - ends[-1]).days <= 95


def test_q4_falls_in_july_every_year():
    for y in range(2068, 2084):
        assert quarter_end(f"{y}-{(y + 1) % 100:02d}", 4).month == 7


def test_bad_quarter():
    with pytest.raises(ValueError):
        quarter_end("2083-84", 5)


def test_available_on_is_not_before_real_publication():
    # NABIL published Q1 2083/84 on 2026-11-01 (ShareSansar). The rule must not be earlier.
    assert available_on("2083-84", 1, 60) == date(2026, 12, 16)
    assert available_on("2083-84", 1, 60) >= date(2026, 11, 1)
