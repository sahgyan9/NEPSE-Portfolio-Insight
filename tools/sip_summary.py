"""
SIP summary for open-ended mutual funds bought by instalment.

Reads the instalment rows already held in db/portfolio.json (entered from the fund's SIP
statement, see workflows/import_broker_transactions.md), the latest NAV in
db/fundamentals.json (kept current by nepse_server via tools/fetch_mutual_fund_nav.py) and
the declared dividend percent in db/dividend_data.json.
Nothing is fetched and nothing is written.

Per fund it works out:
  - money paid in, units held, average cost per unit
  - value at the latest NAV and the gain or loss in rupees and percent
  - the yearly return that accounts for when each instalment was paid (XIRR)
  - one row per instalment with the NAV paid and how NAV has moved since

Row kinds:
  instalment      BUY with a price: cash paid in
  dividend_units  BUY at price 0: units credited as dividend, no cash paid
  redemption      SELL: units sold back to the fund, cash received

Units: MeroShare drops the fraction of every credit, so the demat balance (the holding's
quantity) is slightly below the statement total. Value uses the demat balance when the
holding exists, so it matches the rest of the app; the statement total is reported beside it.

Usage:
    python tools/sip_summary.py            # print the summary as JSON
"""

import json
import os
import re
import sys
from collections import Counter
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402

# Open-ended funds (bought and sold back at NAV, not traded on NEPSE). Keep in step with
# OPEN_ENDED_MUTUAL_FUNDS in nepse_server.py.
OPEN_ENDED_FUNDS = {"NIBLSF": "NIBL Sahabhagita Fund"}

PORTFOLIO_PATH = os.path.join(pc.DB_DIR, "portfolio.json")
FUNDAMENTALS_PATH = os.path.join(pc.DB_DIR, "fundamentals.json")
DIVIDENDS_PATH = os.path.join(pc.DB_DIR, "dividend_data.json")

MIN_XIRR_DAYS = 90  # a yearly rate from a shorter span is mostly noise

_NAV_RE = re.compile(r"NAV\s+([\d.]+)")
_CHARGE_RE = re.compile(r"Rs\.?\s*([\d.]+)\s+charge")
_FY_RE = re.compile(r"\b(2\d{3})[-/](\d{2})\b")


def _fiscal_year(source):
    """'... DREP 2081-82 ...' to ('2081/82', '081-082'): display form and dividend_data key."""
    m = _FY_RE.search(source or "")
    if not m:
        return None, None
    start, end = m.group(1), m.group(2)
    return f"{start}/{end}", f"{start[1:]}-0{end}"


def _parse_date(value):
    """ISO (YYYY-MM-DD...) or DD/MM/YYYY to a date; None when unreadable."""
    if not value:
        return None
    text = str(value).strip()
    for fmt, length in (("%Y-%m-%d", 10), ("%d/%m/%Y", 10)):
        try:
            return datetime.strptime(text[:length], fmt).date()
        except ValueError:
            continue
    return None


def _num(text, pattern):
    m = pattern.search(text or "")
    if not m:
        return None
    try:
        return float(m.group(1).rstrip("."))
    except ValueError:
        return None


def xirr(flows):
    """Yearly rate that makes dated cash flows net to zero.

    flows: list of (date, amount); money paid in is negative, money received is positive.
    Returns a fraction (0.08 = 8% a year) or None when it cannot be worked out: fewer than
    two flows, all one sign, or a span shorter than MIN_XIRR_DAYS.
    """
    flows = [(d, a) for d, a in flows if d is not None and a]
    if len(flows) < 2:
        return None
    if not (any(a < 0 for _, a in flows) and any(a > 0 for _, a in flows)):
        return None
    start = min(d for d, _ in flows)
    if (max(d for d, _ in flows) - start).days < MIN_XIRR_DAYS:
        return None

    def npv(rate):
        return sum(a / (1.0 + rate) ** ((d - start).days / 365.0) for d, a in flows)

    lo, hi = -0.99, 10.0
    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo * f_hi > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2.0
        f_mid = npv(mid)
        if abs(f_mid) < 1e-7:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2.0


def _rows_for(symbol, transactions):
    rows = []
    for t in transactions or []:
        if str(t.get("symbol", "")).upper() != symbol:
            continue
        d = _parse_date(t.get("date"))
        qty = float(t.get("quantity") or 0)
        price = float(t.get("price") or 0)
        if d is None or qty <= 0:
            continue
        kind_raw = str(t.get("type", "BUY")).upper()
        source = t.get("source") or ""
        if kind_raw == "SELL":
            kind = "redemption"
        elif price > 0:
            kind = "instalment"
        else:
            kind = "dividend_units"
        nav_paid = _num(source, _NAV_RE) if kind == "instalment" else None
        charge = _num(source, _CHARGE_RE) if kind == "instalment" else None
        if nav_paid and charge is not None:
            # Same sum as the statement's "Total Amount" column: units x NAV + charge
            amount = round(qty * nav_paid + charge, 2)
        else:
            amount = round(qty * price, 2)
        rows.append({
            "date": d.isoformat(),
            "kind": kind,
            "units": round(qty, 4),
            "amount": amount,
            "navPaid": nav_paid,
            "charge": charge,
            "fiscalYear": _fiscal_year(source)[0] if kind == "dividend_units" else None,
            "_fyKey": _fiscal_year(source)[1] if kind == "dividend_units" else None,
        })
    rows.sort(key=lambda r: r["date"])
    return rows


