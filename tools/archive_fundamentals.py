"""
All-Company Fundamentals Archive (no Firecrawl, no API key)
===========================================================
Builds a GROWING historical archive of fundamentals for every listed NEPSE
company, so that after several quarters you have a per-company time series you
can mine to find consistently-improving businesses.

Unlike db/fundamentals.json (which overwrites with only the latest snapshot for
your holdings/watchlist), this writes an APPEND-ONLY, per-published-quarter
archive for the WHOLE market:

    db/fundamentals_archive/<SYMBOL>.json
      {
        "symbol": "NABIL",
        "full_name": "Nabil Bank Limited",
        "sector": "Commercial Banks",
        "snapshots": [
          { "reported_quarter": "2082-83-Q3", "captured_at": "2026-07-19",
            "eps_ttm": 31.57, "book_value": 243.30, "pe_ratio": 16.66,
            "roe": 13.15, "graham_number": 415.70, ... },
          ...  # one row per published quarter, oldest -> newest
        ]
      }

Dedupe rule: snapshots are keyed by the company's latest *published* quarter
(from NepseAlpha's financialsEPS). Re-running within the same quarter refreshes
that quarter's row (price-based fields like PE/LTP update); when a company
publishes a NEW quarter, a new row is appended. So the archive naturally grows
by one row per company per quarter — exactly what you want to compare later.

Mutual funds and bonds are skipped (they have no comparable fundamentals).

Source: NepseAlpha's server-rendered stock page embeds all of this as JSON;
we read it directly over plain HTTP (same technique as scrape_nepsealpha_direct).

Usage:
    python tools/archive_fundamentals.py            # every listed company
    python tools/archive_fundamentals.py NABIL NTC  # just these (testing)
    python tools/archive_fundamentals.py --limit 10 # first 10 (quick test)
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime

import httpx

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS_DIR)
from scrape_nepsealpha_direct import fetch_props, get_with_retry, make_client, SEARCH_URL  # noqa: E402

ROOT = os.path.dirname(TOOLS_DIR)
ARCHIVE_DIR = os.path.join(ROOT, "db", "fundamentals_archive")
META_PATH = os.path.join(ARCHIVE_DIR, "_meta.json")

REQUEST_DELAY_SEC = 1.0
# Sectors that aren't real companies (no comparable fundamentals)
SKIP_SECTORS = {"mutual fund", "mutual funds"}


def _num(v):
    if v is None:
        return None
    try:
        f = float(v)
        return f
    except (TypeError, ValueError):
        return None


def _round(v, n=2):
    return round(v, n) if isinstance(v, (int, float)) else None


def get_universe(client: httpx.Client) -> list:
    """Return every listed symbol from NepseAlpha's embedded all_stock_name."""
    props = fetch_props(client, "NABIL")  # any valid symbol carries the full list
    universe = []
    for item in props.get("all_stock_name", []) or []:
        sym = (item.get("symbol") or "").upper()
        info = item.get("stockinfo") or {}
        if sym:
            universe.append({"symbol": sym, "full_name": info.get("full_name", "")})
    return universe


