"""Tests for tools/live_sector_leaders.py: report-age filter applied before the frozen scorer."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from live_sector_leaders import period_index, split_stale  # noqa: E402


def test_period_index_orders_quarters():
    assert period_index("2083-84-Q1") - period_index("2082-83-Q4") == 1
    assert period_index("2083-84-Q1") - period_index("2079-80-Q3") == 14
    assert period_index(None) is None
    assert period_index("bad") is None


def test_split_stale_drops_old_reports_only():
    recs = {
        "NEW": {"period": "2083-84-Q1"},
        "Q4": {"period": "2082-83-Q4"},
        "Q3": {"period": "2082-83-Q3"},      # 2 behind: kept
        "Q2": {"period": "2082-83-Q2"},      # 3 behind: dropped
        "AIL": {"period": "2079-80-Q3"},
        "ODD": {"period": None},             # unreadable: kept
    }
    kept, stale = split_stale(recs)
    assert set(kept) == {"NEW", "Q4", "Q3", "ODD"}
    assert stale == {"Q2": "2082-83-Q2", "AIL": "2079-80-Q3"}
