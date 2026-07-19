"""
Fundamentals + Market Data Direct Scraper (no Firecrawl, no API key)
====================================================================
Replaces BOTH tools/scrape_fundamentals.py and tools/scrape_market_data.py.

One plain-HTTP request per symbol to NepseAlpha's server-rendered stock page
(the same request tools/scrape_nepsealpha_direct.py makes) yields everything
db/fundamentals.json stores, with exact values instead of LLM-extracted ones:

    eps               <- masterData.eps
    bookValue         <- masterData.book_value
    peRatio           <- funda_table.pe_ratio        (live, based on LTP)
    pbRatio           <- funda_table.pb_ratio
    sharesOutstanding <- masterData.shares_outstnading
    promoterHolding   <- stocksGenralInfo.promoter_holding  (x100 -> percent)
    publicFloat       <- stocksGenralInfo.public_holding    (x100 -> percent)
    high52            <- masterData._52_weeks_hi
    low52             <- masterData._52_weeks_lo

Notes:
- avgVolume120d is NOT provided by NepseAlpha's payload; any existing value
  in db/fundamentals.json is left untouched (the old Firecrawl prompt always
  returned null for it anyway).
- Existing keys are merged, never wiped: a field missing from the payload
  keeps its previous value.

Usage:
    python tools/scrape_fundamentals_direct.py            # all portfolio symbols
    python tools/scrape_fundamentals_direct.py all        # same
    python tools/scrape_fundamentals_direct.py NABIL NTC  # specific symbols
"""

import argparse
import json
import os
import sys
import time

import httpx

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS_DIR)
from scrape_nepsealpha_direct import fetch_props, make_client  # noqa: E402  (reuse, no key needed)

ROOT = os.path.dirname(TOOLS_DIR)
DB_PATH = os.path.join(ROOT, "db", "fundamentals.json")
PORTFOLIO_PATH = os.path.join(ROOT, "db", "portfolio.json")

REQUEST_DELAY_SEC = 1.0
# Mutual funds / instruments with no company fundamentals page
EXCLUDED_SYMBOLS = {"CSBY", "KDBY", "MMF1", "NBF3", "NIBLSF", "NMBSBFE"}


def _num(v):
    """Coerce API value (may be str/None) to float, else None."""
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def extract_fundamentals(props: dict) -> dict:
    master = props.get("masterData") or {}
    funda = props.get("funda_table") or {}
    general = props.get("stocksGenralInfo") or {}

    promoter = _num(general.get("promoter_holding"))
    public = _num(general.get("public_holding"))

    fields = {
        "eps": _num(master.get("eps")),
        "bookValue": _num(master.get("book_value")),
        "peRatio": _num(funda.get("pe_ratio")),
        "pbRatio": _num(funda.get("pb_ratio")),
        "sharesOutstanding": _num(master.get("shares_outstnading")),
        # NepseAlpha stores holdings as fractions (0.6 = 60%); db uses 0-100
        "promoterHolding": round(promoter * 100, 2) if promoter is not None else None,
        "publicFloat": round(public * 100, 2) if public is not None else None,
        "high52": _num(master.get("_52_weeks_hi")),
        "low52": _num(master.get("_52_weeks_lo")),
    }

    # Round display-style metrics to 2dp like the old pipeline stored them
    for k in ("eps", "bookValue", "peRatio", "pbRatio", "high52", "low52"):
        if fields[k] is not None:
            fields[k] = round(fields[k], 2)
    if fields["sharesOutstanding"] is not None:
        fields["sharesOutstanding"] = int(fields["sharesOutstanding"])

    return {k: v for k, v in fields.items() if v is not None}


def load_db() -> dict:
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def load_portfolio_symbols():
    """All holdings PLUS watchlist symbols (the watchlist table reads
    /api/fundamentals too, so watchlist-only symbols must be scraped or
    they show N/A in the app)."""
    try:
        with open(PORTFOLIO_PATH, "r", encoding="utf-8-sig") as f:
            portfolio = json.load(f)
    except Exception as e:
        print(f"Could not read portfolio ({e}).")
        return []
    symbols = []
    for h in portfolio.get("holdings", []):
        sector = (h.get("sector") or "").lower()
        sym = h["symbol"].upper()
        if "fund" in sector or sym in EXCLUDED_SYMBOLS:
            continue  # mutual funds have no fundamentals page
        symbols.append(sym)
    for w in portfolio.get("watchlist", []):
        sym = (w.get("symbol") or "").upper()
        if sym and sym not in EXCLUDED_SYMBOLS:
            symbols.append(sym)
    return sorted(set(symbols))


def main():
    parser = argparse.ArgumentParser(
        description="Fetch NEPSE fundamentals + market data directly from NepseAlpha (no API key).")
    parser.add_argument("symbols", nargs="*",
                        help="Symbols to fetch, or 'all'/nothing for all portfolio holdings")
    args = parser.parse_args()

    symbols = [s.upper() for s in args.symbols if s.lower() != "all"]
    if not symbols:
        symbols = load_portfolio_symbols()
    if not symbols:
        print("No symbols to fetch.")
        sys.exit(1)

    db = load_db()
    failures = []

    with make_client() as client:
        for i, symbol in enumerate(symbols):
            try:
                props = fetch_props(client, symbol)
                fields = extract_fundamentals(props)
                if not fields:
                    raise RuntimeError("no fundamentals fields in page payload")
                db.setdefault(symbol, {}).update(fields)
                print(f"  {symbol}: {len(fields)} fields updated "
                      f"(eps={fields.get('eps')}, pe={fields.get('peRatio')}, "
                      f"pb={fields.get('pbRatio')}, 52wk={fields.get('low52')}-{fields.get('high52')})")
            except Exception as e:
                failures.append(symbol)
                print(f"  {symbol}: FAILED ({e})")
            if i < len(symbols) - 1:
                time.sleep(REQUEST_DELAY_SEC)

    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {DB_PATH} ({len(symbols) - len(failures)} ok, {len(failures)} failed)")
    if failures:
        print(f"Failed symbols: {', '.join(failures)}")
    sys.exit(0 if not failures else 2)


if __name__ == "__main__":
    main()
