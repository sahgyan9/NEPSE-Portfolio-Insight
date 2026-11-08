"""
tools/harvest_all_quarterly.py
==============================
Harvests deep quarterly financial statements, balance sheets, and ratios for
every listed company on NEPSE.

Architecture:
1. Primary Source: HamroShare Next.js RSC (https://hamroshare.com.np/company/<SYM>)
   - Yields up to 18–27 quarters of full balance sheet + safety metrics in clean JSON
   - CAR, NPL, Cost of Funds, CD Ratio, Borrowings, Equity, Deposits, Loans, ROE, EPS
2. Fallback Source: NepseAlpha Direct (curl_cffi TLS impersonation)
   - Triggered automatically if a symbol lacks historical tables on HamroShare (e.g. CLI, RNLI)
3. Non-Destructive Storage:
   - db/quarterly/<SYM>.json: Appends new quarters, deep-merges existing quarters
   - db/fundamentals_archive/<SYM>.json: Appends dated quarterly snapshots
   - db/fundamentals.json: Merges snapshot fundamentals without overwriting unrelated fields
4. Auto-Recalculates Sector Leaders:
   - Updates db/quarterly_top_performers.json via tools/score_sector_leaders.py

Usage:
    python tools/harvest_all_quarterly.py --all
    python tools/harvest_all_quarterly.py --symbols NABIL SAHAS CBBL HDL
    python tools/harvest_all_quarterly.py --limit 10
    python tools/harvest_all_quarterly.py --resume
"""

import argparse
import glob
import json
import math
import os
import re
import sys
import time
import traceback
from datetime import datetime

import httpx

# Add project root and tools to sys.path
TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(TOOLS_DIR)
sys.path.insert(0, TOOLS_DIR)
sys.path.insert(0, ROOT_DIR)

import quarterly_db
from quarterly_db import normalize_sector, upsert_quarters, load_symbol_data

# Optional NepseAlpha fallback scraper
try:
    from scrape_nepsealpha_direct import (
        make_client as make_na_client,
        fetch_props,
        fetch_financials_html,
        parse_financials_table
    )
    HAVE_NEPSEALPHA = True
except ImportError:
    HAVE_NEPSEALPHA = False

DB_DIR = os.path.join(ROOT_DIR, "db")
ARCHIVE_DIR = os.path.join(DB_DIR, "fundamentals_archive")
FUNDAMENTALS_PATH = os.path.join(DB_DIR, "fundamentals.json")
STATUS_PATH = os.path.join(DB_DIR, "quarterly_sync_status.json")

HAMRO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "RSC": "1"
}

SKIP_SECTORS = {
    "mutual fund", "mutual funds", "debt", "bond", "debenture",
    "debentures", "preference shares"
}

def _num(v):
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def is_ratio_or_per_share(key: str) -> bool:
    """Identify per-share metrics, percentages, and regulatory ratios that should not be scaled by 1,000."""
    k = key.lower()
    return any(term in k for term in [
        "ratio", "rate", "npl", "car", "cost of funds", "spread",
        "eps", "book value", "roe", "roa", "yield", "margin", "%",
        "per share", "pe", "pb", "pvb"
    ])


def lookup_company_meta(symbol: str) -> dict:
    """Find company name and sector from local databases."""
    symbol = symbol.upper()
    name = symbol
    sector = "Others"

    # Check company_symbol_map
    map_path = os.path.join(DB_DIR, "company_symbol_map.json")
    if os.path.exists(map_path):
        try:
            with open(map_path, "r", encoding="utf-8") as f:
                smap = json.load(f)
                for sec_key, items in smap.items():
                    if sec_key.startswith("_") or not isinstance(items, dict):
                        continue
                    for comp_name, sym in items.items():
                        if sym.upper() == symbol:
                            name = comp_name.title()
                            sector = normalize_sector(sec_key)
                            return {"symbol": symbol, "name": name, "sector": sector}
        except Exception:
            pass

    # Check fundamentals.json
    if os.path.exists(FUNDAMENTALS_PATH):
        try:
            with open(FUNDAMENTALS_PATH, "r", encoding="utf-8") as f:
                f_db = json.load(f)
                if symbol in f_db:
                    info = f_db[symbol]
                    name = info.get("companyName") or info.get("name") or name
                    sector = normalize_sector(info.get("sector"))
                    return {"symbol": symbol, "name": name, "sector": sector}
        except Exception:
            pass

    return {"symbol": symbol, "name": name, "sector": sector}


