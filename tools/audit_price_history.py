"""
Price History Audit
===================
Data-quality report over db/prices/*.json (output of tools/fetch_price_history.py).
These numbers feed the "Data" section of the research paper.

Checks:
- coverage: symbols with data, first/last dates, years of history
- weekday pattern per year (NEPSE trades Sun-Thu; Mon-Fri only in 2-day-weekend periods),
  which catches timestamp/date-shift bugs
- stale series: last bar > 30 days old (suspended, merged, or delisted)
- jumps: |adjusted daily return| > 15%. NEPSE's daily circuit is +/-10%, so these are
  unadjusted corporate actions, re-listings after suspension, or provider errors
- adjusted vs raw: latest bar should agree (adjustment applies backwards in time)

Usage:
    python tools/audit_price_history.py          # prints summary, writes .tmp/price_audit.json
"""

import collections
import glob
import json
import os
import statistics
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICES_DIR = os.path.join(ROOT, "db", "prices")
OUT_PATH = os.path.join(ROOT, ".tmp", "price_audit.json")
JUMP_PCT = 15.0
STALE_DAYS = 30


def audit_symbol(doc: dict, today: date) -> dict:
    adj = doc["adjusted"]["rows"]
    raw = doc["raw"]["rows"]
    out = {"rows": len(adj), "issues": len(doc.get("issues", []))}
    if not adj:
        return out
    first, last = date.fromisoformat(adj[0][0]), date.fromisoformat(adj[-1][0])
    out.update(first=adj[0][0], last=adj[-1][0], years=round((last - first).days / 365.25, 1),
               stale=(today - last).days > STALE_DAYS)
    jumps = []
    for prev, cur in zip(adj, adj[1:]):
        if prev[4] and cur[4]:
            r = (cur[4] / prev[4] - 1) * 100
            if abs(r) > JUMP_PCT:
                jumps.append([cur[0], round(r, 1)])
    out["jumps"] = jumps
    if raw and raw[-1][0] == adj[-1][0] and raw[-1][4]:
        out["latest_adj_raw_ratio"] = round(adj[-1][4] / raw[-1][4], 4)
    return out


def main():
    today = date.today()
    per = {}
    weekdays = collections.defaultdict(collections.Counter)
    for path in sorted(glob.glob(os.path.join(PRICES_DIR, "*.json"))):
        name = os.path.basename(path)
        if name.startswith("_"):
            continue
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        per[doc["symbol"]] = audit_symbol(doc, today)
        for r in doc["adjusted"]["rows"]:
            d = date.fromisoformat(r[0])
            weekdays[d.year][d.strftime("%a")] += 1

    with_data = {s: a for s, a in per.items() if a["rows"]}
    years = [a["years"] for a in with_data.values()]
    stale = sorted(s for s, a in with_data.items() if a["stale"])
    jumpy = {s: a["jumps"] for s, a in with_data.items() if a["jumps"]}
    ratio_off = {s: a["latest_adj_raw_ratio"] for s, a in with_data.items()
                 if abs(a.get("latest_adj_raw_ratio", 1) - 1) > 0.001}
    with_issues = {s: a["issues"] for s, a in with_data.items() if a["issues"]}

    summary = {
        "audited_on": today.isoformat(),
        "symbols": len(per),
        "with_data": len(with_data),
        "empty": sorted(set(per) - set(with_data)),
        "years_median": statistics.median(years) if years else None,
        "years_min": min(years) if years else None,
        "years_max": max(years) if years else None,
        "total_bars": sum(a["rows"] for a in with_data.values()),
        "stale_symbols": stale,
        "symbols_with_jumps": len(jumpy),
        "total_jumps": sum(len(j) for j in jumpy.values()),
        "latest_adj_raw_mismatch": ratio_off,
        "symbols_with_validation_issues": with_issues,
        "weekday_bars_by_year": {y: dict(weekdays[y]) for y in sorted(weekdays)},
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "per_symbol": per}, f, indent=1)

    s = summary
    print(f"Symbols: {s['symbols']}  with data: {s['with_data']}  empty: {len(s['empty'])} {s['empty'][:15]}")
    print(f"History years: median {s['years_median']}, min {s['years_min']}, max {s['years_max']}; bars {s['total_bars']}")
    print(f"Stale (> {STALE_DAYS} days): {len(stale)} {stale[:20]}")
    print(f"Jumps > {JUMP_PCT}%: {s['total_jumps']} across {s['symbols_with_jumps']} symbols")
    print(f"Latest adjusted != raw: {len(ratio_off)} {dict(list(ratio_off.items())[:10])}")
    print(f"Validation issues: {sum(with_issues.values())} across {len(with_issues)} symbols")
    print("Weekday bars by year:")
    for y, c in s["weekday_bars_by_year"].items():
        print(" ", y, {k: c.get(k, 0) for k in ("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")})
    print(f"\nFull report: {OUT_PATH}")


if __name__ == "__main__":
    main()
