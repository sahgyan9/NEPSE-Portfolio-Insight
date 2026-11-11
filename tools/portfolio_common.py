"""
Shared helpers for the portfolio analytics tools (portfolio_risk, optimize_portfolio,
portfolio_health): sector resolution, current price lookup and sector peer statistics.

Kept separate from tools/score_sector_leaders.py on purpose: that scorer is frozen for the
research paper and must not gain new imports or behaviour.
"""

import json
import os
import statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(ROOT, "db")
PRICES_DIR = os.path.join(DB_DIR, "prices")
QUARTERLY_DIR = os.path.join(DB_DIR, "quarterly")

# Overrides for symbols the scraped sources mislabel or do not cover.
# Everything else resolves from fundamentals.json, then the quarterly file.
SYMBOL_SECTOR = {
    "CBBL": "Microfinance", "AVYAN": "Microfinance", "JBLB": "Microfinance",
    "SKBBL": "Microfinance",
    "SNLI": "Life Insurance", "CLI": "Life Insurance",
    "HRL": "Non-Life Insurance",
    "SONA": "Manufacturing", "SHIVM": "Manufacturing",
    "NTC": "Telecom",
    "SHL": "Hotels",
    "CSBY": "Mutual Fund", "CSY": "Mutual Fund", "KDBY": "Mutual Fund",
    "MMF1": "Mutual Fund", "NBF3": "Mutual Fund", "NIBLSF": "Mutual Fund",
    "NMBSBFE": "Mutual Fund",
}


def load_json(path):
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def normalize_sector(sector):
    if not sector:
        return "Others"
    s = sector.strip().lower()
    if s in ("unknown", "n/a", ""):
        return "Others"
    if "bank" in s:
        return "Development Bank" if "development" in s else "Commercial Bank"
    if "microfinance" in s or "laghubitta" in s:
        return "Microfinance"
    # Non-life must be tested before life: "non-life insurance" contains "life insurance".
    if "non-life" in s or "non life" in s or "reinsurance" in s:
        return "Non-Life Insurance"
    if "insurance" in s:
        return "Life Insurance"
    if "hydro" in s:
        return "Hydropower"
    if "manufactur" in s or "distiller" in s or "cement" in s:
        return "Manufacturing"
    if "hotel" in s or "tourism" in s:
        return "Hotels"
    if "invest" in s:
        return "Investment"
    if "trad" in s or "oil" in s:
        return "Trading"
    if "telecom" in s or "phone" in s or "communication" in s:
        return "Telecom"
    if "mutual" in s or "fund" in s:
        return "Mutual Fund"
    if "finance" in s:
        return "Finance"
    return sector.strip().title()


def resolve_sector(symbol, fundamentals=None):
    sym = symbol.upper()
    sector = SYMBOL_SECTOR.get(sym)
    if not sector and fundamentals:
        sector = (fundamentals.get(sym) or {}).get("sector")
    if not sector or normalize_sector(sector) == "Others":
        q = load_json(os.path.join(QUARTERLY_DIR, f"{sym}.json"))
        if q and q.get("sector"):
            sector = q["sector"]
    return normalize_sector(sector)


def latest_close(symbol):
    """Last traded close and its date from db/prices, or (None, None)."""
    data = load_json(os.path.join(PRICES_DIR, f"{symbol.upper()}.json"))
    if not data:
        return None, None
    rows = (data.get("raw") or data.get("adjusted") or {}).get("rows") or []
    for row in reversed(rows):
        if len(row) >= 5 and row[4] and row[4] > 0:
            return float(row[4]), row[0]
    return None, None


def current_price(symbol, avg_cost, fundamentals=None):
    """Best available current price: (price, source). Source says how much to trust it."""
    close, _ = latest_close(symbol)
    if close:
        return close, "price_history"
    fund = (fundamentals or {}).get(symbol.upper()) or {}
    for key in ("ltp", "last_traded_price", "nav"):
        val = fund.get(key)
        if isinstance(val, (int, float)) and val > 0:
            return float(val), key
    return float(avg_cost or 0.0), "cost"


def sector_medians(fundamentals):
    """Median P/E and P/B per sector over profitable companies. Medians, not means:
    a handful of P/E 300+ outliers otherwise drag a sector 'average' far above its typical firm."""
    pe, pb = {}, {}
    for sym, fund in (fundamentals or {}).items():
        if not isinstance(fund, dict):
            continue
        sector = resolve_sector(sym, fundamentals)
        if sector in ("Mutual Fund", "Others", "Debt"):
            continue
        p = fund.get("peRatio")
        b = fund.get("pbRatio")
        if isinstance(p, (int, float)) and 0 < p < 500:
            pe.setdefault(sector, []).append(p)
        if isinstance(b, (int, float)) and 0 < b < 100:
            pb.setdefault(sector, []).append(b)
    out = {}
    for sector in set(pe) | set(pb):
        out[sector] = {
            "pe": statistics.median(pe[sector]) if len(pe.get(sector, [])) >= 2 else None,
            "pb": statistics.median(pb[sector]) if len(pb.get(sector, [])) >= 2 else None,
            "count": len(pe.get(sector, [])),
        }
    return out
