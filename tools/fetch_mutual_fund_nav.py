"""
Mutual Fund NAV Scraper
=======================
Deterministic tool for fetching Net Asset Value (NAV) for open-ended mutual funds in Nepal.
Currently supports:
  - NIBLSF (NIBL Sahabhagita Fund) via NIMB Ace Capital

Usage:
  python tools/fetch_mutual_fund_nav.py
  python tools/fetch_mutual_fund_nav.py --symbol NIBLSF
  python tools/fetch_mutual_fund_nav.py --symbol NIBLSF --update-db
"""

import os
import sys
import json
import re
import argparse
import httpx
from bs4 import BeautifulSoup
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "db", "fundamentals.json")

NIMB_URL = "https://nimbacecapital.com/nav-nibl-sahabhagita-fund/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch_niblsf_nav(client=None) -> dict:
    """
    Fetch live NAV and metadata for NIBL Sahabhagita Fund (NIBLSF)
    directly from NIMB Ace Capital's NAV portal.
    """
    should_close = False
    if client is None:
        client = httpx.Client(headers=HEADERS, timeout=12.0, follow_redirects=True)
        should_close = True

    try:
        resp = client.get(NIMB_URL)
        resp.raise_for_status()
    finally:
        if should_close:
            client.close()

    soup = BeautifulSoup(resp.text, "html.parser")
    result = {
        "symbol": "NIBLSF",
        "name": "NIBL Sahabhagita Fund",
        "sector": "Mutual Fund",
        "nav": None,
        "date": None,
        "change": 0.0,
        "change_pct": 0.0,
        "previous_close": None,
        "source": "nimbacecapital",
        "captured_at": datetime.now().isoformat(),
    }

    # 1. Parse Table 0 (Summary NAV Card)
    # Expected rows:
    # Row 0: Net Assets Value (NAV) Date: DD/MM/YYYY
    # Row 1: NAV | 10.14
    # Row 2: Difference | 0.03
    # Row 3: Difference Percent | 0.30%
    tables = soup.find_all("table")
    if tables:
        t0 = tables[0]
        for tr in t0.find_all("tr"):
            cols = [td.get_text(strip=True) for td in tr.find_all(["th", "td"])]
            if not cols:
                continue
            header_cell = cols[0]
            if "Date:" in header_cell:
                date_match = re.search(r"Date:\s*([0-9/.\-]+)", header_cell)
                if date_match:
                    result["date"] = date_match.group(1)
            elif len(cols) >= 2:
                key = cols[0].lower()
                raw_val = cols[1].replace(",", "").strip()
                if "nav" in key:
                    try:
                        result["nav"] = float(raw_val)
                    except ValueError:
                        pass
                elif "difference percent" in key:
                    clean_pct = raw_val.replace("%", "").strip()
                    try:
                        result["change_pct"] = float(clean_pct)
                    except ValueError:
                        pass
                elif "difference" in key:
                    try:
                        result["change"] = float(raw_val)
                    except ValueError:
                        pass

    if result["nav"] is not None and result["change"] is not None:
        result["previous_close"] = round(result["nav"] - result["change"], 4)

    # 2. Extract historical series from script datasets
    history_match = re.search(r"let datasets\s*=\s*(\{.*?\});", resp.text)
    if history_match:
        try:
            raw_datasets = history_match.group(1).replace(r"\/", "/")
            result["history"] = json.loads(raw_datasets)
        except Exception:
            pass

    # 3. Parse Scheme Summary (Table 2 if present)
    if len(tables) > 2:
        t2 = tables[2]
        for tr in t2.find_all("tr"):
            cols = [td.get_text(strip=True) for td in tr.find_all(["th", "td"])]
            if len(cols) >= 2:
                row_label = cols[0].lower()
                row_val = cols[-1].replace(",", "").strip()
                if "existing fund size" in row_label:
                    result["fund_size"] = row_val
                elif "existing no. of units" in row_label:
                    result["total_units"] = row_val

    return result


def get_nav_data(symbol: str = "NIBLSF") -> dict:
    """Dispatcher for mutual fund symbols."""
    sym = symbol.upper().strip()
    if sym == "NIBLSF":
        return fetch_niblsf_nav()
    raise ValueError(f"Open-ended NAV fetching not implemented for symbol: {symbol}")


def update_fundamentals_db(nav_data: dict):
    """
    Merge NAV data into db/fundamentals.json without overwriting existing keys.
    """
    symbol = nav_data.get("symbol")
    if not symbol or nav_data.get("nav") is None:
        print("[fetch_mutual_fund_nav] Invalid NAV payload; skipping database update.")
        return

    db = {}
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, "r", encoding="utf-8-sig") as f:
                db = json.load(f)
        except Exception as e:
            print(f"[fetch_mutual_fund_nav] Error reading {DB_PATH}: {e}")

    existing = db.get(symbol, {})
    existing["nav"] = nav_data["nav"]
    existing["navDate"] = nav_data.get("date")
    existing["navChange"] = nav_data.get("change")
    existing["navChangePct"] = nav_data.get("change_pct")
    existing["lastTradeDate"] = nav_data.get("date")
    existing["last_traded_price"] = nav_data["nav"]
    existing["sector"] = nav_data.get("sector", "Mutual Fund")
    existing["capturedAt"] = nav_data.get("captured_at")
    if nav_data.get("fund_size"):
        existing["fundSize"] = nav_data["fund_size"]
    if nav_data.get("total_units"):
        existing["sharesOutstanding"] = nav_data["total_units"]

    db[symbol] = existing

    tmp_path = DB_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)
    os.replace(tmp_path, DB_PATH)
    print(f"[fetch_mutual_fund_nav] Successfully updated {symbol} in {DB_PATH} with NAV {nav_data['nav']}")


def main():
    parser = argparse.ArgumentParser(description="Fetch open-ended mutual fund NAV")
    parser.add_argument("--symbol", default="NIBLSF", help="Mutual fund symbol (default: NIBLSF)")
    parser.add_argument("--update-db", action="store_true", help="Persist NAV into db/fundamentals.json")
    args = parser.parse_args()

    try:
        data = get_nav_data(args.symbol)
        print(f"Symbol:          {data['symbol']}")
        print(f"Name:            {data['name']}")
        print(f"NAV:             {data['nav']}")
        print(f"Date:            {data['date']}")
        print(f"Change:          {data['change']} ({data['change_pct']}%)")
        print(f"Previous Close:  {data.get('previous_close')}")
        if data.get("fund_size"):
            print(f"Fund Size:       {data['fund_size']}")
        if data.get("total_units"):
            print(f"Total Units:     {data['total_units']}")

        if args.update_db:
            update_fundamentals_db(data)
    except Exception as e:
        print(f"Error fetching NAV for {args.symbol}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