def load_sync_status() -> dict:
    if os.path.exists(STATUS_PATH):
        try:
            with open(STATUS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "status": "idle",
        "last_sync": None,
        "total": 0,
        "synced": 0,
        "current_symbol": None,
        "errors": []
    }


def save_sync_status(status_dict: dict):
    try:
        os.makedirs(DB_DIR, exist_ok=True)
        with open(STATUS_PATH, "w", encoding="utf-8") as f:
            json.dump(status_dict, f, indent=2)
    except Exception as e:
        print(f"[sync_status] Failed to write status: {e}")


def get_market_universe(client: httpx.Client) -> list:
    """Fetch complete list of tradeable operating companies from HamroShare live-market."""
    print("[universe] Fetching live market universe from HamroShare...")
    stocks = {}
    try:
        r = client.get("https://hamroshare.com.np/nepse/live-market", headers=HAMRO_HEADERS, timeout=12.0)
        if r.status_code == 200:
            text = r.text
            # Match standard array rows or securityId object rows
            row_matches = re.findall(r'\{"securityId":"\d+","securityName":"[^"]+","symbol":"[A-Z0-9]+"[^}]*\}', text)
            for rm in row_matches:
                try:
                    item = json.loads(rm)
                    sym = (item.get("symbol") or "").upper()
                    sec_name = item.get("securityName")
                    sec = normalize_sector(item.get("sector"), name=sec_name)
                    if sym and sec not in ("Mutual Fund", "Debt"):
                        stocks[sym] = {
                            "symbol": sym,
                            "name": sec_name or sym,
                            "sector": sec,
                            "ltp": _num(item.get("lastTradedPrice") or item.get("ltp") or item.get("closePrice")),
                            "change_pct": _num(item.get("percentageChange") or item.get("changePct")),
                            "high52": _num(item.get("fiftyTwoWeekHigh") or item.get("highPrice")),
                            "low52": _num(item.get("fiftyTwoWeekLow") or item.get("lowPrice")),
                            "volume": _num(item.get("totalTradeQuantity") or item.get("volume")),
                            "turnover": _num(item.get("totalTradeValue") or item.get("totalTurnover") or item.get("turnover")),
                        }
                except Exception:
                    pass

            matches = re.findall(r'\[\{"symbol":"[A-Z0-9]+"[^\]]*\}\]', text)
            for m in matches:
                try:
                    arr = json.loads(m)
                    for item in arr:
                        sym = (item.get("symbol") or "").upper()
                        sec_name = item.get("name") or item.get("companyName")
                        sec = normalize_sector(item.get("sector"), name=sec_name)
                        if sym and sec not in ("Mutual Fund", "Debt"):
                            stocks[sym] = {
                                "symbol": sym,
                                "name": sec_name or sym,
                                "sector": sec,
                                "ltp": _num(item.get("lastTradedPrice") or item.get("ltp") or item.get("closePrice")),
                                "change_pct": _num(item.get("percentageChange") or item.get("changePct")),
                                "high52": _num(item.get("fiftyTwoWeekHigh")),
                                "low52": _num(item.get("fiftyTwoWeekLow")),
                                "volume": _num(item.get("totalTradeQuantity") or item.get("volume")),
                                "turnover": _num(item.get("totalTurnover") or item.get("turnover")),
                            }
                except Exception:
                    pass
    except Exception as e:
        print(f"[universe] HamroShare live-market fetch error: {e}")

    # Merge with symbols from db/company_symbol_map.json
    map_path = os.path.join(DB_DIR, "company_symbol_map.json")
    if os.path.exists(map_path):
        try:
            with open(map_path, "r", encoding="utf-8") as f:
                smap = json.load(f)
                for sec_key, items in smap.items():
                    if sec_key.startswith("_"):
                        continue
                    if isinstance(items, dict):
                        for name, sym in items.items():
                            sym = sym.upper()
                            if sym and sym not in stocks:
                                stocks[sym] = {
                                    "symbol": sym,
                                    "name": name.title(),
                                    "sector": normalize_sector(sec_key),
                                }
        except Exception as e:
            print(f"[universe] company_symbol_map parse error: {e}")

    # Merge with existing fundamentals.json symbols
    if os.path.exists(FUNDAMENTALS_PATH):
        try:
            with open(FUNDAMENTALS_PATH, "r", encoding="utf-8") as f:
                f_db = json.load(f)
                for sym, info in f_db.items():
                    sym = sym.upper()
                    sec = info.get("sector")
                    if normalize_sector(sec) in ("Mutual Fund", "Debt"):
                        continue
                    if sym not in stocks:
                        stocks[sym] = {
                            "symbol": sym,
                            "name": info.get("companyName") or info.get("name") or sym,
                            "sector": normalize_sector(sec),
                            "ltp": _num(info.get("ltp")),
                            "high52": _num(info.get("high52")),
                            "low52": _num(info.get("low52")),
                        }
        except Exception:
            pass

    symbols_list = sorted(stocks.values(), key=lambda x: x["symbol"])
    print(f"[universe] Found {len(symbols_list)} listed operating companies.")
    return symbols_list


