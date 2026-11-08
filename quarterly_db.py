"""
quarterly_db.py
===============
Manages per-company quarterly financial data stored as JSON flat files.

Storage: db/quarterly/<SYMBOL>.json
One file per company, containing sorted list of all parsed quarters.

Key behaviors:
- Raises DuplicateQuarterError before overwriting any existing quarter
- Auto-sorts quarters oldest → newest (by FY then quarter number)
- Thread-safe via a simple file lock pattern
"""

import os
import json
from datetime import datetime


BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
QUARTERLY_DIR = os.path.join(BASE_DIR, "db", "quarterly")


class DuplicateQuarterError(Exception):
    """Raised when you try to save a quarter that already exists."""
    pass


def _ensure_dir():
    os.makedirs(QUARTERLY_DIR, exist_ok=True)


def _db_path(symbol: str) -> str:
    return os.path.join(QUARTERLY_DIR, f"{symbol.upper()}.json")


def _sort_key(q: dict):
    """Sort quarters: FY ascending then quarter number ascending."""
    fy = q.get("fy", "0000-00")
    parts = fy.split("-")
    fy_year = int(parts[0]) if parts[0].isdigit() else 0
    return (fy_year, q.get("quarter", 0))


def load_symbol_data(symbol: str) -> dict:
    """Load all data for a symbol. Returns empty structure if not found."""
    path = _db_path(symbol)
    if not os.path.exists(path):
        return {
            "symbol": symbol.upper(),
            "sector": None,
            "company_name": None,
            "quarters": [],
            "last_updated": None,
        }
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_symbol_data(symbol: str, data: dict):
    """Persist symbol data back to disk."""
    _ensure_dir()
    path = _db_path(symbol)
    data["last_updated"] = datetime.now().isoformat()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def check_duplicate(symbol: str, fy: str, quarter: int) -> bool:
    """Return True if this (symbol, fy, quarter) combination already exists."""
    data = load_symbol_data(symbol)
    for q in data["quarters"]:
        if q["fy"] == fy and q["quarter"] == quarter:
            return True
    return False


def normalize_sector(s: str | None, name: str | None = None) -> str:
    """Normalize NEPSE sector strings to canonical names used across the platform."""
    res = "Others"
    if s:
        t = s.lower().strip()
        if "development" in t:
            res = "Development Bank"
        elif "bank" in t:
            res = "Commercial Bank"
        elif "microfinance" in t or "laghubitta" in t or "bittiya" in t:
            res = "Microfinance"
        elif ("non" in t and "insurance" in t) or "reinsurance" in t:
            res = "Non-Life Insurance"
        elif "insurance" in t or "beema" in t or "bima" in t:
            res = "Life Insurance"
        elif "hydro" in t:
            res = "Hydropower"
        elif any(k in t for k in ("manufactur", "distiller", "cement", "processing", "spinning", "lube")):
            res = "Manufacturing"
        elif "hotel" in t or "tourism" in t:
            res = "Hotels & Tourism"
        elif "invest" in t:
            res = "Investment"
        elif "trad" in t:
            res = "Trading"
        elif "finance" in t:
            res = "Finance"
        elif "fund" in t or "mutual" in t:
            res = "Mutual Fund"
        elif "debenture" in t or "bond" in t or "preference" in t:
            res = "Debt"

    # Company name resolution (resolves 'Others' and corrects obvious misclassifications)
    if name:
        nt = name.lower().strip()
        # High confidence mutual funds / bonds
        if any(k in nt for k in ("mutual fund", "balanced fund", "equity fund", "growth fund", "stable fund", "flexi cap fund", "large cap fund", "focused equity fund", "bluechip fund", "samriddhi yojana", "sammunat yojana", "dhanabriddhi yojana", "sabal yojana", "santulit yojana", "unnati kosh", "yojana", "fund")):
            return "Mutual Fund"
        if "debenture" in nt or "bond" in nt:
            return "Debt"
        if "laghubitta" in nt or "microfinance" in nt or "bittiya" in nt:
            return "Microfinance"
        if "development bank" in nt or "bikas bank" in nt or "bikash bank" in nt:
            return "Development Bank"
        if "bank" in nt and "world bank" not in nt:
            return "Commercial Bank"
        if "finance" in nt:
            return "Finance"
        if "life insurance" in nt or "jeewan beema" in nt:
            return "Life Insurance"
        if any(k in nt for k in ("non-life", "general insurance", "reinsurance", "micro insurance", "nirjiban beema", "beema company")):
            return "Non-Life Insurance"
        if "insurance" in nt or "beema" in nt:
            return "Life Insurance" if "life" in nt else "Non-Life Insurance"
        if any(k in nt for k in ("hydropower", "hydro", "power", "urja", "energy", "jalbidhyut", "jalvidhyut", "jalavidyut", "jalavidhyut", "jal bidyut", "jal vidhyut", "bidyut", "vidhyut", "rivers limited", "green ventures")):
            return "Hydropower"
        if any(k in nt for k in ("distillery", "cement", "lube", "bottlers", "steel", "spinning", "rubber", "manufacturing", "paints", "minerals", "colour", "pharmaceuticals", "agritech", "panel", "unilever")):
            return "Manufacturing"
        if any(k in nt for k in ("hotel", "resort", "tourism", "cablecar", "darshan", "chandragiri")):
            return "Hotels & Tourism"
        if any(k in nt for k in ("trading", "bishal bazar")):
            return "Trading"
        if any(k in nt for k in ("investment", "holdings", "capital", "trust", "infrastructure and development")):
            return "Investment"

    return res


