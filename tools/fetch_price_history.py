"""
Daily Price History Fetcher (research dataset, Phase 1)
=======================================================
Downloads full daily OHLCV history for NEPSE symbols and stores it under db/prices/.
This is the price side of the backtest: without it we cannot measure whether a
ranking predicted future returns.

Sources (both serve TradingView-format JSON: {"t": [...], "o": [...], "h", "l", "c", "v"}):
1. merolagani (primary)  - TechnicalChartHandler.ashx; supports isAdjust=1 (adjusted for
   bonus/right shares) and isAdjust=0 (prices as actually traded). History from ~2014.
2. nepsealpha (cross-check only) - /trading/1/history; used to verify merolagani closes
   against an independent provider.

Why two price series per symbol:
- adjusted: use for RETURNS. NEPSE companies issue bonus shares often; an unadjusted
  series shows a fake crash on every bonus book-closure date.
- raw: use for LIQUIDITY and tradability (turnover = raw close x volume, circuit limits).

Usage:
    python tools/fetch_price_history.py                       # every symbol in db/quarterly
    python tools/fetch_price_history.py NABIL UPPER           # specific symbols
    python tools/fetch_price_history.py --force               # ignore the freshness skip
    python tools/fetch_price_history.py --cross-check NABIL SBL  # compare against nepsealpha
    python tools/fetch_price_history.py --delay 2.0           # slower, politer crawling

Output:
    db/prices/<SYM>.json      {symbol, source, fetched_at, adjusted:{columns,rows}, raw:{...}, issues}
    db/prices/_manifest.json  per-symbol row count, first/last date, issue count
    db/prices/_crosscheck.json (with --cross-check) close-price agreement statistics
"""

import argparse
import glob
import json
import os
import statistics
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUARTERLY_DIR = os.path.join(ROOT, "db", "quarterly")
PRICES_DIR = os.path.join(ROOT, "db", "prices")
MANIFEST_PATH = os.path.join(PRICES_DIR, "_manifest.json")
CROSSCHECK_PATH = os.path.join(PRICES_DIR, "_crosscheck.json")

# Bar timestamps: the trading date is the UTC calendar date, NOT the Nepal-time date.
# merolagani stamps bars at 05:45 UTC (11:30 NPT, same day) up to 2017, and at ~20:45 UTC
# (02:30 NPT the NEXT morning) from 2018 on. Converting to NPT shifts every post-2018 bar one
# day late (Sun-Thu sessions show up as Mon-Fri). Verified 2026-11-07 against NABIL.
COLUMNS = ["date", "open", "high", "low", "close", "volume"]
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}
DEFAULT_DELAY_SEC = 1.5
MAX_RETRIES = 3
FRESH_HOURS = 20


def merolagani_url(symbol: str, adjusted: bool, end_ts: int) -> str:
    return (
        "https://merolagani.com/handlers/TechnicalChartHandler.ashx"
        f"?type=get_advanced_chart&symbol={symbol}&resolution=1D"
        f"&rangeStartDate=0&rangeEndDate={end_ts}&from=&isAdjust={1 if adjusted else 0}"
        "&currencyCode=NPR"
    )


def nepsealpha_url(symbol: str, end_ts: int) -> str:
    return (
        "https://nepsealpha.com/trading/1/history"
        f"?symbol={symbol}&resolution=1D&from=0&to={end_ts}&pass=ok&force=1&currencyCode=NRS"
    )


# ---------------------------------------------------------------- pure functions (tested)

def parse_tv(payload: dict) -> list:
    """Convert TradingView columnar JSON into sorted rows [date, o, h, l, c, v].

    Returns [] when the provider reports no data. Duplicate dates keep the last bar.
    """
    if not isinstance(payload, dict):
        return []
    if payload.get("s") == "no_data":
        return []
    t = payload.get("t") or []
    if not t:
        return []
    cols = {k: payload.get(k) or [] for k in ("o", "h", "l", "c", "v")}
    n = len(t)
    for k in ("o", "h", "l", "c"):
        if len(cols[k]) != n:
            raise ValueError(f"column '{k}' has {len(cols[k])} values, expected {n}")
    by_date = {}
    for i, ts in enumerate(t):
        date = datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%d")
        vol = cols["v"][i] if i < len(cols["v"]) else None
        by_date[date] = [
            date,
            _num(cols["o"][i]),
            _num(cols["h"][i]),
            _num(cols["l"][i]),
            _num(cols["c"][i]),
            _num(vol),
        ]
    return [by_date[d] for d in sorted(by_date)]


def _num(x):
    if x is None:
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def validate(rows: list) -> list:
    """Return human-readable data-quality issues. Empty list means clean."""
    issues = []
    prev = None
    for r in rows:
        date, o, h, l, c, _v = r
        if prev is not None and date <= prev:
            issues.append(f"{date}: not strictly after {prev}")
        prev = date
        if c is None or c <= 0:
            issues.append(f"{date}: non-positive or missing close ({c})")
            continue
        if h is not None and l is not None:
            if h < l:
                issues.append(f"{date}: high {h} < low {l}")
            elif not (l - 1e-6 <= c <= h + 1e-6):
                issues.append(f"{date}: close {c} outside [{l}, {h}]")
    return issues


