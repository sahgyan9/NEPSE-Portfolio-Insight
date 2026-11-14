"""
Personalised EPS insights for the user's holdings.

Uses true trailing-twelve-month (TTM) EPS built from year-to-date net profit. The stored
quarterly field computed.eps_ttm is NOT TTM: it is the NEPSE annualized figure (year-to-date
profit scaled to a full year), which misleads after Q1 and for seasonal sectors.

Reads db/portfolio.json, db/fundamentals.json, db/quarterly/*.json, db/prices/*.json.
Writes db/eps_insights.json (gitignored: it holds personal holdings).
Read-only on the frozen research data; does not import the frozen scorer.
"""

import json
import os
import statistics
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402

OUTPUT_PATH = os.path.join(pc.DB_DIR, "eps_insights.json")

# Thresholds. Each has a one-line reason.
GROWTH_FALLING_PCT = -20.0       # a fall of a fifth or more in profit is a real change, not noise
GROWTH_RISING_PCT = 20.0         # a rise of a fifth or more is worth noticing
SEASONAL_RATIO = 1.3             # hydropower annualized EPS this far above TTM is the monsoon effect
ANNUALIZED_GAP_PCT = 30.0        # annualized vs TTM gap beyond this makes annualized EPS unreliable
EXPENSIVE_AT_COST_MULT = 2.0     # you paid over twice what the sector's typical share costs per Rs of profit
CHEAP_VS_SECTOR_MULT = 0.6       # trading at under 60% of the sector's typical P/E
PE_MIN, PE_MAX = 0.0, 500.0      # P/E outside this range is a loss or a near-zero-profit artefact
MIN_SECTOR_PEERS = 3             # a median of fewer than 3 companies says little
HISTORY_QUARTERS = 8             # two years of TTM EPS for the trend
DEFAULT_FACE_VALUE = 100.0       # NEPSE shares have a face value of Rs 100

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2, "info": 3}

METHOD = (
    "TTM EPS is profit for the last 12 months divided by shares: last full year's profit minus the "
    "same year-to-date period a year ago plus this year's year-to-date profit. Annualized EPS is the "
    "NEPSE figure that scales the year-to-date profit up to a year; it overstates seasonal firms "
    "(hydropower earns most in the monsoon quarter) and understates a weak start to the year."
)


# ---------------------------------------------------------------- pure helpers

def prev_fy(fy):
    """'2083-84' -> '2082-83'."""
    a, b = fy.split("-")
    return f"{int(a) - 1}-{(int(b) - 1) % 100:02d}"


def index_quarters(quarters):
    return {(q.get("fy"), q.get("quarter")): q for q in quarters}


def ytd(q):
    """Year-to-date net profit of a quarter record, or None."""
    if not q:
        return None
    v = (q.get("raw") or {}).get("Net Profit")
    return float(v) if isinstance(v, (int, float)) else None


def ttm_profit(index, q):
    """Net profit for the 12 months ending at quarter q, or None when a needed
    previous-year quarter is missing."""
    cur = ytd(q)
    if cur is None:
        return None
    if q["quarter"] == 4:
        return cur
    py = prev_fy(q["fy"])
    base = ytd(index.get((py, 4)))
    same = ytd(index.get((py, q["quarter"])))
    if base is None or same is None:
        return None
    return base - same + cur


def shares_for(q, fund_shares=None):
    """Number of shares: reported count, else paid-up capital / face value, else the
    fundamentals sharesOutstanding."""
    raw = q.get("raw") or {}
    n = raw.get("Number of Shares")
    if isinstance(n, (int, float)) and n > 0:
        return float(n)
    cap = raw.get("Paid Up Capital")
    if isinstance(cap, (int, float)) and cap > 0:
        return float(cap) / DEFAULT_FACE_VALUE
    if isinstance(fund_shares, (int, float)) and fund_shares > 0:
        return float(fund_shares)
    return None


def ttm_eps_for(index, q, fund_shares=None):
    profit = ttm_profit(index, q)
    shares = shares_for(q, fund_shares)
    if profit is None or not shares:
        return None
    return profit / shares


