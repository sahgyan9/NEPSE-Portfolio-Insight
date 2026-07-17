"""
Dividend Lookup (single symbol, live)
======================================
Quick test tool: enter one NEPSE symbol, see its full dividend history
(bonus %, cash %, book closure dates), fetched live from NepaliPaisa.
Falls back to the cached db/dividend_data.json if the live call fails.

Reuses fetch/normalize logic from tools/scrape_dividends.py so both stay
in sync with the same API quirks (fuzzy-symbol filtering, FY normalization).

Usage:
    python tools/lookup_dividend.py NABIL
    python tools/lookup_dividend.py          # prompts for a symbol
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import httpx
from scrape_dividends import fetch_symbol, normalize_fy, to_float, load_json, DIVIDEND_DB_PATH


def print_dividends(symbol: str, rows: list):
    exact = [r for r in rows if (r.get("stockSymbol") or "").upper() == symbol]
    if not exact:
        print(f"No dividend announcements found for '{symbol}'.")
        return

    company_name = exact[0].get("companyName", "")
    print(f"\n{symbol} - {company_name}")
    print("-" * 60)
    for row in sorted(exact, key=lambda r: normalize_fy(r.get("fiscalYearBS", "")), reverse=True):
        fy = normalize_fy(row.get("fiscalYearBS", ""))
        bonus = to_float(row.get("bonus"))
        cash = to_float(row.get("cash"))
        total = to_float(row.get("totalDividend"))
        closure = row.get("bookClosureDateAD") or "TBA"
        status = row.get("status") or ""
        print(f"  FY {fy}: bonus {bonus}% + cash {cash}% = {total}%  "
              f"(book closure {closure}, {status})")
    print()


def lookup(symbol: str):
    symbol = symbol.upper().strip()
    try:
        with httpx.Client() as client:
            rows = fetch_symbol(client, symbol)
        print_dividends(symbol, rows)
    except Exception as e:
        print(f"Live fetch failed ({e}); falling back to cached data...")
        db = load_json(DIVIDEND_DB_PATH, {})
        entry = db.get(symbol)
        if not entry or not entry.get("dividends"):
            print(f"No cached data for '{symbol}' either.")
            return
        print(f"\n{symbol} - {entry.get('companyName', '')} (cached)")
        print("-" * 60)
        for d in entry["dividends"]:
            closure = d.get("bookClosureDateAD") or "TBA"
            print(f"  FY {d['fiscalYear']}: bonus {d['bonusPercent']}% + cash {d['cashPercent']}% "
                  f"= {d['totalPercent']}%  (book closure {closure})")
        print()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        lookup(sys.argv[1])
    else:
        sym = input("Enter symbol: ")
        lookup(sym)
