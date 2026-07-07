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


def save_quarter(symbol: str, quarter_data: dict, allow_overwrite: bool = False):
    """
    Save a parsed quarter to the database.

    Args:
        symbol:         NEPSE stock symbol (e.g. "SAHAS")
        quarter_data:   Result dict from pdf_parser.parse_pdf()
        allow_overwrite: If True, replaces existing quarter (use with caution)

    Raises:
        DuplicateQuarterError: if quarter already exists and allow_overwrite=False
    """
    fy      = quarter_data["fy"]
    quarter = quarter_data["quarter"]

    if not allow_overwrite and check_duplicate(symbol, fy, quarter):
        raise DuplicateQuarterError(
            f"{symbol} – {quarter_data.get('quarter_label', f'Q{quarter} FY {fy}')} "
            f"already exists in the database."
        )

    data = load_symbol_data(symbol)

    # Update company-level metadata from latest parse
    data["symbol"]       = symbol.upper()
    data["sector"]       = quarter_data.get("sector", data.get("sector"))
    data["company_name"] = quarter_data.get("company_name", data.get("company_name"))

    # Remove old entry if overwriting
    if allow_overwrite:
        data["quarters"] = [
            q for q in data["quarters"]
            if not (q["fy"] == fy and q["quarter"] == quarter)
        ]

    # Append and re-sort
    data["quarters"].append(quarter_data)
    data["quarters"].sort(key=_sort_key)

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