def growth_info(index, q):
    """Year-on-year change in year-to-date profit: (growth_pct, state)."""
    cur = ytd(q)
    prev = ytd(index.get((prev_fy(q["fy"]), q["quarter"])))
    if cur is None or prev is None:
        return None, None
    if prev > 0:
        growth = (cur - prev) / prev * 100
        return growth, ("turned_to_loss" if cur <= 0 else "profit")
    return None, ("turned_profitable" if cur > 0 else "still_loss")


def sector_of(symbol, qdata, fundamentals):
    """Same order as portfolio_common.resolve_sector, but with the quarterly file already loaded."""
    sym = symbol.upper()
    sector = pc.SYMBOL_SECTOR.get(sym)
    if not sector:
        sector = ((fundamentals or {}).get(sym) or {}).get("sector")
    if not sector or pc.normalize_sector(sector) == "Others":
        if qdata and qdata.get("sector"):
            sector = qdata["sector"]
    return pc.normalize_sector(sector)


def eps_history(quarters, index, fund_shares, limit=HISTORY_QUARTERS):
    out = []
    for q in quarters[-limit:]:
        eps = ttm_eps_for(index, q, fund_shares)
        if eps is None:
            continue
        out.append({
            "label": q.get("quarter_label"),
            "ttm_eps": round(eps, 2),
            "annualized_eps": (q.get("computed") or {}).get("eps_ttm"),
        })
    return out


def _r(x, nd=2):
    return None if x is None else round(x, nd)


def make_flags(h, sector_median_pe):
    """Plain-English flags for one holding record (h holds numeric fields, unrounded)."""
    flags = []
    ttm, ann = h["ttm_eps"], h["annualized_eps"]
    growth = h["growth_yoy_pct"]
    sector = h["sector"]

    if ttm is not None and ttm <= 0:
        flags.append({"code": "LOSS", "severity": "high", "text":
                      f"The company lost money over the last 12 months (EPS Rs {ttm:.2f} per share). "
                      "A P/E ratio has no meaning for a loss."})
    if growth is not None and growth <= GROWTH_FALLING_PCT:
        if h.get("growth_state") == "turned_to_loss":
            text = "The company made a profit in the same period last year but a loss so far this year."
        else:
            text = f"Profit so far this year is {abs(growth):.0f}% lower than the same period last year."
        flags.append({"code": "PROFIT_FALLING", "severity": "high", "text": text})
    if growth is not None and growth >= GROWTH_RISING_PCT:
        flags.append({"code": "PROFIT_RISING", "severity": "info", "text":
                      f"Profit so far this year is {growth:.0f}% higher than the same period last year."})

    if ttm is not None and ann is not None and ttm != 0:
        if sector == "Hydropower" and h["quarter"] in (1, 2) and ann > SEASONAL_RATIO * ttm:
            flags.append({"code": "SEASONAL_ANNUALIZED", "severity": "medium", "text":
                          f"Annualized EPS (Rs {ann:.2f}) is far above the 12-month EPS (Rs {ttm:.2f}). "
                          "The monsoon quarter is this sector's best, so scaling it up to a year inflates the figure. "
                          "Use the 12-month EPS."})
        elif sector != "Hydropower" and abs(ann - ttm) / abs(ttm) * 100 > ANNUALIZED_GAP_PCT:
            flags.append({"code": "ANNUALIZED_GAP", "severity": "low", "text":
                          f"Annualized EPS (Rs {ann:.2f}) differs a lot from the 12-month EPS (Rs {ttm:.2f}). "
                          "The annualized figure only scales the year so far; the 12-month figure is the better guide."})

    pac, mpe = h["pe_at_cost"], h["market_pe"]
    if sector_median_pe:
        if pac is not None and pac > EXPENSIVE_AT_COST_MULT * sector_median_pe:
            flags.append({"code": "EXPENSIVE_AT_COST", "severity": "medium", "text":
                          f"You paid {pac:.1f} times the 12-month EPS, more than twice the {sector} median P/E of "
                          f"{sector_median_pe:.1f}. Your earnings yield on cost is low for this sector."})
        if mpe is not None and mpe < CHEAP_VS_SECTOR_MULT * sector_median_pe:
            flags.append({"code": "CHEAP_VS_SECTOR", "severity": "info", "text":
                          f"The market P/E of {mpe:.1f} is well below the {sector} median of {sector_median_pe:.1f}. "
                          "Check whether profits are about to fall."})
    flags.sort(key=lambda f: SEVERITY_ORDER[f["severity"]])
    return flags


