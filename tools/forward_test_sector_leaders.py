"""
Sector Leaders forward (out-of-sample) test
===========================================
Implements docs/research/FORWARD_TEST_PROTOCOL.md. Read that first.

At each future quarterly rebalance date, `record` scores the universe point-in-time with the
FROZEN scorer and writes the picks to an append-only file before their returns exist.
`evaluate` later measures every recorded period whose exit session is in the price data, with
exactly the Phase 2 backtest code (tools/backtest_sector_leaders.py).

Usage:
    python tools/forward_test_sector_leaders.py calendar [--count 8]
    python tools/forward_test_sector_leaders.py record --date 2026-12-16
    python tools/forward_test_sector_leaders.py record --date 2026-06-12 --out-dir .tmp/dry_run
    python tools/forward_test_sector_leaders.py evaluate [--record-dir DIR] [--out PATH]

Output:
    db/research/forward_test/<rebalance-date>.json   one record per rebalance (never overwritten)
    .tmp/forward_test_summary.json                   evaluation summary
"""

import argparse
import glob
import hashlib
import json
import os
import statistics
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from tools import backtest_sector_leaders as BT  # noqa: E402
from tools.report_availability import fy_start_year  # noqa: E402

FORWARD_DIR = os.path.join(ROOT, "db", "research", "forward_test")
SUMMARY_PATH = os.path.join(ROOT, ".tmp", "forward_test_summary.json")
LAG = 60                                  # primary lag; also the calendar lag
FIRST_FORWARD = ("2083-84", 1)            # first out-of-sample rebalance: 2026-12-16
LATE_AFTER_DAYS = 14                      # records made later than this are flagged
MIN_SIGNAL_COVERAGE = 0.80                # share of the usual symbol count needed on the signal session
COVERAGE_SESSIONS = 20
SCHEMA = 1
CODE_FILES = ("tools/backtest_sector_leaders.py", "tools/forward_test_sector_leaders.py")


class Refused(Exception):
    """The tool will not record; the message says why."""


# ---------------------------------------------------------------- calendar

def next_quarter(fy: str, q: int):
    if q < 4:
        return fy, q + 1
    y = fy_start_year(fy) + 1
    return f"{y}-{(y + 1) % 100:02d}", 1


def forward_calendar(count: int, start=FIRST_FORWARD):
    """[(fy, quarter, rebalance date)] for `count` quarters from `start`."""
    out, (fy, q) = [], start
    for _ in range(count):
        out.append((fy, q, BT.rebalance_date(fy, q)))
        fy, q = next_quarter(fy, q)
    return out


def fiscal_quarter_for(d: date):
    """(fy, quarter) whose rebalance date is exactly d, else None."""
    for y in range(d.year + 55, d.year + 59):            # AD year -> BS fiscal-year start
        fy = f"{y}-{(y + 1) % 100:02d}"
        for q in (1, 2, 3, 4):
            try:
                if BT.rebalance_date(fy, q) == d:
                    return fy, q
            except (ValueError, KeyError, OverflowError):
                continue
    return None


FIRST_FORWARD_DATE = BT.rebalance_date(*FIRST_FORWARD)


# ---------------------------------------------------------------- data checks

def _file_sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read().replace(b"\r\n", b"\n")).hexdigest()


def _dir_digest(paths):
    h = hashlib.sha256()
    for p in sorted(paths, key=lambda x: os.path.basename(x)):
        h.update(os.path.basename(p).encode() + b"\0" + _file_sha256(p).encode() + b"\n")
    return h.hexdigest(), len(paths)


def data_fingerprint(quarterly_dir, prices_dir, dividends_path):
    """SHA-256 over the input files the record reads (CRLF normalised to LF, sorted by name).
    Price files starting with '_' (manifest, cross-check) are not read by Prices.load and are
    left out."""
    q_hash, q_n = _dir_digest(glob.glob(os.path.join(quarterly_dir, "*.json")))
    p_hash, p_n = _dir_digest([p for p in glob.glob(os.path.join(prices_dir, "*.json"))
                               if not os.path.basename(p).startswith("_")])
    d_hash = _file_sha256(dividends_path) if os.path.exists(dividends_path) else None
    combined = hashlib.sha256(f"{q_hash}\n{p_hash}\n{d_hash}\n".encode()).hexdigest()
    return {"quarterly": q_hash, "quarterly_files": q_n, "prices": p_hash, "prices_files": p_n,
            "dividends": d_hash, "combined": combined}


