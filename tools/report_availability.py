"""
Report Availability Dates (fixed-lag rule)
==========================================
For every quarterly report in db/quarterly, computes the date from which a backtest may use it.
This is the guard against look-ahead bias: a strategy must never act on results before the
market could have seen them.

Rule:
    available_on = quarter_end + LAG days       (primary LAG = 60; sensitivity 45 and 90)

Why a fixed lag and not real announcement dates:
- SEBON requires quarterly reports within ~30 days of quarter end, but compliance is poor
  (one reported quarter: 118 of 227 companies on time), so the legal deadline is not safe.
- ShareSansar company news only reaches back ~3 months; no historical announcement archive
  was found yet (checked 2026-11-07). A fixed conservative lag is standard in academic finance.
- Known limitation: a company that published LATER than the lag is treated as known too early.
  The 90-day sensitivity run bounds this.

Quarter ends (Nepali fiscal year starts 1 Shrawan; "2083-84" means BS 2083/84):
    Q1 = last day of Ashwin  (BS year 1)  ~ mid-October
    Q2 = last day of Poush   (BS year 1)  ~ mid-January
    Q3 = last day of Chaitra (BS year 1)  ~ mid-April
    Q4 = last day of Ashadh  (BS year 2)  ~ mid-July
Converted exactly with nepali_datetime (not approximated).

Usage:
    python tools/report_availability.py          # writes db/report_availability.json
    python tools/report_availability.py --lags 30 60 120

Output: db/report_availability.json
    {"rule": {...}, "reports": {SYM: [{fy, quarter, quarter_end, available: {"45": d, "60": d, "90": d}}]}}
"""

import argparse
import glob
import json
import os
import re
from datetime import date, timedelta

import nepali_datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUARTERLY_DIR = os.path.join(ROOT, "db", "quarterly")
OUT_PATH = os.path.join(ROOT, "db", "report_availability.json")
DEFAULT_LAGS = (45, 60, 90)
PRIMARY_LAG = 60

# quarter -> (BS month that STARTS right after the quarter ends, BS-year offset from FY start)
_NEXT_MONTH_AFTER_QUARTER = {
    1: (7, 0),   # Kartik 1 of year 1  -> Q1 ends last day of Ashwin
    2: (10, 0),  # Magh 1 of year 1    -> Q2 ends last day of Poush
    3: (1, 1),   # Baisakh 1 of year 2 -> Q3 ends last day of Chaitra
    4: (4, 1),   # Shrawan 1 of year 2 -> Q4 ends last day of Ashadh
}
_FY_RE = re.compile(r"^(\d{4})-(\d{2})$")


def fy_start_year(fy: str) -> int:
    """'2083-84' -> 2083. Raises ValueError on anything else."""
    m = _FY_RE.match(str(fy).strip())
    if not m:
        raise ValueError(f"unrecognised fiscal year {fy!r}")
    y1 = int(m.group(1))
    if (y1 + 1) % 100 != int(m.group(2)):
        raise ValueError(f"fiscal year {fy!r} is not two consecutive years")
    return y1


def quarter_end(fy: str, quarter: int) -> date:
    """Gregorian date of the last day of the given Nepali fiscal quarter."""
    if quarter not in _NEXT_MONTH_AFTER_QUARTER:
        raise ValueError(f"quarter must be 1-4, got {quarter!r}")
    month, offset = _NEXT_MONTH_AFTER_QUARTER[quarter]
    first_of_next = nepali_datetime.date(fy_start_year(fy) + offset, month, 1).to_datetime_date()
    return first_of_next - timedelta(days=1)


def available_on(fy: str, quarter: int, lag_days: int = PRIMARY_LAG) -> date:
    """First date a backtest may use this report."""
    return quarter_end(fy, quarter) + timedelta(days=lag_days)


def build(lags=DEFAULT_LAGS) -> dict:
    reports, skipped = {}, []
    for path in sorted(glob.glob(os.path.join(QUARTERLY_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        sym = doc.get("symbol") or os.path.splitext(os.path.basename(path))[0].upper()
        rows = []
        for q in doc.get("quarters", []):
            try:
                qe = quarter_end(q.get("fy"), q.get("quarter"))
            except ValueError as e:
                skipped.append(f"{sym} {q.get('fy')} Q{q.get('quarter')}: {e}")
                continue
            rows.append({
                "fy": q["fy"],
                "quarter": q["quarter"],
                "quarter_end": qe.isoformat(),
                "available": {str(l): (qe + timedelta(days=l)).isoformat() for l in lags},
            })
        rows.sort(key=lambda r: r["quarter_end"])
        reports[sym] = rows
    return {
        "rule": {
            "description": "available_on = Nepali fiscal quarter end + lag days",
            "primary_lag_days": PRIMARY_LAG,
            "lags_days": list(lags),
            "built_on": date.today().isoformat(),
        },
        "skipped": skipped,
        "reports": reports,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lags", type=int, nargs="+", default=list(DEFAULT_LAGS))
    args = ap.parse_args()
    out = build(tuple(args.lags))
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    n = sum(len(v) for v in out["reports"].values())
    print(f"{n} reports across {len(out['reports'])} symbols; skipped {len(out['skipped'])}")
    for s in out["skipped"][:10]:
        print("  skipped:", s)
    print("Wrote", OUT_PATH)


if __name__ == "__main__":
    main()