# ---------------------------------------------------------------- build

def _load_quarterly_files(quarterly_dir):
    out = {}
    if not os.path.isdir(quarterly_dir):
        return out
    for name in sorted(os.listdir(quarterly_dir)):
        if not name.endswith(".json"):
            continue
        data = pc.load_json(os.path.join(quarterly_dir, name))
        if data and data.get("quarters"):
            out[name[:-5].upper()] = data
    return out


def compute_sector_median_pe(qfiles, fundamentals, price_fn):
    """Median TTM P/E per sector across every company with a price, using 0 < P/E < 500
    and at least MIN_SECTOR_PEERS companies."""
    by_sector = {}
    for sym, data in qfiles.items():
        sector = sector_of(sym, data, fundamentals)
        if sector in ("Mutual Fund", "Others", "Debt"):
            continue
        price, _ = price_fn(sym)
        if not price:
            continue
        quarters = data["quarters"]
        latest = quarters[-1]
        fund_shares = ((fundamentals or {}).get(sym) or {}).get("sharesOutstanding")
        eps = ttm_eps_for(index_quarters(quarters), latest, fund_shares)
        if eps is None or eps <= 0:
            continue
        pe = price / eps
        if PE_MIN < pe < PE_MAX:
            by_sector.setdefault(sector, []).append(pe)
    return {s: statistics.median(v) for s, v in by_sector.items() if len(v) >= MIN_SECTOR_PEERS}


def build_holding(hold, data, fundamentals, sector_median, price_fn):
    sym = hold["symbol"].upper()
    quarters = data["quarters"]
    index = index_quarters(quarters)
    latest = quarters[-1]
    fund_shares = ((fundamentals or {}).get(sym) or {}).get("sharesOutstanding")
    sector = sector_of(sym, data, fundamentals)

    shares = shares_for(latest, fund_shares)
    cur_ytd = ytd(latest)
    if shares is None:
        return None, "number of shares not available"
    if cur_ytd is None:
        return None, "net profit not available in the latest quarter"

    profit = ttm_profit(index, latest)
    ttm = profit / shares if profit is not None else None
    ann = (latest.get("computed") or {}).get("eps_ttm")
    growth, gstate = growth_info(index, latest)
    price, price_date = price_fn(sym)

    qty = float(hold.get("quantity") or 0)
    cost = float(hold.get("avgCost") or 0)
    positive = ttm is not None and ttm > 0

    rec = {
        "symbol": sym,
        "company": hold.get("company") or data.get("company_name") or sym,
        "sector": sector,
        "latest_quarter": latest.get("quarter_label"),
        "fy": latest["fy"],
        "quarter": latest["quarter"],
        "shares": shares,
        "ytd_profit": cur_ytd,
        "ttm_profit": profit,
        "ttm_eps": ttm,
        "annualized_eps": ann,
        "growth_yoy_pct": growth,
        "growth_state": gstate,
        "price": price,
        "price_date": price_date,
        "market_pe": price / ttm if (positive and price) else None,
        "market_earnings_yield_pct": ttm / price * 100 if (ttm is not None and price) else None,
        "sector_median_pe": sector_median,
        "avg_cost": cost,
        "quantity": qty,
        "pe_at_cost": cost / ttm if (positive and cost > 0) else None,
        "earnings_yield_on_cost_pct": ttm / cost * 100 if (ttm is not None and cost > 0) else None,
        "share_of_yearly_profit": qty * ttm if ttm is not None else None,
        "payback_years": cost / ttm if (positive and cost > 0) else None,
        "gain_pct": (price - cost) / cost * 100 if (price and cost > 0) else None,
        "eps_history": eps_history(quarters, index, fund_shares),
    }
    notes = []
    if ttm is None:
        notes.append("only annualized EPS available")
    rec["notes"] = notes
    rec["flags"] = make_flags(rec, sector_median)

    for k in ("shares", "ytd_profit", "ttm_profit"):
        rec[k] = _r(rec[k], 0)
    for k in ("ttm_eps", "annualized_eps", "market_pe", "sector_median_pe", "pe_at_cost",
              "payback_years", "price", "avg_cost", "share_of_yearly_profit"):
        rec[k] = _r(rec[k], 2)
    for k in ("growth_yoy_pct", "market_earnings_yield_pct", "earnings_yield_on_cost_pct", "gain_pct"):
        rec[k] = _r(rec[k], 1)
    return rec, None