def check_price_coverage(rebalance: date, prices):
    """Signal and entry sessions, or Refused when the price data cannot support a record.

    The entry session (the one after the signal session) must already be in the data: until a
    later session exists, the last stored day might not be the true signal session."""
    if not prices.calendar:
        raise Refused("no price data loaded")
    last = prices.calendar[-1]
    signal, entry = BT.signal_and_entry(rebalance, prices)
    if signal is None or entry is None:
        raise Refused(
            f"price data ends {last}; it must contain a session after the rebalance date "
            f"{rebalance.isoformat()} (the entry session) so the signal session is final. "
            f"Refresh prices with tools/fetch_price_history.py and try again.")
    counts = {}
    for s in prices.series.values():
        for d in s["dates"]:
            counts[d] = counts.get(d, 0) + 1
    i = prices.calendar.index(signal)
    prior = [counts[d] for d in prices.calendar[max(0, i - COVERAGE_SESSIONS):i]]
    usual = statistics.median(prior) if prior else counts[signal]
    on_signal = counts[signal]
    if usual and on_signal < MIN_SIGNAL_COVERAGE * usual:
        raise Refused(
            f"only {on_signal} symbols have a close on the signal session {signal}, against a "
            f"usual {usual:g}; the price refresh looks partial. Re-run tools/fetch_price_history.py.")
    return signal, entry, {"price_last_session": last, "symbols_on_signal": on_signal,
                           "usual_symbols": usual}


def _git_info():
    def git(*args):
        try:
            r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=30)
            return r.stdout.strip() if r.returncode == 0 else None
        except (OSError, subprocess.SubprocessError):
            return None
    status = git("status", "--porcelain", "--", "db/quarterly", "db/prices", "db/dividend_data.json")
    return {"commit": git("rev-parse", "HEAD"),
            "data_uncommitted": None if status is None else bool(status)}


# ---------------------------------------------------------------- record