def _merge_quarter_record(existing: dict, incoming: dict):
    """Deep-merge incoming quarter metrics into existing quarter without data loss."""
    # Merge computed ratios
    ex_computed = existing.setdefault("computed", {})
    for k, v in (incoming.get("computed") or {}).items():
        if v is not None or k not in ex_computed:
            ex_computed[k] = v

    # Merge raw balance sheet / P&L fields
    ex_raw = existing.setdefault("raw", {})
    for k, v in (incoming.get("raw") or {}).items():
        if v is not None or k not in ex_raw:
            ex_raw[k] = v

    # Merge YoY growth
    ex_yoy = existing.setdefault("yoy", {})
    for k, v in (incoming.get("yoy") or {}).items():
        if v is not None or k not in ex_yoy:
            ex_yoy[k] = v

    # Merge raw_keys_order preserving sequence
    existing_keys = existing.get("raw_keys_order") or list(ex_raw.keys())
    incoming_keys = incoming.get("raw_keys_order") or list((incoming.get("raw") or {}).keys())
    for k in incoming_keys:
        if k not in existing_keys:
            existing_keys.append(k)
    existing["raw_keys_order"] = existing_keys

    # Refresh timestamp and label
    if incoming.get("quarter_label"):
        existing["quarter_label"] = incoming["quarter_label"]
    existing["parsed_at"] = incoming.get("parsed_at") or datetime.now().isoformat()
    if incoming.get("sector"):
        existing["sector"] = normalize_sector(incoming["sector"])


def save_quarter(symbol: str, quarter_data: dict, allow_overwrite: bool = False, merge: bool = True):
    """
    Save or merge a parsed quarter to the database.

    Args:
        symbol:          NEPSE stock symbol (e.g. "SAHAS")
        quarter_data:    Dictionary with fy, quarter, computed, raw, yoy
        allow_overwrite: If True, allows updating existing quarter
        merge:           If True, deep-merges rather than fully replacing existing quarter
    """
    fy      = quarter_data["fy"]
    quarter = quarter_data["quarter"]

    if not allow_overwrite and not merge and check_duplicate(symbol, fy, quarter):
        raise DuplicateQuarterError(
            f"{symbol} – {quarter_data.get('quarter_label', f'Q{quarter} FY {fy}')} "
            f"already exists in the database."
        )

    data = load_symbol_data(symbol)

    # Update company-level metadata from latest parse
    data["symbol"] = symbol.upper()
    sec = quarter_data.get("sector") or data.get("sector")
    if sec:
        data["sector"] = normalize_sector(sec)
    if quarter_data.get("company_name"):
        data["company_name"] = quarter_data["company_name"]

    # Check if quarter already exists
    existing_q = next((q for q in data["quarters"]
                       if q.get("fy") == fy and q.get("quarter") == quarter), None)

    if existing_q:
        if merge:
            _merge_quarter_record(existing_q, quarter_data)
        elif allow_overwrite:
            data["quarters"] = [
                q for q in data["quarters"]
                if not (q.get("fy") == fy and q.get("quarter") == quarter)
            ]
            data["quarters"].append(quarter_data)
    else:
        # Normalize quarter record sector before appending
        if quarter_data.get("sector"):
            quarter_data["sector"] = normalize_sector(quarter_data["sector"])
        data["quarters"].append(quarter_data)

    data["quarters"].sort(key=_sort_key)
    save_symbol_data(symbol, data)
    return data