def parse_hamroshare_response(symbol: str, text: str) -> tuple:
    """Parse HamroShare company page RSC stream into structured quarters + snapshot."""
    matches = re.findall(r'\[\{[^{}]*"fyq"[^\]]*\}\]', text)
    if not matches:
        return [], {}

    try:
        raw_quarters = json.loads(matches[0])
    except Exception:
        return [], {}

    # Extract report snapshot metadata
    report_match = re.search(r'"report":(\{.*?"bonus":\{.*?\}\})', text)
    report_data = json.loads(report_match.group(1)) if report_match else {}

    # Extract sector and company name if present in text
    sec_match = re.search(r'"sector":\s*"([^"]+)"', text)
    extracted_sec = normalize_sector(sec_match.group(1)) if sec_match else None

    name_match = re.search(r'"companyName":\s*"([^"]+)"', text)
    extracted_name = name_match.group(1) if name_match else None

    # Extract general stock header metadata (peers, sector, high/low, lastPrice)
    peers_match = re.search(r'\{"symbol":"' + symbol + r'".*?"turnover":([0-9.]+)\}', text)
    stock_meta = {}
    if peers_match:
        try:
            stock_meta = json.loads(peers_match.group(0))
        except Exception:
            pass

    quarters = []
    for row in raw_quarters:
        fyq = row.get("fyq")
        if not fyq:
            continue
        m = re.match(r'(\d{3})-(\d{3})Q(\d)', fyq)
        if not m:
            continue
        fy = f"20{m.group(1)[1:]}-{m.group(2)[1:]}"
        short_fy = f"{m.group(1)[1:]}-{m.group(2)[1:]}"
        q = int(m.group(3))

        raw_dict = {}
        ordered_keys = []
        for k, v in row.items():
            if k == "fyq" or v is None:
                continue
            ordered_keys.append(k)
            num_v = _num(v)
            if num_v is not None:
                if is_ratio_or_per_share(k):
                    raw_dict[k] = round(num_v, 2)
                elif k == "Number of Shares":
                    raw_dict[k] = num_v
                else:
                    # HamroShare numbers are in thousands (000'), convert to raw Rs
                    raw_dict[k] = round(num_v * 1000.0, 2)

        eps = raw_dict.get("EPS Reported") or raw_dict.get("EPS(Rs.)") or raw_dict.get("EPS")
        bvps = raw_dict.get("Book Value Reported") or raw_dict.get("Book Value(Rs.)") or raw_dict.get("Book Value")
        roe = raw_dict.get("ROE Reported") or raw_dict.get("ROE") or raw_dict.get("ROE %")
        roa = raw_dict.get("ROA Reported") or raw_dict.get("ROA") or raw_dict.get("ROA %")
        net_profit = raw_dict.get("Net Profit")
        revenue = (raw_dict.get("Revenue") or
                   raw_dict.get("Revenue from Operation") or
                   raw_dict.get("Interest Income") or
                   raw_dict.get("Total Operating Income"))

        computed = {
            "eps_ttm": eps,
            "bvps": bvps,
            "roe_ttm": roe,
            "roa_ttm": roa,
            "net_profit_ttm": net_profit,
            "revenue_ttm": revenue,
        }
        if eps and bvps and eps > 0 and bvps > 0:
            computed["graham_number"] = round(math.sqrt(22.5 * eps * bvps), 2)

        quarters.append({
            "symbol": symbol.upper(),
            "fy": fy,
            "quarter": q,
            "quarter_label": f"Q{q} {short_fy}",
            "parsed_at": datetime.now().isoformat(),
            "raw": raw_dict,
            "raw_keys_order": ordered_keys,
            "computed": computed,
            "yoy": {}
        })

    # Sort quarters chronologically oldest -> newest to compute accurate YoY growth
    quarters.sort(key=quarterly_db._sort_key)

    # Compute YoY growth across the quarters: compare quarter i with quarter i-4
    for i in range(len(quarters)):
        curr_raw = quarters[i]["raw"]
        curr_comp = quarters[i]["computed"]
        yoy = {}
        if i >= 4:
            prev_raw = quarters[i - 4]["raw"]
            prev_comp = quarters[i - 4]["computed"]

            for k in ("eps_ttm", "bvps", "net_profit_ttm", "revenue_ttm"):
                v_curr = curr_comp.get(k)
                v_prev = prev_comp.get(k)
                if v_curr is not None and v_prev is not None and v_prev != 0:
                    yoy[k] = round(((v_curr - v_prev) / abs(v_prev)) * 100.0, 2)

            for k, v_curr in curr_raw.items():
                if k in prev_raw:
                    v_prev = prev_raw[k]
                    if v_curr is not None and v_prev is not None and v_prev != 0:
                        yoy[k] = round(((v_curr - v_prev) / abs(v_prev)) * 100.0, 2)

        quarters[i]["yoy"] = yoy

    # Build snapshot dict
    snapshot = {}
    if quarters:
        latest = quarters[-1]
        c = latest["computed"]
        r = latest["raw"]
        ltp = _num(stock_meta.get("lastPrice"))
        eps_v = c.get("eps_ttm")
        bvps_v = c.get("bvps")
        pe_v = _num(report_data.get("peRatio")) or (round(ltp / eps_v, 2) if (ltp and eps_v and eps_v > 0) else None)
        pb_v = _num(report_data.get("pvb")) or (round(ltp / bvps_v, 2) if (ltp and bvps_v and bvps_v > 0) else None)

        snapshot = {
            "reported_quarter": f"{latest['fy']}-Q{latest['quarter']}",
            "fiscal_year": latest["fy"],
            "quarter": latest["quarter"],
            "ltp_at_capture": ltp,
            "pe_ratio": pe_v,
            "pb_ratio": pb_v,
            "eps_ttm": eps_v,
            "book_value": bvps_v,
            "roe": c.get("roe_ttm"),
            "roa": c.get("roa_ttm"),
            "graham_number": c.get("graham_number"),
            "net_profit_ttm": c.get("net_profit_ttm"),
            "revenue_ttm": c.get("revenue_ttm"),
            "shares_outstanding": r.get("Number of Shares"),
            "week52_high": _num(stock_meta.get("fiftyTwoWeekHigh")),
            "week52_low": _num(stock_meta.get("fiftyTwoWeekLow")),
            "trade_turnover": _num(stock_meta.get("turnover")),
            "captured_at": datetime.now().strftime("%Y-%m-%d"),
            "sector": extracted_sec,
            "name": extracted_name,
        }

    return quarters, snapshot


