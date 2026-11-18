"""
Live Sector Leaders export for the app (Intelligence / Sector Picks).

What it builds: db/quarterly_top_performers.json, the same file and format as
tools/score_sector_leaders.py --export, with one extra rule applied before scoring:
a company whose latest quarterly report is more than MAX_QUARTERS_BEHIND quarters
older than the newest report in the universe is dropped.

Why: the frozen scorer has no report-age gate, and its price and turnover gates pass
when those fields are missing. Companies that merged or delisted years ago (AIL, SIL,
NCCB, JLI, RHPC, ...) still have a 2079-80 report and no price in the snapshot archive,
so they were ranked on three-year-old numbers. The backtest and forward test are not
affected: they build records from a real last trade at the signal date.

Kept outside tools/score_sector_leaders.py on purpose: that file is frozen by hash for
the research paper (see FROZEN in tools/backtest_sector_leaders.py).

Inputs:  same as score_sector_leaders.load_universe() (db/fundamentals_archive, db/quarterly, ...)
Output:  db/quarterly_top_performers.json (adds "staleReportCount" and "staleReports")
Run:     .venv/Scripts/python.exe tools/live_sector_leaders.py [--top 3] [--show-stale]
"""

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import score_sector_leaders as SL  # noqa: E402

# Q4 (annual) reports come out late, so one or two quarters behind is normal.
MAX_QUARTERS_BEHIND = 2

_PERIOD = re.compile(r"^(\d{4})-\d{2}-Q([1-4])$")


def period_index(period):
    """'2083-84-Q1' -> 2083*4 + 0. None when the period string is not recognised."""
    m = _PERIOD.match(str(period or ""))
    return int(m.group(1)) * 4 + int(m.group(2)) - 1 if m else None


def split_stale(recs, max_behind=MAX_QUARTERS_BEHIND):
    """(kept, stale). stale maps symbol -> its latest period. A record with an
    unreadable period is kept (the frozen gates still apply to it)."""
    idx = {s: period_index(r.get("period")) for s, r in recs.items()}
    known = [i for i in idx.values() if i is not None]
    if not known:
        return dict(recs), {}
    newest = max(known)
    kept, stale = {}, {}
    for s, r in recs.items():
        if idx[s] is not None and newest - idx[s] > max_behind:
            stale[s] = r.get("period")
        else:
            kept[s] = r
    return kept, stale


def export(output_path=None, top_n=3, max_behind=MAX_QUARTERS_BEHIND):
    if output_path is None:
        output_path = os.path.join(SL.DB, "quarterly_top_performers.json")
    kept, stale = split_stale(SL.load_universe(), max_behind)

    # Reuse the frozen export (format and scoring unchanged) on the filtered universe.
    original = SL.load_universe
    SL.load_universe = lambda: kept
    try:
        payload = SL.export_top_performers(output_path=output_path, top_n=top_n)
    finally:
        SL.load_universe = original

    payload["staleReportCount"] = len(stale)
    payload["staleReports"] = dict(sorted(stale.items()))
    payload["maxQuartersBehind"] = max_behind
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"[live_sector_leaders] dropped {len(stale)} companies with reports more than "
          f"{max_behind} quarters old")
    return payload, stale


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=3)
    ap.add_argument("--show-stale", action="store_true")
    args = ap.parse_args()
    _, stale = export(top_n=args.top)
    if args.show_stale:
        for s, p in sorted(stale.items()):
            print(f"  {s}: latest report {p}")


if __name__ == "__main__":
    main()