def portfolio_block(holdings):
    use = [h for h in holdings if h["ttm_eps"] is not None]
    profit = sum(h["quantity"] * h["ttm_eps"] for h in use)
    cost = sum(h["quantity"] * h["avg_cost"] for h in use)
    priced = [h for h in use if h["price"]]
    mkt_profit = sum(h["quantity"] * h["ttm_eps"] for h in priced)
    mkt_value = sum(h["quantity"] * h["price"] for h in priced)
    return {
        "holdings_counted": len(use),
        "share_of_yearly_profit": _r(profit, 0),
        "total_cost": _r(cost, 0),
        "total_market_value": _r(mkt_value, 0),
        "earnings_yield_on_cost_pct": _r(profit / cost * 100, 2) if cost > 0 else None,
        "market_earnings_yield_pct": _r(mkt_profit / mkt_value * 100, 2) if mkt_value > 0 else None,
        "pe_at_cost": _r(cost / profit, 2) if profit > 0 and cost > 0 else None,
        "market_pe": _r(mkt_value / mkt_profit, 2) if mkt_profit > 0 and mkt_value > 0 else None,
    }


def build_insights(portfolio, fundamentals, quarterly_dir, price_fn=pc.latest_close):
    """Pure: reads inputs, returns the insights dict, writes nothing."""
    qfiles = _load_quarterly_files(quarterly_dir)
    medians = compute_sector_median_pe(qfiles, fundamentals, price_fn)

    holdings, skipped = [], []
    for hold in (portfolio or {}).get("holdings", []):
        sym = (hold.get("symbol") or "").upper()
        if not sym:
            continue
        data = qfiles.get(sym)
        sector = sector_of(sym, data, fundamentals)
        if sector == "Mutual Fund":
            skipped.append({"symbol": sym, "reason": "mutual fund, no earnings per share"})
            continue
        if not data:
            skipped.append({"symbol": sym, "reason": "no quarterly report data"})
            continue
        rec, reason = build_holding(hold, data, fundamentals, medians.get(sector), price_fn)
        if rec is None:
            skipped.append({"symbol": sym, "reason": reason})
        else:
            holdings.append(rec)

    holdings.sort(key=lambda h: (min((SEVERITY_ORDER[f["severity"]] for f in h["flags"]), default=9), h["symbol"]))
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "method": METHOD,
        "sector_median_pe": {k: round(v, 2) for k, v in sorted(medians.items())},
        "portfolio": portfolio_block(holdings),
        "holdings": holdings,
        "skipped": skipped,
    }


def main():
    portfolio = pc.load_json(os.path.join(pc.DB_DIR, "portfolio.json")) or {"holdings": []}
    fundamentals = pc.load_json(os.path.join(pc.DB_DIR, "fundamentals.json")) or {}
    result = build_insights(portfolio, fundamentals, pc.QUARTERLY_DIR)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"Wrote {OUTPUT_PATH}: {len(result['holdings'])} holdings, {len(result['skipped'])} skipped")


if __name__ == "__main__":
    main()