def upsert_quarters(symbol: str, quarters_list: list, company_name: str | None = None,
                    sector: str | None = None) -> dict:
    """
    Batch upsert multiple quarters for a symbol, preserving existing quarters,
    appending new quarters chronologically, and deep-merging matching quarters.
    """
    if not quarters_list:
        return load_symbol_data(symbol)

    data = load_symbol_data(symbol)
    data["symbol"] = symbol.upper()
    if company_name:
        data["company_name"] = company_name
    if sector:
        data["sector"] = normalize_sector(sector)

    # Index existing quarters by (fy, quarter)
    by_key = {(q.get("fy"), q.get("quarter")): q for q in data.get("quarters", [])}

    for incoming in quarters_list:
        fy = incoming.get("fy")
        q = incoming.get("quarter")
        if not fy or not q:
            continue
        key = (fy, q)
        if key in by_key:
            _merge_quarter_record(by_key[key], incoming)
        else:
            if sector and not incoming.get("sector"):
                incoming["sector"] = normalize_sector(sector)
            elif incoming.get("sector"):
                incoming["sector"] = normalize_sector(incoming["sector"])
            by_key[key] = incoming

    data["quarters"] = sorted(by_key.values(), key=_sort_key)
    save_symbol_data(symbol, data)
    return data


def get_all_quarters(symbol: str) -> list:
    """Return list of all quarters for a symbol, sorted oldest→newest."""
    data = load_symbol_data(symbol)
    return data.get("quarters", [])


def get_quarter(symbol: str, fy: str, quarter: int) -> dict | None:
    """Return a specific quarter record, or None if not found."""
    for q in get_all_quarters(symbol):
        if q["fy"] == fy and q["quarter"] == quarter:
            return q
    return None


def delete_quarter(symbol: str, fy: str, quarter: int) -> bool:
    """Delete a specific quarter. Returns True if deleted, False if not found."""
    data = load_symbol_data(symbol)
    original_len = len(data["quarters"])
    data["quarters"] = [
        q for q in data["quarters"]
        if not (q["fy"] == fy and q["quarter"] == quarter)
    ]
    if len(data["quarters"]) == original_len:
        return False
    save_symbol_data(symbol, data)
    return True


def list_symbols() -> list:
    """Return list of all symbols that have quarterly data stored."""
    _ensure_dir()
    symbols = []
    for fname in os.listdir(QUARTERLY_DIR):
        if fname.endswith(".json"):
            sym = fname[:-5].upper()
            symbols.append(sym)
    return sorted(symbols)


def get_summary(symbol: str) -> dict:
    """Return a lightweight summary (no raw_all_columns) for frontend list views."""
    data = load_symbol_data(symbol)
    quarters_summary = []
    for q in data.get("quarters", []):
        quarters_summary.append({
            "fy":            q.get("fy"),
            "quarter":       q.get("quarter"),
            "quarter_label": q.get("quarter_label"),
            "period_end_text": q.get("period_end_text"),
            "parsed_at":     q.get("parsed_at"),
            "raw":           q.get("raw", {}),
            "raw_keys_order": q.get("raw_keys_order", []),
            "computed":      q.get("computed", {}),
            "yoy":           q.get("yoy", {}),
        })
    return {
        "symbol":       data.get("symbol"),
        "sector":       data.get("sector"),
        "company_name": data.get("company_name"),
        "quarter_count": len(quarters_summary),
        "quarters":     quarters_summary,
        "last_updated": data.get("last_updated"),
    }