def summarise_fund(symbol, name, transactions, holding, nav_entry, today=None, declared=None):
    """Summary dict for one fund, or None when it has no rows.

    declared: the fund's list of declared dividends from dividend_data.json, used only to
    show the declared percent beside dividend units of the same fiscal year.
    """
    rows = _rows_for(symbol, transactions)
    if not rows:
        return None
    today = today or date.today()

    paid = sum(r["amount"] for r in rows if r["kind"] == "instalment")
    redeemed = sum(r["amount"] for r in rows if r["kind"] == "redemption")
    statement_units = sum(-r["units"] if r["kind"] == "redemption" else r["units"] for r in rows)
    dividend_units = sum(r["units"] for r in rows if r["kind"] == "dividend_units")
    instalments = [r for r in rows if r["kind"] == "instalment"]

    demat_units = None
    if holding and holding.get("quantity") is not None:
        demat_units = float(holding["quantity"])
    units = demat_units if demat_units is not None else statement_units

    nav = None
    nav_date = None
    if nav_entry and nav_entry.get("nav"):
        try:
            nav = float(nav_entry["nav"])
        except (TypeError, ValueError):
            nav = None
        nav_date = _parse_date(nav_entry.get("navDate") or nav_entry.get("lastTradeDate"))

    value = gain = gain_pct = rate = None
    if nav and nav > 0:
        value = round(units * nav, 2)
        gain = round(value + redeemed - paid, 2)
        gain_pct = gain / paid if paid > 0 else None
        flows = [(_parse_date(r["date"]), -r["amount"]) for r in instalments]
        flows += [(_parse_date(r["date"]), r["amount"]) for r in rows if r["kind"] == "redemption"]
        flows.append((nav_date or today, value))
        rate = xirr(flows)
        for r in rows:
            if r["navPaid"]:
                r["navChange"] = nav / r["navPaid"] - 1.0

    declared_pct = {d.get("fiscalYear"): d.get("cashPercent") or d.get("totalPercent") for d in declared or []}
    dividends = []
    for r in rows:
        fy_key = r.pop("_fyKey", None)
        if r["kind"] != "dividend_units":
            continue
        dividends.append({
            "date": r["date"],
            "units": r["units"],
            "fiscalYear": r["fiscalYear"],
            "declaredPercent": declared_pct.get(fy_key) or None,
            "valueNow": round(r["units"] * nav, 2) if nav else None,
        })

    navs_paid = [r["navPaid"] for r in instalments if r["navPaid"]]
    amounts = Counter(r["amount"] for r in instalments)

    return {
        "symbol": symbol,
        "name": name,
        "totalPaid": round(paid, 2),
        "totalRedeemed": round(redeemed, 2),
        "units": round(units, 4),
        "dematUnits": demat_units,
        "statementUnits": round(statement_units, 4),
        "dividendUnits": round(dividend_units, 4),
        "dividendValue": round(dividend_units * nav, 2) if nav else None,
        "dividends": dividends,
        "avgCost": round(paid / units, 4) if units > 0 else None,
        "nav": nav,
        "navDate": nav_date.isoformat() if nav_date else None,
        "value": value,
        "gain": gain,
        "gainPct": gain_pct,
        "yearlyReturn": rate,
        "instalmentCount": len(instalments),
        "usualAmount": amounts.most_common(1)[0][0] if amounts else None,
        "firstDate": rows[0]["date"],
        "lastDate": rows[-1]["date"],
        "lowestNavPaid": min(navs_paid) if navs_paid else None,
        "highestNavPaid": max(navs_paid) if navs_paid else None,
        "rows": rows,
    }


def build_summary(portfolio, fundamentals, today=None, dividend_data=None):
    today = today or date.today()
    holdings = {str(h.get("symbol", "")).upper(): h for h in (portfolio or {}).get("holdings", [])}
    funds = []
    for symbol, name in OPEN_ENDED_FUNDS.items():
        fund = summarise_fund(symbol, name, (portfolio or {}).get("transactions", []),
                              holdings.get(symbol), (fundamentals or {}).get(symbol), today,
                              ((dividend_data or {}).get(symbol) or {}).get("dividends"))
        if fund:
            funds.append(fund)
    return {"asOf": today.isoformat(), "funds": funds}


def load_summary():
    portfolio = pc.load_json(PORTFOLIO_PATH) or {}
    fundamentals = pc.load_json(FUNDAMENTALS_PATH) or {}
    dividend_data = pc.load_json(DIVIDENDS_PATH) or {}
    return build_summary(portfolio, fundamentals, dividend_data=dividend_data)


if __name__ == "__main__":
    json.dump(load_summary(), sys.stdout, indent=2)
    sys.stdout.write("\n")
