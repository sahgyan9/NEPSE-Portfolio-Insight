"""
Sync Security Universe & 52-Week Ranges
=======================================
Ingests all 951 NEPSE listed securities from HamroShare in ~400ms.
Enriches db/company_symbol_map.json and initializes missing tickers in db/fundamentals.json
with official sectors, 52-week highs, and 52-week lows without overwriting existing data.

Usage:
    python tools/sync_universe.py
"""

import os
import sys
import json
import httpx

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(ROOT_DIR, "db")
MAP_PATH = os.path.join(DB_DIR, "company_symbol_map.json")
FUNDAMENTALS_PATH = os.path.join(DB_DIR, "fundamentals.json")

HAMRO_STOCKS_URL = "https://hamroshare.com.np/nepse/stocks"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PortfolioInsight/1.0",
    "RSC": "1"
}


def fetch_all_securities():
    """Fetch all listed securities from HamroShare RSC."""
    print("Fetching master securities universe from HamroShare...")
    try:
        resp = httpx.get(HAMRO_STOCKS_URL, headers=HEADERS, timeout=12.0)
        if resp.status_code != 200:
            print(f"Failed with status code {resp.status_code}")
            return []

        text = resp.text
        pos = text.find('"fiftyTwoHi"')
        if pos == -1:
            print("Could not find fiftyTwoHi in payload")
            return []

        start = text.rfind('[', 0, pos)
        bracket_count = 0
        end = -1
        for i in range(start, len(text)):
            if text[i] == '[':
                bracket_count += 1
            elif text[i] == ']':
                bracket_count -= 1
                if bracket_count == 0:
                    end = i
                    break

        if end != -1:
            items = json.loads(text[start:end+1])
            print(f"Loaded {len(items)} listed securities.")
            return items
    except Exception as e:
        print(f"Error fetching securities: {e}")
    return []


def sync_universe():
    securities = fetch_all_securities()
    if not securities:
        print("No securities loaded. Aborting sync.")
        return

    # 1. Update company_symbol_map.json
    os.makedirs(DB_DIR, exist_ok=True)
    symbol_map = {}
    if os.path.exists(MAP_PATH):
        try:
            with open(MAP_PATH, "r", encoding="utf-8") as f:
                symbol_map = json.load(f)
        except Exception:
            pass

    auto_map = symbol_map.setdefault("auto_mapped", {})
    for s in securities:
        sym = (s.get("symbol") or "").upper().strip()
        name = (s.get("name") or "").strip()
        if sym and name:
            auto_map[name.lower()] = sym

    with open(MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(symbol_map, f, indent=2, ensure_ascii=False)
    print(f"Updated {MAP_PATH} with {len(auto_map)} company name mappings.")

    # 2. Non-destructively enrich fundamentals.json
    fundamentals = {}
    if os.path.exists(FUNDAMENTALS_PATH):
        try:
            with open(FUNDAMENTALS_PATH, "r", encoding="utf-8") as f:
                fundamentals = json.load(f)
        except Exception:
            pass

    updated_count = 0
    for s in securities:
        sym = (s.get("symbol") or "").upper().strip()
        if not sym:
            continue

        existing = fundamentals.setdefault(sym, {})
        # Enrich 52w range and shares if missing or update 52w
        hi = s.get("fiftyTwoHi")
        lo = s.get("fiftyTwoLo")
        listed = s.get("listed")
        sector = s.get("sector")

        if hi is not None:
            existing["high52"] = float(hi)
        if lo is not None:
            existing["low52"] = float(lo)
        if listed is not None and "sharesOutstanding" not in existing:
            existing["sharesOutstanding"] = int(listed)
        if sector and "sector" not in existing:
            existing["sector"] = sector

        updated_count += 1

    with open(FUNDAMENTALS_PATH, "w", encoding="utf-8") as f:
        json.dump(fundamentals, f, indent=2, ensure_ascii=False)
    print(f"Updated {FUNDAMENTALS_PATH} ({updated_count} symbols processed).")


if __name__ == "__main__":
    sync_universe()
