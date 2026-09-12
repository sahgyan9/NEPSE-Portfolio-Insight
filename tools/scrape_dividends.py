"""
Dividend Announcement Scraper (HamroShare Bulk + NepaliPaisa Fallback)
======================================================================
Fetches dividend announcements (bonus %, cash %, book closure dates, announcement
dates, bonus listing dates, close prices) for NEPSE symbols and merges them into
db/dividend_data.json.

Data Sources:
1. Primary (Bulk): HamroShare (https://hamroshare.com.np/investment/proposed-dividend)
   - Fetches the entire market's announcements (830+ records, 320+ companies across
     6 fiscal years) in a SINGLE HTTP GET via Next.js RSC stream in ~1s.
   - Enriches data with announcement_date, bonus_listing_date, and close price.
2. Fallback / Detail: NepaliPaisa public JSON API (https://nepalipaisa.com/api/GetDividends)
   - Used as secondary fallback if HamroShare fails or if a symbol is missing from HamroShare.
   - Also provides bookClosureDateBS (Bikram Sambat).

Usage:
    python tools/scrape_dividends.py                      # all portfolio symbols (auto source)
    python tools/scrape_dividends.py NTC SAHAS            # specific symbols
    python tools/scrape_dividends.py --all                # every harvested company in archive
    python tools/scrape_dividends.py --all --missing-only # only ones with no data yet
    python tools/scrape_dividends.py --source hamroshare  # HamroShare bulk only
    python tools/scrape_dividends.py --source nepalipaisa # NepaliPaisa only
    python tools/scrape_dividends.py --fy 081-082         # print summary for one FY
"""

import argparse
import json
import os
import re
import sys
import time

import httpx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTFOLIO_PATH = os.path.join(ROOT, "db", "portfolio.json")
DIVIDEND_DB_PATH = os.path.join(ROOT, "db", "dividend_data.json")
ARCHIVE_DIR = os.path.join(ROOT, "db", "fundamentals_archive")

# NepaliPaisa settings
NEPALIPAISA_API_URL = "https://nepalipaisa.com/api/GetDividends"
NEPALIPAISA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PortfolioInsight/1.0",
    "Accept": "application/json",
}
REQUEST_DELAY_SEC = 0.6  # polite delay between sequential NepaliPaisa requests
ITEMS_PER_PAGE = 20