def record(rebalance: date, out_dir=None, *, quarterly_dir=None, prices_dir=None, dividends_path=None,
           now=None):
    """Score the universe on `rebalance` and write the append-only record. Returns its path."""
    out_dir = os.path.abspath(out_dir or FORWARD_DIR)
    live = os.path.normcase(out_dir) == os.path.normcase(os.path.abspath(FORWARD_DIR))
    quarterly_dir = quarterly_dir or BT.QUARTERLY_DIR
    prices_dir = prices_dir or BT.PRICES_DIR
    dividends_path = dividends_path or BT.DIVIDENDS_PATH
    now = now or datetime.now(timezone.utc)

    BT.check_frozen()
    fq = fiscal_quarter_for(rebalance)
    if fq is None:
        upcoming = ", ".join(d.isoformat() for _, _, d in forward_calendar(4))
        raise Refused(f"{rebalance.isoformat()} is not a rebalance date (quarter end + {LAG} days). "
                      f"Calendar: {upcoming}, ...")
    fy, q = fq
    next_reb = BT.rebalance_date(*next_quarter(fy, q))
    if live and rebalance < FIRST_FORWARD_DATE:
        raise Refused(f"{rebalance.isoformat()} is before the first forward date "
                      f"{FIRST_FORWARD_DATE.isoformat()}; past dates are not out of sample. "
                      f"Use --out-dir for a validation run.")
    if live and now.date() >= next_reb:
        raise Refused(f"too late: the next rebalance date {next_reb.isoformat()} has passed, so most "
                      f"of this period's return is known. Record the gap in the deviation log.")
    path = os.path.join(out_dir, f"{rebalance.isoformat()}.json")
    if os.path.exists(path):
        raise Refused(f"{path} already exists; records are append-only and are never overwritten.")

    docs = BT.load_quarterly(quarterly_dir)
    prices = BT.Prices.load(set(docs), prices_dir)
    dividends = BT.load_dividends(dividends_path)
    signal, entry, coverage = check_price_coverage(rebalance, prices)

    recs, results, leaders, excluded = BT.score_at(date.fromisoformat(signal), LAG, prices, docs, dividends)
    holdings = BT.holdings_of(leaders)
    if not holdings:
        raise Refused("no company passed the gates; nothing to record")
    latest_period = f"{fy}-Q{q}"
    with_latest = sum(1 for r in recs.values() if r["period"] == latest_period)

    days_after = (now.date() - rebalance).days
    doc = {
        "schema": SCHEMA,
        "study": "Sector Leaders forward test",
        "protocol": "docs/research/FORWARD_TEST_PROTOCOL.md",
        "mode": "live" if live else "validation",
        "rebalance": rebalance.isoformat(), "fiscal_year": fy, "quarter": q,
        "next_rebalance": next_reb.isoformat(),
        "lag_days": LAG, "top_n": BT.TOP_N,
        "signal_session": signal, "entry_session": entry,
        "created_at": now.isoformat(timespec="seconds"),
        "created_days_after_rebalance": days_after,
        "late": days_after > LATE_AFTER_DAYS,
        "frozen_hashes": dict(BT.FROZEN),
        "code_hashes": {p: _file_sha256(os.path.join(ROOT, p)) for p in CODE_FILES},
        "git": _git_info(),
        "data_fingerprint": data_fingerprint(quarterly_dir, prices_dir, dividends_path),
        "data_coverage": dict(coverage, latest_quarter=latest_period,
                              universe_with_latest_quarter=with_latest),
        "counts": {"universe": len(recs), "eligible": len(results), "excluded": len(excluded),
                   "holdings": len(holdings)},
        "holdings": [{"symbol": x["symbol"], "sector": x["sector"], "score": x["score"],
                      "sector_rank": x["sector_rank"], "period": x["period"],
                      "signal_close": recs[x["symbol"]]["ltp"]}
                     for xs in leaders.values() for x in xs],
        "eligible": [{"symbol": s, "sector": r["sector"], "score": r["score"],
                      "sector_rank": r["sector_rank"], "period": r["period"],
                      "coverage": r["coverage"], "pillars": r["pillars"]}
                     for s, r in results.items()],
        "excluded": excluded,
        "universe": {s: r["price_is_stale"] for s, r in recs.items()},
    }
    text = json.dumps(doc, indent=1)
    os.makedirs(out_dir, exist_ok=True)
    with open(path, "x", encoding="utf-8") as f:           # "x": fails if the file appeared meanwhile
        f.write(text)
    return path


# ---------------------------------------------------------------- evaluate

def load_records(record_dir):
    recs = []
    for p in sorted(glob.glob(os.path.join(record_dir, "*.json"))):
        with open(p, encoding="utf-8") as f:
            recs.append(json.load(f))
    return sorted(recs, key=lambda r: r["rebalance"])