def fallback_nepsealpha_fetch(symbol: str) -> tuple:
    """Fallback fetch via NepseAlpha direct client if HamroShare lacks historical tables."""
    if not HAVE_NEPSEALPHA:
        return [], {}

    print(f"  [{symbol}] Falling back to NepseAlpha direct fetch...")
    try:
        with make_na_client() as client:
            props = fetch_props(client, symbol)
            html = fetch_financials_html(client, symbol)
            parsed_table = parse_financials_table(html)

        growths = props.get("quartesGrowths") or []
        master = props.get("masterData") or {}
        funda = props.get("funda_table") or {}

        # Parse financials table
        fin_data = {}
        ordered_keys = []
        bs_yoy = {}
        if parsed_table:
            hdr, rows = parsed_table
            col_to_key = {}
            for i, h in enumerate(hdr):
                m = re.match(r'.*?(\d{3})-(\d{3})Q(\d).*?', h)
                if m:
                    fy = f"20{m.group(1)[1:]}-{m.group(2)[1:]}"
                    q = int(m.group(3))
                    col_to_key[i] = f"{fy}-Q{q}"

            yoy_col = next((i for i, h in enumerate(hdr) if "yoy" in h.lower()), -1)
            for r in rows:
                if not r or not r[0]:
                    continue
                label = r[0]
                if label not in ordered_keys:
                    ordered_keys.append(label)
                if yoy_col != -1 and yoy_col < len(r):
                    y_val = _num(r[yoy_col].replace("%", "").replace(",", ""))
                    if y_val is not None:
                        bs_yoy[label] = y_val
                for i, cell in enumerate(r):
                    if i in col_to_key:
                        fq_k = col_to_key[i]
                        fin_data.setdefault(fq_k, {})
                        val = _num(cell.replace("%", "").replace(",", ""))
                        if val is not None:
                            lower = label.lower()
                            if ("%" in cell or "eps" in lower or "book value" in lower or
                                "shares" in lower or "npl" in lower or "rate" in lower or
                                "ratio" in lower or "car" in lower or "spread" in lower):
                                fin_data[fq_k][label] = val
                            else:
                                fin_data[fq_k][label] = val * 1000.0

        # Group growths by quarter
        by_quarter = {}
        for item in growths:
            fy = item.get("fiscal_year")
            q = item.get("quarter")
            if not fy or not q:
                continue
            fy_parts = fy.split("-")
            full_fy = f"20{fy_parts[0][1:]}-{fy_parts[1][1:]}" if len(fy_parts) == 2 else fy
            k = f"{full_fy}-Q{q}"
            by_quarter.setdefault(k, {})[item.get("particulars")] = item.get("value")

        quarters = []
        for fq_k, g_dict in by_quarter.items():
            parts = fq_k.rsplit("-Q", 1)
            fy = parts[0]
            q = int(parts[1])
            short_fy = fy[2:] if fy.startswith("20") else fy

            raw = fin_data.get(fq_k, {})
            computed = {
                "eps_ttm": _num(g_dict.get("eps_ttm")) or _num(raw.get("EPS Reported")),
                "bvps": (_num(g_dict.get("bvps")) / _num(master.get("shares_outstnading"))
                         if (_num(g_dict.get("bvps")) and _num(master.get("shares_outstnading")))
                         else _num(raw.get("Book Value Reported"))),
                "roe_ttm": (_num(g_dict.get("roe_ttm")) * 100.0 if _num(g_dict.get("roe_ttm")) is not None
                            else _num(raw.get("ROE Reported"))),
                "roa_ttm": (_num(g_dict.get("roa_ttm")) * 100.0 if _num(g_dict.get("roa_ttm")) is not None
                            else _num(raw.get("ROA Reported"))),
                "net_profit_ttm": _num(g_dict.get("net_profit_ttm")),
                "revenue_ttm": _num(g_dict.get("revenue_ttm")),
            }
            if computed["eps_ttm"] and computed["bvps"] and computed["eps_ttm"] > 0 and computed["bvps"] > 0:
                computed["graham_number"] = round(math.sqrt(22.5 * computed["eps_ttm"] * computed["bvps"]), 2)

            quarters.append({
                "symbol": symbol.upper(),
                "fy": fy,
                "quarter": q,
                "quarter_label": f"Q{q} {short_fy}",
                "parsed_at": datetime.now().isoformat(),
                "raw": raw,
                "raw_keys_order": ordered_keys,
                "computed": computed,
                "yoy": bs_yoy
            })

        quarters.sort(key=quarterly_db._sort_key)

        snapshot = {}
        if quarters:
            latest = quarters[-1]
            c = latest["computed"]
            snapshot = {
                "reported_quarter": f"{latest['fy']}-Q{latest['quarter']}",
                "fiscal_year": latest["fy"],
                "quarter": latest["quarter"],
                "ltp_at_capture": _num(funda.get("ltp")),
                "pe_ratio": _num(funda.get("pe_ratio")),
                "pb_ratio": _num(funda.get("pb_ratio")),
                "eps_ttm": c.get("eps_ttm"),
                "book_value": c.get("bvps"),
                "roe": c.get("roe_ttm"),
                "roa": c.get("roa_ttm"),
                "graham_number": c.get("graham_number"),
                "shares_outstanding": _num(master.get("shares_outstnading")),
                "week52_high": _num(master.get("_52_weeks_hi")),
                "week52_low": _num(master.get("_52_weeks_lo")),
                "captured_at": datetime.now().strftime("%Y-%m-%d"),
            }

        return quarters, snapshot

    except Exception as e:
        print(f"  [{symbol}] NepseAlpha fallback error: {e}")
        return [], {}