def compare_closes(a: list, b: list) -> dict:
    """Compare close prices of two row lists on their common dates."""
    ca = {r[0]: r[4] for r in a if r[4]}
    cb = {r[0]: r[4] for r in b if r[4]}
    common = sorted(set(ca) & set(cb))
    if not common:
        return {"common_days": 0}
    diffs = sorted(abs(ca[d] - cb[d]) / cb[d] * 100 for d in common)
    p95 = diffs[min(len(diffs) - 1, int(0.95 * len(diffs)))]
    return {
        "common_days": len(common),
        "only_in_primary": len(set(ca) - set(cb)),
        "only_in_secondary": len(set(cb) - set(ca)),
        "median_abs_diff_pct": round(statistics.median(diffs), 4),
        "p95_abs_diff_pct": round(p95, 4),
        "days_over_1pct": sum(1 for x in diffs if x > 1.0),
    }


# ---------------------------------------------------------------- network

def get_json(client: httpx.Client, url: str) -> dict:
    last_err = None
    for attempt in range(MAX_RETRIES):
        try:
            r = client.get(url)
            if r.status_code == 200:
                return r.json()
            last_err = f"HTTP {r.status_code}"
        except (httpx.HTTPError, ValueError) as e:
            last_err = str(e)
        time.sleep(2 ** (attempt + 1))
    raise RuntimeError(last_err)


def is_fresh(path: str) -> bool:
    if not os.path.exists(path):
        return False
    try:
        with open(path, encoding="utf-8") as f:
            fetched = datetime.fromisoformat(json.load(f)["fetched_at"])
    except (OSError, ValueError, KeyError):
        return False
    return datetime.now(timezone.utc) - fetched < timedelta(hours=FRESH_HOURS)


def fetch_symbol(client, symbol, end_ts, delay):
    adjusted = parse_tv(get_json(client, merolagani_url(symbol, True, end_ts)))
    time.sleep(delay)
    raw = parse_tv(get_json(client, merolagani_url(symbol, False, end_ts)))
    issues = [f"adjusted {i}" for i in validate(adjusted)] + [f"raw {i}" for i in validate(raw)]
    return {
        "symbol": symbol,
        "source": "merolagani",
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "adjusted": {"columns": COLUMNS, "rows": adjusted},
        "raw": {"columns": COLUMNS, "rows": raw},
        "issues": issues,
    }


def universe() -> list:
    return sorted(
        os.path.splitext(os.path.basename(p))[0].upper()
        for p in glob.glob(os.path.join(QUARTERLY_DIR, "*.json"))
    )


def summarize(doc: dict) -> dict:
    rows = doc["adjusted"]["rows"]
    return {
        "rows": len(rows),
        "first": rows[0][0] if rows else None,
        "last": rows[-1][0] if rows else None,
        "raw_rows": len(doc["raw"]["rows"]),
        "issues": len(doc["issues"]),
        "fetched_at": doc["fetched_at"],
    }


def write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    # On Windows, antivirus/indexer briefly locks freshly written files; os.replace then
    # raises PermissionError (WinError 5). Retry instead of aborting a long run.
    for attempt in range(8):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.25 * (attempt + 1))
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("symbols", nargs="*", help="symbols to fetch (default: all in db/quarterly)")
    ap.add_argument("--force", action="store_true", help="refetch even if fetched recently")
    ap.add_argument("--delay", type=float, default=DEFAULT_DELAY_SEC, help="seconds between requests")
    ap.add_argument("--cross-check", nargs="+", metavar="SYM", help="compare stored closes with nepsealpha")
    args = ap.parse_args()

    os.makedirs(PRICES_DIR, exist_ok=True)
    end_ts = int(time.time())
    client = httpx.Client(headers=HEADERS, timeout=30, follow_redirects=True)

    if args.cross_check:
        results = {}
        for sym in [s.upper() for s in args.cross_check]:
            path = os.path.join(PRICES_DIR, f"{sym}.json")
            if not os.path.exists(path):
                print(f"{sym}: no stored merolagani file, fetch it first")
                continue
            with open(path, encoding="utf-8") as f:
                primary = json.load(f)["adjusted"]["rows"]
            try:
                secondary = parse_tv(get_json(client, nepsealpha_url(sym, end_ts)))
            except RuntimeError as e:
                print(f"{sym}: nepsealpha failed ({e})")
                continue
            results[sym] = compare_closes(primary, secondary)
            print(sym, results[sym])
            time.sleep(args.delay)
        write_json(CROSSCHECK_PATH, {"checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                     "results": results})
        return 0

    symbols = [s.upper() for s in args.symbols] or universe()
    manifest = {}
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, encoding="utf-8") as f:
            manifest = json.load(f)

    failed = []
    for n, sym in enumerate(symbols, 1):
        path = os.path.join(PRICES_DIR, f"{sym}.json")
        if not args.force and is_fresh(path):
            print(f"[{n}/{len(symbols)}] {sym}: fresh, skipped")
            continue
        try:
            doc = fetch_symbol(client, sym, end_ts, args.delay)
        except RuntimeError as e:
            print(f"[{n}/{len(symbols)}] {sym}: FAILED ({e})")
            failed.append(sym)
            time.sleep(args.delay)
            continue
        write_json(path, doc)
        manifest[sym] = summarize(doc)
        m = manifest[sym]
        print(f"[{n}/{len(symbols)}] {sym}: {m['rows']} days {m['first']} -> {m['last']}, issues {m['issues']}")
        write_json(MANIFEST_PATH, manifest)
        time.sleep(args.delay)

    print(f"\nDone. {len(symbols) - len(failed)} ok, {len(failed)} failed.")
    if failed:
        print("Failed:", " ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