# HamroShare settings
HAMROSHARE_URL = "https://hamroshare.com.np/investment/proposed-dividend"
HAMROSHARE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "RSC": "1",
}


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
    """'2081/2082' or '2081/82' or '081-082' -> '081-082' (matches manual_dividends.json convention)."""
    if not fy_bs:
        return ""
    fy_clean = fy_bs.upper().replace("FY", "").strip()
    parts = fy_clean.replace("-", "/").split("/")
    if len(parts) != 2:
        return fy_bs
    try:
        a = int(parts[0])
        b = int(parts[1])
        if b < 100:
            b = (a // 100) * 100 + b
        return f"{a % 1000:03d}-{b % 1000:03d}"
    except ValueError:
        return fy_bs


def to_float(v) -> float:
    try:
        return float(str(v).replace("%", "").strip() or 0)
    except (ValueError, TypeError):
        return 0.0


# ── HamroShare Primary Bulk Fetcher ──────────────────────────────────────────

def fetch_hamroshare_bulk(client: httpx.Client):
    """Fetch the entire market's dividend announcements in one single HTTP request.

    Returns:
        tuple[dict[str, list[dict]], dict[str, str]]:
          - symbol -> list of standardized dividend dicts
          - symbol -> companyName
    """
    r = client.get(HAMROSHARE_URL, headers=HAMROSHARE_HEADERS, timeout=20, follow_redirects=True)
    r.raise_for_status()
    text = r.text

    fy_pattern = re.compile(r'\{"id":\d+,"label":"(FY [^"]+)","rows":(\[.*?\])\}', re.DOTALL)
    matches = fy_pattern.findall(text)
    if not matches:
        raise RuntimeError("No fiscal year sections found in HamroShare response.")

    by_symbol = {}
    company_names = {}

    for label, rows_json in matches:
        try:
            rows = json.loads(rows_json)
        except Exception:
            continue

        for row in rows:
            sym = (row.get("symbol") or "").upper().strip()
            if not sym:
                continue

            cname = (row.get("companyname") or "").strip()
            if cname and sym not in company_names:
                company_names[sym] = cname

            fy = normalize_fy(row.get("year") or label)
            div_item = {
                "fiscalYear": fy,
                "bonusPercent": to_float(row.get("bonus_share")),
                "cashPercent": to_float(row.get("cash_dividend")),
                "totalPercent": to_float(row.get("total_dividend")),
                "bookClosureDateAD": (row.get("bookclose_date") or "").strip(),
                "bookClosureDateBS": "",
                "distributionDateAD": (row.get("distribution_date") or "").strip(),
                "announcementDateAD": (row.get("announcement_date") or "").strip(),
                "bonusListingDateAD": (row.get("bonus_listing_date") or "").strip(),
                "closePrice": to_float(row.get("close")) if row.get("close") else None,
                "status": str(row.get("status", "")).strip(),
                "source": "hamroshare",
            }
            by_symbol.setdefault(sym, []).append(div_item)

    return by_symbol, company_names


# ── NepaliPaisa Fallback Fetcher ─────────────────────────────────────────────

def fetch_symbol_nepalipaisa(client: httpx.Client, symbol: str):
    """Fetch dividend history for one symbol from NepaliPaisa API.

    Returns:
        tuple[list[dict], str]: (list of standardized dividend dicts, companyName)
    """
    params = {
        "stockSymbol": symbol,
        "pageNo": 1,
        "itemsPerPage": ITEMS_PER_PAGE,
        "pagePerDisplay": 5,
    }
    r = client.get(NEPALIPAISA_API_URL, params=params, headers=NEPALIPAISA_HEADERS, timeout=20)
    r.raise_for_status()
    payload = r.json()
    if payload.get("statusCode") != 200:
        raise RuntimeError(f"API returned {payload.get('statusCode')}: {payload.get('message')}")
    raw_rows = (payload.get("result") or {}).get("data") or []

    company_name = ""
    dividends = []
    for row in raw_rows:
        if (row.get("stockSymbol") or "").upper() != symbol:
            continue
        if not company_name and row.get("companyName"):
            company_name = row["companyName"]

        fy = normalize_fy(row.get("fiscalYearBS", ""))
        dividends.append({
            "fiscalYear": fy,
            "bonusPercent": to_float(row.get("bonus")),
            "cashPercent": to_float(row.get("cash")),
            "totalPercent": to_float(row.get("totalDividend")),
            "bookClosureDateAD": (row.get("bookClosureDateAD") or "").strip(),
            "bookClosureDateBS": (row.get("bookClosureDateBS") or "").strip(),
            "distributionDateAD": (row.get("distributionDateAD") or "").strip(),
            "announcementDateAD": "",
            "bonusListingDateAD": "",
            "closePrice": None,
            "status": str(row.get("status", "")).strip(),
            "source": "nepalipaisa",
        })

    return dividends, company_name


# Legacy alias for test compatibility and lookup_dividend.py
def fetch_symbol(client: httpx.Client, symbol: str):
    """Legacy helper: returns raw NepaliPaisa rows for lookup_dividend.py."""
    params = {
        "stockSymbol": symbol,
        "pageNo": 1,
        "itemsPerPage": ITEMS_PER_PAGE,
        "pagePerDisplay": 5,
    }
    r = client.get(NEPALIPAISA_API_URL, params=params, headers=NEPALIPAISA_HEADERS, timeout=20)
    r.raise_for_status()
    payload = r.json()
    return (payload.get("result") or {}).get("data") or []


# ── Database Merging Logic ───────────────────────────────────────────────────

def merge_symbol_dividends(db: dict, symbol: str, company_name: str, new_rows: list[dict]) -> int:
    """Merge newly fetched dividends into db[symbol] structure.

    Follows WAT 'Database Data Merging' principles:
    - Never overwrites whole records.
    - Preserves user notes and existing fields (e.g. NepaliPaisa's BS closure date
      or HamroShare's announcement date).
    - Sorts newest fiscal year first.
    Returns count of new/updated entries.
    """
    entry = db.setdefault(symbol, {"symbol": symbol, "companyName": "", "dividends": []})
    if company_name and not entry.get("companyName"):
        entry["companyName"] = company_name

    changed = 0
    for new_div in new_rows:
        fy = new_div.get("fiscalYear", "")
        if not fy:
            continue

        existing = next((d for d in entry["dividends"] if d.get("fiscalYear") == fy), None)
        if existing:
            before = json.dumps(existing, sort_keys=True)
            # Preserve user notes
            notes = existing.get("notes", "")

            # If new_div is missing fields that existing already has, retain existing
            if not new_div.get("bookClosureDateBS") and existing.get("bookClosureDateBS"):
                new_div["bookClosureDateBS"] = existing["bookClosureDateBS"]
            if not new_div.get("bookClosureDateAD") and existing.get("bookClosureDateAD"):
                new_div["bookClosureDateAD"] = existing["bookClosureDateAD"]
            if not new_div.get("announcementDateAD") and existing.get("announcementDateAD"):
                new_div["announcementDateAD"] = existing["announcementDateAD"]
            if not new_div.get("bonusListingDateAD") and existing.get("bonusListingDateAD"):
                new_div["bonusListingDateAD"] = existing["bonusListingDateAD"]
            if new_div.get("closePrice") is None and existing.get("closePrice") is not None:
                new_div["closePrice"] = existing["closePrice"]
            if not new_div.get("distributionDateAD") and existing.get("distributionDateAD"):
                new_div["distributionDateAD"] = existing["distributionDateAD"]

            existing.update(new_div)
            if notes:
                existing["notes"] = notes

            if json.dumps(existing, sort_keys=True) != before:
                changed += 1
        else:
            div_to_add = dict(new_div)
            div_to_add["notes"] = ""
            entry["dividends"].append(div_to_add)
            changed += 1

    entry["dividends"].sort(key=lambda d: d.get("fiscalYear", ""), reverse=True)
    return changed


def archive_symbols():
    """Return list of all symbols present in db/fundamentals_archive."""
    try:
        return sorted(f[:-5].upper() for f in os.listdir(ARCHIVE_DIR)
                      if f.endswith(".json") and not f.startswith("_"))
    except OSError as e:
        print(f"[scrape_dividends] Could not read {ARCHIVE_DIR}: {e}")
        return []


# ── Main Orchestration ───────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Fetch NEPSE dividend announcements (HamroShare bulk + NepaliPaisa fallback)."
    )
    parser.add_argument("symbols", nargs="*", help="Symbols to fetch (default: all portfolio holdings)")
    parser.add_argument("--all", action="store_true",
                        help="Fetch every company in db/fundamentals_archive, not just holdings")
    parser.add_argument("--missing-only", action="store_true",
                        help="With --all, skip symbols that already have dividend rows (cheap top-up)")
    parser.add_argument("--source", choices=["auto", "hamroshare", "nepalipaisa"], default="auto",
                        help="Data source: auto (HamroShare bulk + NepaliPaisa fallback), hamroshare, nepalipaisa")
    parser.add_argument("--fy", help="Print a summary for this fiscal year (e.g. 081-082) after fetching")
    args = parser.parse_args()

    if args.symbols:
        symbols = [s.upper() for s in args.symbols]
    elif args.all:
        symbols = archive_symbols()
    else:
        portfolio = load_json(PORTFOLIO_PATH, {"holdings": []})
        symbols = sorted({h["symbol"].upper() for h in portfolio.get("holdings", [])})

    if not symbols:
        print("No symbols to fetch.")
        sys.exit(1)

    db = load_json(DIVIDEND_DB_PATH, {})

    if args.missing_only:
        have = {s for s, e in db.items() if (e or {}).get("dividends")}
        skipped = [s for s in symbols if s in have]
        symbols = [s for s in symbols if s not in have]
        print(f"--missing-only: skipping {len(skipped)} symbols that already have dividend rows.")
        if not symbols:
            print("Nothing left to fetch.")
            sys.exit(0)

    total_changed = 0
    failures = []
    unresolved_symbols = list(symbols)

    with httpx.Client() as client:
        # 1. Primary: HamroShare Bulk Fetch
        if args.source in ("auto", "hamroshare"):
            print(f"Fetching bulk dividends from HamroShare (target: {len(symbols)} symbols)...")
            try:
                hs_by_symbol, hs_cnames = fetch_hamroshare_bulk(client)
                print(f"  HamroShare returned announcements for {len(hs_by_symbol)} listed companies.")

                # Merge requested symbols
                matched_symbols = []
                for sym in symbols:
                    if sym in hs_by_symbol:
                        rows = hs_by_symbol[sym]
                        cname = hs_cnames.get(sym, "")
                        changed = merge_symbol_dividends(db, sym, cname, rows)
                        total_changed += changed
                        matched_symbols.append(sym)
                        print(f"  {sym} [HamroShare]: {len(rows)} announcements, {changed} new/updated")

                # Track remaining unresolved symbols
                unresolved_symbols = [s for s in symbols if s not in hs_by_symbol]
                if unresolved_symbols and args.source == "auto":
                    print(f"  {len(unresolved_symbols)} symbols not found in HamroShare bulk dataset "
                          f"(e.g. {', '.join(unresolved_symbols[:5])}). Checking fallback...")

            except Exception as e:
                print(f"  HamroShare bulk fetch failed: {e}")
                if args.source == "hamroshare":
                    failures.extend(symbols)
                    unresolved_symbols = []

        # 2. Fallback / Detail: NepaliPaisa Per-Symbol API
        if (args.source == "nepalipaisa" or (args.source == "auto" and unresolved_symbols)):
            fetch_list = symbols if args.source == "nepalipaisa" else unresolved_symbols
            print(f"Querying NepaliPaisa API for {len(fetch_list)} symbol(s) "
                  f"(~{len(fetch_list) * REQUEST_DELAY_SEC / 60:.1f} min)...")

            for i, sym in enumerate(fetch_list):
                try:
                    rows, cname = fetch_symbol_nepalipaisa(client, sym)
                    changed = merge_symbol_dividends(db, sym, cname, rows)
                    total_changed += changed
                    print(f"  {sym} [NepaliPaisa]: {len(rows)} announcements, {changed} new/updated")
                except Exception as e:
                    failures.append(sym)
                    print(f"  {sym} [NepaliPaisa]: FAILED ({e})")
                if i < len(fetch_list) - 1:
                    time.sleep(REQUEST_DELAY_SEC)

    # Save merged output
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
                    ann = f", announced {d['announcementDateAD']}" if d.get("announcementDateAD") else ""
                    print(f"  {sym}: bonus {d['bonusPercent']}% + cash {d['cashPercent']}% "
                          f"(book closure {d.get('bookClosureDateAD') or 'TBA'}{ann})")

    sys.exit(0 if not failures else 2)


if __name__ == "__main__":
    main()