def upsert_archive_snapshot(symbol: str, company_name: str, sector: str, snapshot: dict):
    """Update or append to db/fundamentals_archive/<SYM>.json."""
    if not snapshot or not snapshot.get("reported_quarter"):
        return
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    path = os.path.join(ARCHIVE_DIR, f"{symbol.upper()}.json")
    doc = {"symbol": symbol.upper(), "full_name": company_name, "sector": sector, "snapshots": []}
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                doc = json.load(f)
        except Exception:
            pass

    doc["symbol"] = symbol.upper()
    if company_name:
        doc["full_name"] = company_name
    if sector:
        doc["sector"] = sector

    snaps = doc.setdefault("snapshots", [])
    existing = next((s for s in snaps if s.get("reported_quarter") == snapshot.get("reported_quarter")), None)
    if existing:
        existing.update(snapshot)
    else:
        snaps.append(snapshot)

    snaps.sort(key=lambda s: (s.get("fiscal_year", ""), s.get("quarter", 0)))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)


def merge_fundamentals_json(symbol: str, meta: dict, snapshot: dict):
    """Non-destructively merge newly harvested fields into db/fundamentals.json."""
    os.makedirs(DB_DIR, exist_ok=True)
    data = {}
    if os.path.exists(FUNDAMENTALS_PATH):
        try:
            with open(FUNDAMENTALS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            pass

    record = data.setdefault(symbol.upper(), {})
    if meta.get("name"):
        record["companyName"] = meta["name"]
    if meta.get("sector"):
        record["sector"] = meta["sector"]

    for k_snap, k_fund in [
        ("ltp_at_capture", "ltp"),
        ("pe_ratio", "peRatio"),
        ("pb_ratio", "pbRatio"),
        ("eps_ttm", "eps"),
        ("book_value", "bookValue"),
        ("roe", "roe"),
        ("roa", "roa"),
        ("shares_outstanding", "sharesOutstanding"),
        ("week52_high", "high52"),
        ("week52_low", "low52"),
        ("trade_turnover", "tradeTurnover"),
        ("captured_at", "capturedAt"),
    ]:
        v = snapshot.get(k_snap)
        if v is not None:
            record[k_fund] = v

    with open(FUNDAMENTALS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def harvest_symbol(client: httpx.Client, symbol_meta: dict, force: bool = False, max_age_days: int = 7) -> bool:
    """Harvest one symbol using HamroShare primary and NepseAlpha fallback."""
    symbol = symbol_meta["symbol"].upper()
    comp_name = symbol_meta.get("name") or symbol
    sec = symbol_meta.get("sector") or "Others"

    # Check freshness
    q_data = load_symbol_data(symbol)
    if not force and q_data.get("last_updated"):
        try:
            last_dt = datetime.fromisoformat(q_data["last_updated"])
            age_days = (datetime.now() - last_dt).total_seconds() / 86400.0
            if age_days < max_age_days and len(q_data.get("quarters", [])) >= 4:
                return True
        except Exception:
            pass

    # 1. Primary Fetch: HamroShare RSC
    quarters, snapshot = [], {}
    try:
        url = f"https://hamroshare.com.np/company/{symbol}"
        resp = client.get(url, headers=HAMRO_HEADERS, timeout=12.0)
        if resp.status_code == 200:
            quarters, snapshot = parse_hamroshare_response(symbol, resp.text)
    except Exception as e:
        print(f"  [{symbol}] HamroShare fetch error: {e}")

    # 2. Fallback Fetch: NepseAlpha
    if not quarters:
        quarters, snapshot = fallback_nepsealpha_fetch(symbol)

    if not quarters:
        print(f"  [{symbol}] No quarterly data available from HamroShare or NepseAlpha.")
        return False

    if snapshot.get("sector"):
        sec = snapshot["sector"]
    if snapshot.get("name") and (comp_name == symbol or not comp_name or len(snapshot["name"]) > len(comp_name)):
        comp_name = snapshot["name"]
    sec = normalize_sector(sec, name=comp_name)

    # 3. Non-destructive Ingestion
    upsert_quarters(symbol, quarters, company_name=comp_name, sector=sec)
    upsert_archive_snapshot(symbol, comp_name, sec, snapshot)
    symbol_meta["sector"] = sec
    symbol_meta["name"] = comp_name
    merge_fundamentals_json(symbol, symbol_meta, snapshot)

    print(f"  [{symbol}] Successfully synced {len(quarters)} quarters (latest: {quarters[-1]['quarter_label']}).")
    return True


def run_harvest(symbols: list | None = None, limit: int | None = None,
                resume: bool = False, force: bool = False, max_age_days: int = 7) -> dict:
    """Run full or targeted harvest with checkpointing."""
    status = load_sync_status()
    status["status"] = "running"
    save_sync_status(status)

    failures = []
    success_count = 0

    with httpx.Client(timeout=15.0, follow_redirects=True) as client:
        # Determine universe
        if symbols:
            universe = [lookup_company_meta(s) for s in symbols]
        else:
            universe = get_market_universe(client)
            # Prioritize active portfolio holdings at the front of the universe
            try:
                portfolio_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db", "portfolio.json")
                if os.path.exists(portfolio_file):
                    with open(portfolio_file, "r", encoding="utf-8") as pf:
                        p_data = json.load(pf)
                    port_syms = {h["symbol"].upper() for h in p_data.get("holdings", []) if h.get("symbol")}
                    port_items = [u for u in universe if u["symbol"].upper() in port_syms]
                    other_items = [u for u in universe if u["symbol"].upper() not in port_syms]
                    universe = port_items + other_items
            except Exception:
                pass

        if limit and limit > 0:
            universe = universe[:limit]

        status["total"] = len(universe)
        save_sync_status(status)

        # Check existing progress if resume
        start_idx = 0
        if resume and status.get("current_symbol"):
            curr = status["current_symbol"]
            for idx, item in enumerate(universe):
                if item["symbol"] == curr:
                    start_idx = idx
                    break

        print(f"[harvest] Starting sync for {len(universe)} symbols (from index {start_idx})...")
        for i in range(start_idx, len(universe)):
            item = universe[i]
            sym = item["symbol"]
            status["current_symbol"] = sym
            status["synced"] = i

            # Periodic status save
            if i % 5 == 0:
                save_sync_status(status)

            try:
                ok = harvest_symbol(client, item, force=force, max_age_days=max_age_days)
                if ok:
                    success_count += 1
                else:
                    failures.append(sym)
            except Exception as e:
                print(f"  [{sym}] Harvest exception: {e}")
                traceback.print_exc()
                failures.append(sym)

            time.sleep(0.3)  # Polite delay

    status["status"] = "idle"
    status["last_sync"] = datetime.now().isoformat()
    status["synced"] = len(universe)
    status["errors"] = failures
    status["current_symbol"] = None
    save_sync_status(status)

    print(f"\n[harvest] Finished! Success: {success_count}, Failures: {len(failures)}")
    if failures:
        print(f"[harvest] Failed symbols: {', '.join(failures[:20])}")

    # Recalculate Sector Leaders
    try:
        import score_sector_leaders
        print("[harvest] Refreshing Sector Leaders / Intelligence rankings...")
        score_sector_leaders.export_top_performers(top_n=3)
    except Exception as e:
        print(f"[harvest] Failed to export sector leaders: {e}")

    return {
        "total": len(universe),
        "success": success_count,
        "failed": len(failures),
        "failures": failures
    }


def main():
    parser = argparse.ArgumentParser(description="Harvest NEPSE quarterly financial statements and ratios.")
    parser.add_argument("--all", action="store_true", help="Harvest all listed operating companies")
    parser.add_argument("--symbols", nargs="*", help="Specific stock symbols to harvest")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of companies to harvest")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    parser.add_argument("--force", action="store_true", help="Force refresh even if recently fetched")
    parser.add_argument("--max-age-days", type=int, default=7, help="Max age in days before re-harvesting")
    args = parser.parse_args()

    symbols = [s.upper() for s in args.symbols] if args.symbols else None
    run_harvest(
        symbols=symbols,
        limit=args.limit,
        resume=args.resume,
        force=args.force,
        max_age_days=args.max_age_days
    )


if __name__ == "__main__":
    main()
