"""
Dividend Announcement Scraper (NepaliPaisa API)
================================================
Fetches dividend announcements (bonus %, cash %, book closure dates) for all
portfolio symbols from the NepaliPaisa public JSON API and merges them into
db/dividend_data.json.

Why NepaliPaisa: returns clean structured JSON (no HTML parsing, no firecrawl
credits, no LLM extraction). Tested working as of 2026-07.

Usage:
    python tools/scrape_dividends.py                 # all portfolio symbols
    python tools/scrape_dividends.py NTC SAHAS       # specific symbols
    python tools/scrape_dividends.py --fy 081-082    # print summary for one FY
"""

import argparse
import json
import os
import sys
import time

import httpx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTFOLIO_PATH = os.path.join(ROOT, "db", "portfolio.json")
DIVIDEND_DB_PATH = os.path.join(ROOT, "db", "dividend_data.json")

API_URL = "https://nepalipaisa.com/api/GetDividends"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PortfolioInsight/1.0",
    "Accept": "application/json",
}
REQUEST_DELAY_SEC = 0.6  # be polite to the API
ITEMS_PER_PAGE = 20      # covers many years of history per symbol


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except Exception as e:
        print(f"[scrape_dividends] Error reading {path}: {e}")
        return default


def normalize_fy(fy_bs: str) -> str:
    """'2081/2082' -> '081-082' (matches manual_dividends.json convention)."""
    if not fy_bs:
        return ""
    parts = fy_bs.replace("-", "/").split("/")
    if len(parts) != 2:
        return fy_bs
    try:
        a, b = int(parts[0]), int(parts[1])
        return f"{a % 1000:03d}-{b % 1000:03d}"
    except ValueError:
        return fy_bs


def to_float(v) -> float:
    try:
        return float(str(v).replace("%", "").strip() or 0)
    except ValueError:
        return 0.0


def fetch_symbol(client: httpx.Client, symbol: str):
    """Fetch dividend history for one symbol. Returns list of raw API rows."""
    params = {
        "stockSymbol": symbol,
        "pageNo": 1,
        "itemsPerPage": ITEMS_PER_PAGE,
        "pagePerDisplay": 5,
    }
    r = client.get(API_URL, params=params, headers=HEADERS, timeout=20)
    r.raise_for_status()
    payload = r.json()
    if payload.get("statusCode") != 200:
        raise RuntimeError(f"API returned {payload.get('statusCode')}: {payload.get('message')}")
    return (payload.get("result") or {}).get("data") or []


def merge_symbol(db: dict, symbol: str, rows: list) -> int:
    """Merge API rows into db structure. Returns count of new/updated entries."""
    entry = db.setdefault(symbol, {"symbol": symbol, "companyName": "", "dividends": []})
    changed = 0

    for row in rows:
        # API returns exact-match plus fuzzy symbol matches; keep exact only
        if (row.get("stockSymbol") or "").upper() != symbol:
            continue
        if not entry.get("companyName") and row.get("companyName"):
            entry["companyName"] = row["companyName"]

        fy = normalize_fy(row.get("fiscalYearBS", ""))
        new_div = {
            "fiscalYear": fy,
            "bonusPercent": to_float(row.get("bonus")),
            "cashPercent": to_float(row.get("cash")),
            "totalPercent": to_float(row.get("totalDividend")),
            "bookClosureDateAD": row.get("bookClosureDateAD") or "",
            "bookClosureDateBS": row.get("bookClosureDateBS") or "",
            "distributionDateAD": row.get("distributionDateAD") or "",
            "status": row.get("status") or "",
            "source": "nepalipaisa",
        }

        # Dedupe by fiscal year: update existing entry in place, keep notes
        existing = next((d for d in entry["dividends"] if d.get("fiscalYear") == fy), None)
        if existing:
            notes = existing.get("notes", "")
            before = json.dumps(existing, sort_keys=True)
            existing.update(new_div)
            if notes:
                existing["notes"] = notes
            if json.dumps(existing, sort_keys=True) != before:
                changed += 1
        else:
            new_div["notes"] = ""
            entry["dividends"].append(new_div)
            changed += 1

    # newest fiscal year first
    entry["dividends"].sort(key=lambda d: d.get("fiscalYear", ""), reverse=True)
    return changed


def main():
    parser = argparse.ArgumentParser(description="Fetch NEPSE dividend announcements from NepaliPaisa.")
    parser.add_argument("symbols", nargs="*", help="Symbols to fetch (default: all portfolio holdings)")
    parser.add_argument("--fy", help="Print a summary for this fiscal year (e.g. 081-082) after fetching")
    args = parser.parse_args()

    if args.symbols:
        symbols = [s.upper() for s in args.symbols]
    else:
        portfolio = load_json(PORTFOLIO_PATH, {"holdings": []})
        symbols = sorted({h["symbol"].upper() for h in portfolio.get("holdings", [])})

    if not symbols:
        print("No symbols to fetch.")
        sys.exit(1)

    db = load_json(DIVIDEND_DB_PATH, {})
    total_changed, failures = 0, []

    with httpx.Client() as client:
        for i, symbol in enumerate(symbols):
            try:
                rows = fetch_symbol(client, symbol)
                changed = merge_symbol(db, symbol, rows)
                total_changed += changed
                print(f"  {symbol}: {len(rows)} announcements, {changed} new/updated")
            except Exception as e:
                failures.append(symbol)
                print(f"  {symbol}: FAILED ({e})")
            if i < len(symbols) - 1:
                time.sleep(REQUEST_DELAY_SEC)

    with open(DIVIDEND_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)

    print(f"\nSaved {DIVIDEND_DB_PATH} ({total_changed} entries new/updated, {len(failures)} failures)")
    if failures:
        print(f"Failed symbols: {', '.join(failures)}")

    if args.fy:
        print(f"\n--- Dividends for FY {args.fy} ---")
        for sym in symbols:
            for d in db.get(sym, {}).get("dividends", []):
                if d.get("fiscalYear") == args.fy:
                    print(f"  {sym}: bonus {d['bonusPercent']}% + cash {d['cashPercent']}% "
                          f"(book closure {d.get('bookClosureDateAD') or 'TBA'})")

    sys.exit(0 if not failures else 2)


if __name__ == "__main__":
    main()