def latest_quarter_metrics(props: dict) -> dict:
    """Pull the TTM/quarter metrics for the company's latest published quarter."""
    eps_info = props.get("financialsEPS") or {}
    fy = eps_info.get("fiscal_year")           # e.g. "082-083"
    q = eps_info.get("quarter")                # e.g. 3
    if not fy or not q:
        return {}

    # "082-083" + quarter 3 -> "2082-83-Q3"
    fy_parts = fy.split("-")
    reported_quarter = (f"20{fy_parts[0][1:]}-{fy_parts[1][1:]}-Q{q}"
                        if len(fy_parts) == 2 else f"{fy}-Q{q}")

    shares = _num((props.get("masterData") or {}).get("shares_outstnading")) or 0
    growths = props.get("quartesGrowths") or []
    vals = {}
    for row in growths:
        if row.get("fiscal_year") == fy and row.get("quarter") == q:
            vals[row.get("particulars")] = row.get("value")

    def bvps():
        raw = _num(vals.get("bvps"))
        return _round(raw / shares) if (raw is not None and shares) else None

    def pct(key):
        v = _num(vals.get(key))
        return _round(v * 100) if v is not None else None

    return {
        "fiscal_year": fy,
        "quarter": int(q),
        "reported_quarter": reported_quarter,
        "eps_reported": _round(_num(eps_info.get("value"))),
        "eps_ttm": _round(_num(vals.get("eps_ttm"))),
        "bvps_from_growths": bvps(),
        "roe_ttm": pct("roe_ttm"),
        "roa_ttm": pct("roa_ttm"),
        "net_margin_ttm": pct("net_margin_ttm"),
        "asset_turnover_ttm": pct("asset_turnover_ttm"),
        "net_profit_ttm": _num(vals.get("net_profit_ttm")),
        "revenue_ttm": _num(vals.get("revenue_ttm")),
        "net_profit_till_qtr": _num(vals.get("net_profit_till_qtr")),
        "revenue_till_qtr": _num(vals.get("revenue_till_qtr")),
    }


def build_snapshot(props: dict) -> dict:
    """Assemble one dated fundamentals snapshot from a company's page props."""
    master = props.get("masterData") or {}
    funda = props.get("funda_table") or {}
    general = props.get("stocksGenralInfo") or {}
    stock = props.get("stock_info") or {}

    q = latest_quarter_metrics(props)
    if not q:
        return {}

    promoter = _num(general.get("promoter_holding"))
    public = _num(general.get("public_holding"))

    snap = {
        "captured_at": datetime.now().strftime("%Y-%m-%d"),
        "reported_quarter": q["reported_quarter"],
        "fiscal_year": q["fiscal_year"],
        "quarter": q["quarter"],
        "sector": stock.get("sector") or funda.get("sector_name"),

        # Valuation
        "ltp_at_capture": _round(_num(funda.get("ltp"))),
        "pe_ratio": _round(_num(funda.get("pe_ratio"))),
        "pb_ratio": _round(_num(funda.get("pb_ratio"))),
        "graham_number": _round(_num(funda.get("graham_number"))),
        "discount_from_graham": _round(_num(funda.get("discount_from_graham_num")), 4),

        # Per-share
        "eps_reported": q["eps_reported"],
        "eps_ttm": q["eps_ttm"],
        "book_value": _round(_num(master.get("book_value"))),

        # Profitability (percent)
        "roe": _round(_num(funda.get("roe")) * 100) if _num(funda.get("roe")) is not None else q["roe_ttm"],
        "roa": _round(_num(funda.get("roa")) * 100) if _num(funda.get("roa")) is not None else q["roa_ttm"],
        "net_margin_ttm": q["net_margin_ttm"],
        "asset_turnover_ttm": q["asset_turnover_ttm"],

        # Scale
        "net_profit_ttm": q["net_profit_ttm"],
        "revenue_ttm": q["revenue_ttm"],
        "shares_outstanding": int(_num(master.get("shares_outstnading"))) if _num(master.get("shares_outstnading")) else None,

        # Dividend
        "dividend_payout_ratio": _round(_num(funda.get("total_dividend_payout_ratio")), 4),
        "dividend_to_ltp": _round(_num(funda.get("total_dividend_to_ltp")), 4),

        # Ownership & range
        "promoter_holding": _round(promoter * 100) if promoter is not None else None,
        "public_float": _round(public * 100) if public is not None else None,
        "week52_high": _round(_num(master.get("_52_weeks_hi"))),
        "week52_low": _round(_num(master.get("_52_weeks_lo"))),

        # Sector-relative rankings NepseAlpha computes (kept as-is)
        "sector_rankings": {
            k: funda.get(k) for k in (
                "pe_vs_sector", "pb_vs_sector", "roe_vs_sector", "roa_vs_sector",
                "dividend_yield_vs_sector", "peg_vs_sector", "yoy_vs_sector",
            ) if funda.get(k) is not None
        },
    }
    return snap