def evaluate(record_dir=None, out_path=None, prices=None):
    """Evaluate every record whose exit session is in the price data. Returns the summary dict."""
    record_dir = record_dir or FORWARD_DIR
    records = load_records(record_dir)
    if prices is None:
        # Same symbol set as the backtest (every company in db/quarterly), plus any recorded
        # company no longer there, so the session calendar is built the same way.
        syms = set(BT.load_quarterly())
        for r in records:
            syms.update(r["universe"])
        prices = BT.Prices.load(syms)
    periods, pending, notes = [], [], []
    prev_weights, prev_next = {}, None
    for r in records:
        if prev_next is not None and r["rebalance"] != prev_next:
            notes.append(f"{r['rebalance']}: previous record's next rebalance was {prev_next}; "
                         f"gap in the record chain, this period starts from cash")
            prev_weights = {}
        prev_next = r["next_rebalance"]
        _, exit_ = BT.signal_and_entry(date.fromisoformat(r["next_rebalance"]), prices)
        if not exit_:
            pending.append(r["rebalance"])
            continue
        _, entry_now = BT.signal_and_entry(date.fromisoformat(r["rebalance"]), prices)
        if entry_now != r["entry_session"]:
            notes.append(f"{r['rebalance']}: entry session in current data is {entry_now}, recorded "
                         f"{r['entry_session']}; the recorded one is used")
        holdings = [h["symbol"] for h in r["holdings"]]
        eligible = {e["symbol"]: (e["sector"], e["score"]) for e in r["eligible"]}
        metrics, prev_weights = BT.evaluate_period(r["universe"], eligible, holdings,
                                                   r["entry_session"], exit_, prices, prev_weights)
        periods.append({
            "rebalance": r["rebalance"], "signal": r["signal_session"], "entry": r["entry_session"],
            "exit": exit_, "mode": r.get("mode"), "late": r.get("late"),
            "universe": r["counts"]["universe"], "eligible": r["counts"]["eligible"],
            "excluded": r["counts"]["excluded"], "holdings": holdings, "n_holdings": len(holdings),
            **metrics,
        })
    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "record_dir": record_dir, "records": len(records), "evaluated": len(periods),
        "pending": pending, "notes": notes,
        "summary": BT.summarize(periods) if periods else None,
        "periods": periods,
    }
    out_path = out_path or SUMMARY_PATH
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    return out


# ---------------------------------------------------------------- CLI

def _print_evaluation(out, out_path):
    print(f"{out['records']} record(s), {out['evaluated']} evaluated, pending: {out['pending'] or 'none'}")
    for n in out["notes"]:
        print("  note:", n)
    if out["summary"]:
        print(json.dumps(out["summary"], indent=1))
        print(" rebalance   elig hold   port%   matched%  excess%    IC")
        for p in out["periods"]:
            ic = p["ic"] if p["ic"] is None else round(p["ic"], 3)
            print(f" {p['rebalance']}  {p['eligible']:4d} {p['n_holdings']:4d}  {p['port_gross']*100:7.2f}  "
                  f"{p['bench_sector_matched']*100:7.2f}  {p['excess_vs_matched']*100:7.2f}  {ic}")
    print("Wrote", out_path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("calendar", help="print forward rebalance dates")
    c.add_argument("--count", type=int, default=8)
    r = sub.add_parser("record", help="record the frozen picks for one rebalance date")
    r.add_argument("--date", required=True, type=date.fromisoformat)
    r.add_argument("--out-dir", default=None, help="default db/research/forward_test (live)")
    e = sub.add_parser("evaluate", help="evaluate recorded periods whose exit is in the price data")
    e.add_argument("--record-dir", default=None)
    e.add_argument("--out", default=None)
    args = ap.parse_args(argv)

    if args.cmd == "calendar":
        for fy, q, d in forward_calendar(args.count):
            print(f"{fy} Q{q}  quarter end {BT.quarter_end(fy, q)}  rebalance {d}  {d.strftime('%a')}")
        return 0
    if args.cmd == "record":
        try:
            path = record(args.date, args.out_dir)
        except Refused as ex:
            print("REFUSED:", ex, file=sys.stderr)
            return 2
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        print(f"Recorded {doc['rebalance']} ({doc['mode']}): signal {doc['signal_session']}, "
              f"entry {doc['entry_session']}, {doc['counts']['holdings']} holdings of "
              f"{doc['counts']['eligible']} eligible; "
              f"{doc['data_coverage']['universe_with_latest_quarter']} of {doc['counts']['universe']} "
              f"companies have {doc['data_coverage']['latest_quarter']}")
        if doc["late"] and doc["mode"] == "live":
            print(f"LATE: made {doc['created_days_after_rebalance']} days after the rebalance date; "
                  f"add a deviation-log entry.")
        print("Wrote", path)
        return 0
    out_path = args.out or SUMMARY_PATH
    out = evaluate(args.record_dir, out_path)
    _print_evaluation(out, out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