def upsert_snapshot(symbol: str, full_name: str, snap: dict) -> str:
    """Merge a snapshot into the symbol's archive. Returns 'new'|'updated'."""
    path = os.path.join(ARCHIVE_DIR, f"{symbol}.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            doc = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        doc = {"symbol": symbol, "full_name": full_name, "snapshots": []}

    doc["symbol"] = symbol
    if full_name:
        doc["full_name"] = full_name
    if snap.get("sector"):
        doc["sector"] = snap["sector"]

    snaps = doc.setdefault("snapshots", [])
    existing = next((s for s in snaps if s.get("reported_quarter") == snap["reported_quarter"]), None)
    if existing:
        existing.update(snap)
        result = "updated"
    else:
        snaps.append(snap)
        result = "new"

    # oldest -> newest by fiscal year then quarter
    snaps.sort(key=lambda s: (s.get("fiscal_year", ""), s.get("quarter", 0)))

    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
    return result


def collect(symbols=None, limit=None):
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    stats = {"new": 0, "updated": 0, "skipped_funds": 0, "no_data": 0, "failed": 0}
    failures = []

    with make_client() as client:
        if symbols:
            universe = [{"symbol": s.upper(), "full_name": ""} for s in symbols]
        else:
            print("Fetching listed-company universe from NepseAlpha...")
            universe = get_universe(client)
            print(f"  {len(universe)} listed symbols found.")
        if limit:
            universe = universe[:limit]

        total = len(universe)
        for i, entry in enumerate(universe):
            sym = entry["symbol"]
            try:
                props = fetch_props(client, sym)
                sector = ((props.get("stock_info") or {}).get("sector") or "").lower()
                funda = props.get("funda_table") or {}
                has_fundamentals = any(
                    isinstance(funda.get(k), (int, float))
                    for k in ("pe_ratio", "pb_ratio", "roe")
                )
                if sector in SKIP_SECTORS or not has_fundamentals:
                    stats["skipped_funds"] += 1
                    continue

                snap = build_snapshot(props)
                if not snap:
                    stats["no_data"] += 1
                    continue

                full_name = entry.get("full_name") or (props.get("stock_info") or {}).get("full_name", "")
                result = upsert_snapshot(sym, full_name, snap)
                stats[result] += 1
                print(f"  [{i + 1}/{total}] {sym}: {result} ({snap['reported_quarter']}, "
                      f"EPS {snap.get('eps_ttm')}, PE {snap.get('pe_ratio')}, ROE {snap.get('roe')})")
            except Exception as e:
                stats["failed"] += 1
                failures.append(sym)
                print(f"  [{i + 1}/{total}] {sym}: FAILED ({e})")
            if i < total - 1:
                time.sleep(REQUEST_DELAY_SEC)

    # meta: record this run for the quarterly auto-scheduler
    meta = {}
    try:
        with open(META_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    meta["last_run"] = datetime.now().isoformat()
    meta["last_stats"] = stats
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print(f"\nArchive updated: {stats['new']} new-quarter rows, {stats['updated']} refreshed, "
          f"{stats['skipped_funds']} funds/bonds skipped, {stats['no_data']} no-data, "
          f"{stats['failed']} failed.")
    if failures:
        print(f"Failed symbols: {', '.join(failures)}")
    return stats, failures


def main():
    parser = argparse.ArgumentParser(
        description="Archive fundamentals for every listed NEPSE company (no API key).")
    parser.add_argument("symbols", nargs="*", help="Specific symbols (default: all listed)")
    parser.add_argument("--limit", type=int, help="Only process the first N symbols (testing)")
    args = parser.parse_args()

    _, failures = collect(symbols=args.symbols or None, limit=args.limit)
    sys.exit(0 if not failures else 2)


if __name__ == "__main__":
    main()
