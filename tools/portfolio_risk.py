"""
Portfolio risk engine
=====================
Measures portfolio risk from the daily price history in db/prices instead of assuming a
fixed volatility per sector.

What it computes (all from weekly returns of bonus/right-adjusted prices):
- volatility of every holding and of the whole portfolio (annualised)
- how holdings move together (correlation), so two hydropower stocks are not counted as
  two independent bets
- risk contribution: the share of total portfolio risk each holding and sector carries,
  which is usually very different from its share of the money
- beta against an equal-weight index of every NEPSE stock on file
- what today's mix would have done over the lookback: worst drop (drawdown), a bad-week
  loss estimate (VaR / expected shortfall), one-year return
- money-weighted return (XIRR) of the actual purchases, next to the same cash flows put
  into the market index

Why weekly returns: many NEPSE stocks do not trade every day and are held by circuit
limits, so daily returns understate both volatility and correlation.

Usage:
    python tools/portfolio_risk.py            # prints a summary, writes db/portfolio_risk.json
    python tools/portfolio_risk.py --json     # prints the full JSON

This file is pure standard library so the app needs no numpy.
"""

import argparse
import glob
import json
import math
import os
import statistics
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402

WEEKS_PER_YEAR = 52
LOOKBACK_WEEKS = 104       # two years: long enough to estimate, short enough to be current
MARKET_HISTORY_WEEKS = 300  # index history kept for the cash-flow benchmark
MIN_WEEKS = 26             # fewer weekly returns than this and a holding counts as unmeasured
MIN_INDEX_MEMBERS = 20
RETURN_CAP = 0.5           # weekly returns beyond +/-50% are data errors or unadjusted actions
CORR_SHRINK = 0.2          # pull sample correlations 20% toward their average (noise control)
OUTPUT_PATH = os.path.join(pc.DB_DIR, "portfolio_risk.json")


# ----------------------------------------------------------------------------
# Small statistics helpers
# ----------------------------------------------------------------------------

def week_start(d):
    """NEPSE trades Sunday to Thursday; a week is keyed by its Sunday."""
    return d - timedelta(days=(d.weekday() + 1) % 7)


def parse_date(text):
    return datetime.strptime(str(text)[:10], "%Y-%m-%d").date()


def stdev(xs):
    return statistics.stdev(xs) if len(xs) >= 2 else 0.0


def paired(a, b):
    xs, ys = [], []
    for x, y in zip(a, b):
        if x is not None and y is not None:
            xs.append(x)
            ys.append(y)
    return xs, ys


def covariance(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (n - 1)


def correlation(a, b, min_obs=MIN_WEEKS):
    xs, ys = paired(a, b)
    if len(xs) < min_obs:
        return None
    sx, sy = stdev(xs), stdev(ys)
    if sx == 0 or sy == 0:
        return None
    return max(-1.0, min(1.0, covariance(xs, ys) / (sx * sy)))


def max_drawdown(levels):
    """Largest peak-to-trough fall of a level series, as a positive fraction."""
    peak, worst = None, 0.0
    for v in levels:
        if peak is None or v > peak:
            peak = v
        if peak and peak > 0:
            worst = max(worst, 1.0 - v / peak)
    return worst


def percentile(xs, q):
    if not xs:
        return 0.0
    s = sorted(xs)
    pos = q * (len(s) - 1)
    lo = int(math.floor(pos))
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def xirr(flows):
    """Annualised money-weighted return. flows: [(date, amount)], money paid in negative,
    money received (and the final value) positive. Returns None if it cannot be solved."""
    flows = [(d, a) for d, a in flows if a]
    if len(flows) < 2 or not any(a < 0 for _, a in flows) or not any(a > 0 for _, a in flows):
        return None
    t0 = min(d for d, _ in flows)

    def npv(rate):
        return sum(a / (1.0 + rate) ** ((d - t0).days / 365.25) for d, a in flows)

    lo, hi = -0.999, 100.0
    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo * f_hi > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        f_mid = npv(mid)
        if abs(f_mid) < 1e-7:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


# ----------------------------------------------------------------------------
# Price loading
# ----------------------------------------------------------------------------

def weekly_closes_from_rows(rows):
    """{week_start: last close of that week} from [date, o, h, l, close, v] rows."""
    out = {}
    for row in rows:
        try:
            close = row[4]
            if close and close > 0:
                out[week_start(parse_date(row[0]))] = float(close)
        except (ValueError, IndexError, TypeError):
            continue
    return out


def load_weekly_closes(symbol, prices_dir=None):
    data = pc.load_json(os.path.join(prices_dir or pc.PRICES_DIR, f"{symbol.upper()}.json"))
    if not data:
        return {}
    return weekly_closes_from_rows((data.get("adjusted") or {}).get("rows") or [])


def aligned_returns(weekly, calendar):
    """Weekly simple returns on a shared calendar. Weeks without a trade carry the last
    close forward (a 0% return); weeks before the first trade are None."""
    out, prev = [], None
    for wk in calendar:
        close = weekly.get(wk)
        if prev is None:
            out.append(None)
            if close:
                prev = close
            continue
        if close:
            r = close / prev - 1.0
            out.append(r if abs(r) <= RETURN_CAP else None)
            prev = close
        else:
            out.append(0.0)
    return out


def load_universe(prices_dir=None, weeks=MARKET_HISTORY_WEEKS):
    """{symbol: {week_start: close}} for every price file, trimmed to the recent window.

    Parsing ~330 full-history files takes several seconds, so the trimmed result is cached
    in .tmp/ and reused until any price file changes."""
    directory = prices_dir or pc.PRICES_DIR
    paths = [p for p in glob.glob(os.path.join(directory, "*.json"))
             if not os.path.basename(p).startswith("_")]
    if not paths:
        return {}
    signature = f"{len(paths)}:{max(os.path.getmtime(p) for p in paths):.0f}:{weeks}"
    cache_path = os.path.join(pc.ROOT, ".tmp", "risk_universe_cache.json")
    use_cache = prices_dir is None
    if use_cache:
        cached = pc.load_json(cache_path)
        if cached and cached.get("signature") == signature:
            return {s: {parse_date(d): c for d, c in wk.items()} for s, wk in cached["universe"].items()}

    universe = {}
    for path in paths:
        data = pc.load_json(path)
        if not data:
            continue
        wk = weekly_closes_from_rows((data.get("adjusted") or {}).get("rows") or [])
        if wk:
            universe[os.path.basename(path)[:-5].upper()] = wk
    if not universe:
        return {}
    cutoff = max(max(w) for w in universe.values()) - timedelta(weeks=weeks + 2)
    universe = {s: {d: c for d, c in wk.items() if d >= cutoff} for s, wk in universe.items()}
    universe = {s: wk for s, wk in universe.items() if wk}
    if use_cache:
        try:
            os.makedirs(os.path.dirname(cache_path), exist_ok=True)
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump({"signature": signature,
                           "universe": {s: {d.isoformat(): c for d, c in wk.items()}
                                        for s, wk in universe.items()}}, f)
        except OSError:
            pass
    return universe


def build_market(prices_dir=None, weeks=MARKET_HISTORY_WEEKS):
    """Equal-weight index of every symbol on file.

    Returns (calendar, market_returns, universe) where universe is {symbol: weekly closes}.
    Limitation: delisted and merged companies are not on file, so the index is slightly
    flattering (survivorship bias)."""
    universe = load_universe(prices_dir, weeks)
    if not universe:
        return [], [], {}
    last = max(max(w) for w in universe.values())
    calendar = [last - timedelta(weeks=i) for i in range(weeks, -1, -1)]
    series = {s: aligned_returns(w, calendar) for s, w in universe.items()}
    market = []
    for i in range(len(calendar)):
        vals = []
        for s, rets in series.items():
            # only count symbols that actually traded that week, so stale names do not
            # dilute the index toward zero
            if rets[i] is not None and calendar[i] in universe[s]:
                vals.append(rets[i])
        market.append(sum(vals) / len(vals) if len(vals) >= MIN_INDEX_MEMBERS else None)
    return calendar, market, universe


# ----------------------------------------------------------------------------
# Core risk maths (pure functions, unit-tested)
# ----------------------------------------------------------------------------

def shrunk_correlation_matrix(return_series):
    """Pairwise correlations, missing pairs filled with the average, then shrunk toward
    the average. With ~100 weekly observations and ~30 holdings, raw correlations are
    noisy; shrinking is the standard remedy (constant-correlation target)."""
    n = len(return_series)
    corr = [[1.0 if i == j else None for j in range(n)] for i in range(n)]
    known = []
    for i in range(n):
        for j in range(i + 1, n):
            c = correlation(return_series[i], return_series[j])
            corr[i][j] = corr[j][i] = c
            if c is not None:
                known.append(c)
    mean_c = sum(known) / len(known) if known else 0.3
    for i in range(n):
        for j in range(n):
            if i != j:
                c = corr[i][j] if corr[i][j] is not None else mean_c
                corr[i][j] = (1 - CORR_SHRINK) * c + CORR_SHRINK * mean_c
    return corr, mean_c


def risk_decomposition(weights, vols, corr):
    """Portfolio volatility and each holding's share of portfolio variance.

    Returns (portfolio_vol, contributions) with contributions summing to 1."""
    n = len(weights)
    marginal = []
    for i in range(n):
        marginal.append(sum(weights[j] * vols[i] * vols[j] * corr[i][j] for j in range(n)))
    variance = sum(weights[i] * marginal[i] for i in range(n))
    if variance <= 0:
        return 0.0, [0.0] * n
    return math.sqrt(variance), [weights[i] * marginal[i] / variance for i in range(n)]


def portfolio_return_series(weights, return_series):
    """Weekly returns of the current mix held at constant weights. In weeks where a
    holding did not exist yet, the remaining weights are scaled up."""
    length = len(return_series[0]) if return_series else 0
    out = []
    for t in range(length):
        num = den = 0.0
        for w, rets in zip(weights, return_series):
            if rets[t] is not None:
                num += w * rets[t]
                den += w
        out.append(num / den if den > 0.5 else None)
    return out


def levels_from_returns(returns, base=100.0):
    levels, v = [], base
    for r in returns:
        if r is not None:
            v *= 1.0 + r
        levels.append(v)
    return levels


# ----------------------------------------------------------------------------
# Cash-flow performance
# ----------------------------------------------------------------------------

def reconstruct_flows(holdings, transactions):
    """Purchase and sale cash flows. Broker-bill transactions are used where they explain
    a holding; any remainder is assumed bought at the average cost on the date the holding
    was added. Returns (flows, share_of_cost_from_bills)."""
    flows, billed_cost, total_cost = [], 0.0, 0.0
    by_symbol = {}
    for t in transactions or []:
        try:
            by_symbol.setdefault(t["symbol"].upper(), []).append(
                (parse_date(t["date"]), t["type"].upper(), float(t["quantity"]), float(t["price"])))
        except (KeyError, ValueError, TypeError, AttributeError):
            continue
    held = set()
    for h in holdings:
        sym = h["symbol"].upper()
        held.add(sym)
        qty, avg = float(h.get("quantity") or 0), float(h.get("avgCost") or 0)
        total_cost += qty * avg
        txs = by_symbol.get(sym, [])
        net = sum(q if typ == "BUY" else -q for _, typ, q, _ in txs if typ in ("BUY", "SELL"))
        try:
            added = parse_date(h.get("dateAdded"))
        except (ValueError, TypeError):
            added = None
        # Depositories drop fractional fund units, so bills may slightly exceed the holding.
        if txs and 0 < net <= qty * 1.005 + 1e-9:
            for d, typ, q, p in txs:
                flows.append((d, -q * p if typ == "BUY" else q * p))
                if typ == "BUY":
                    billed_cost += q * p
            residual = qty - net
            if residual > 1e-9 and added:
                flows.append((added, -residual * avg))
        elif added:
            flows.append((added, -qty * avg))
    for sym, txs in by_symbol.items():  # positions bought and fully sold
        if sym in held:
            continue
        for d, typ, q, p in txs:
            if typ in ("BUY", "SELL"):
                flows.append((d, -q * p if typ == "BUY" else q * p))
    share = min(1.0, billed_cost / total_cost) if total_cost > 0 else 0.0
    return flows, share


def benchmark_terminal_value(flows, calendar, market_levels):
    """Value today if every cash flow had bought (or sold) the market index instead."""
    if not calendar or not flows:
        return None

    def level_on(d):
        wk = week_start(d)
        if wk < calendar[0]:
            return None
        idx = min(len(calendar) - 1, (wk - calendar[0]).days // 7)
        return market_levels[idx]

    units = 0.0
    for d, amount in flows:
        lvl = level_on(d)
        if not lvl:
            return None
        units += -amount / lvl
    return units * market_levels[-1]


# ----------------------------------------------------------------------------
# Analysis
# ----------------------------------------------------------------------------

def pct(x, digits=1):
    return f"{x * 100:.{digits}f}%"


def analyze(portfolio, fundamentals=None, prices_dir=None, today=None):
    """Full risk report for a portfolio dict ({holdings, transactions}). Returns a dict."""
    fundamentals = fundamentals or {}
    holdings_in = [h for h in (portfolio or {}).get("holdings", []) if (h.get("quantity") or 0) > 0]
    if not holdings_in:
        return {"error": "No holdings found."}

    calendar_full, market_full, universe = build_market(prices_dir)
    if not calendar_full:
        return {"error": "No price history on file. Run tools/fetch_price_history.py first."}
    calendar = calendar_full[-(LOOKBACK_WEEKS + 1):]
    market = market_full[-(LOOKBACK_WEEKS + 1):]
    market_obs = [r for r in market if r is not None]
    market_vol = stdev(market_obs) * math.sqrt(WEEKS_PER_YEAR)

    # Sector peer statistics over the same window, for holdings without usable history.
    sector_series, sector_vols = {}, {}
    for sym, weekly in universe.items():
        rets = aligned_returns(weekly, calendar)
        obs = [r for r in rets if r is not None]
        if len(obs) < MIN_WEEKS:
            continue
        sector = pc.resolve_sector(sym, fundamentals)
        sector_series.setdefault(sector, []).append(rets)
        sector_vols.setdefault(sector, []).append(stdev(obs) * math.sqrt(WEEKS_PER_YEAR))

    def proxy_series(sector):
        """Stand-in return series for an unmeasured holding: its sector's average weekly
        return scaled to a typical single stock in that sector, else the market index."""
        peers = sector_series.get(sector, [])
        if len(peers) >= 5:
            avg = []
            for t in range(len(calendar)):
                vals = [p[t] for p in peers if p[t] is not None]
                avg.append(sum(vals) / len(vals) if vals else None)
            index_vol = stdev([r for r in avg if r is not None]) * math.sqrt(WEEKS_PER_YEAR)
            target = statistics.median(sector_vols[sector])
            k = target / index_vol if index_vol > 0 else 1.0
            return [None if r is None else r * k for r in avg], f"{sector} sector average"
        return list(market), "market index"

    rows, proxied = [], []
    for h in holdings_in:
        sym = h["symbol"].upper()
        qty, avg_cost = float(h["quantity"]), float(h.get("avgCost") or 0)
        sector = pc.resolve_sector(sym, fundamentals)
        price, price_source = pc.current_price(sym, avg_cost, fundamentals)
        rets = aligned_returns(universe.get(sym, {}), calendar)
        obs = [r for r in rets if r is not None]
        measured = len(obs) >= MIN_WEEKS
        if not measured:
            rets, method = proxy_series(sector)
            obs = [r for r in rets if r is not None]
            proxied.append({"symbol": sym, "method": method})
        rows.append({
            "symbol": sym, "company": h.get("company") or sym, "sector": sector,
            "quantity": qty, "avgCost": avg_cost, "price": price, "priceSource": price_source,
            "value": qty * price, "cost": qty * avg_cost,
            "returns": rets, "measured": measured,
            "vol": stdev(obs) * math.sqrt(WEEKS_PER_YEAR),
        })

    total_value = sum(r["value"] for r in rows)
    if total_value <= 0:
        return {"error": "Portfolio value is zero."}
    for r in rows:
        r["weight"] = r["value"] / total_value

    weights = [r["weight"] for r in rows]
    vols = [r["vol"] for r in rows]
    series = [r["returns"] for r in rows]
    corr, mean_corr = shrunk_correlation_matrix(series)
    port_vol, contributions = risk_decomposition(weights, vols, corr)

    port_rets = portfolio_return_series(weights, series)
    port_obs = [r for r in port_rets if r is not None]
    pm_x, pm_y = paired(port_rets, market)
    market_var = covariance(pm_y, pm_y)
    beta = covariance(pm_x, pm_y) / market_var if market_var > 0 else None

    port_levels = levels_from_returns(port_rets)
    market_levels = levels_from_returns(market)
    var95 = -percentile(port_obs, 0.05) if port_obs else 0.0
    tail = [r for r in port_obs if r <= -var95]
    cvar95 = -sum(tail) / len(tail) if tail else var95

    def trailing_return(levels, weeks=WEEKS_PER_YEAR):
        if len(levels) <= weeks or levels[-weeks - 1] <= 0:
            return None
        return levels[-1] / levels[-weeks - 1] - 1.0

    weighted_vol = sum(w * v for w, v in zip(weights, vols))
    hhi = sum(w * w for w in weights)

    holdings_out = []
    for i, r in enumerate(rows):
        hx, hy = paired(r["returns"], market)
        h_beta = covariance(hx, hy) / market_var if market_var > 0 and len(hx) >= MIN_WEEKS else None
        others = [corr[i][j] for j in range(len(rows)) if j != i]
        lv = levels_from_returns(r["returns"])
        holdings_out.append({
            "symbol": r["symbol"], "company": r["company"], "sector": r["sector"],
            "quantity": r["quantity"], "price": round(r["price"], 2), "priceSource": r["priceSource"],
            "value": round(r["value"], 2), "cost": round(r["cost"], 2),
            "gainPct": round((r["value"] / r["cost"] - 1) * 100, 2) if r["cost"] > 0 else None,
            "weight": round(r["weight"], 4),
            "riskShare": round(contributions[i], 4),
            "volatility": round(r["vol"], 4),
            "beta": round(h_beta, 2) if h_beta is not None else None,
            "avgCorrelation": round(sum(others) / len(others), 2) if others else None,
            "return1y": round(trailing_return(lv), 4) if r["measured"] and trailing_return(lv) is not None else None,
            "maxDrawdown": round(max_drawdown(lv), 4) if r["measured"] else None,
            "measured": r["measured"],
        })
    holdings_out.sort(key=lambda x: x["riskShare"], reverse=True)

    sectors = {}
    for i, r in enumerate(rows):
        s = sectors.setdefault(r["sector"], {"sector": r["sector"], "weight": 0.0, "riskShare": 0.0, "holdings": 0})
        s["weight"] += r["weight"]
        s["riskShare"] += contributions[i]
        s["holdings"] += 1
    sectors_out = sorted(
        ({**s, "weight": round(s["weight"], 4), "riskShare": round(s["riskShare"], 4)} for s in sectors.values()),
        key=lambda x: x["weight"], reverse=True)

    measured_weight = sum(r["weight"] for r in rows if r["measured"])
    vol_ratio = port_vol / market_vol if market_vol > 0 else None
    if vol_ratio is None:
        risk_level = "Unknown"
    elif vol_ratio < 0.75:
        risk_level = "Lower than the market"
    elif vol_ratio <= 1.1:
        risk_level = "Similar to the market"
    else:
        risk_level = "Higher than the market"

    # ---- Performance: money-weighted return versus the index with the same cash flows
    today = today or date.today()
    flows, billed_share = reconstruct_flows(holdings_in, (portfolio or {}).get("transactions"))
    performance = {"xirr": None, "benchmarkXirr": None, "billedShare": round(billed_share, 2)}
    if flows:
        end = max(today, max(d for d, _ in flows))
        performance["xirr"] = xirr(flows + [(end, total_value)])
        bench_value = benchmark_terminal_value(flows, calendar_full, levels_from_returns(market_full))
        if bench_value and bench_value > 0:
            performance["benchmarkXirr"] = xirr(flows + [(end, bench_value)])
        performance["firstFlow"] = min(d for d, _ in flows).isoformat()
        for k in ("xirr", "benchmarkXirr"):
            if performance[k] is not None:
                performance[k] = round(performance[k], 4)
    performance["note"] = (
        "Annual return on the money actually put in, allowing for when each purchase was made. "
        "Excludes cash dividends and trading fees. The benchmark puts the same amounts on the "
        "same dates into an equal-weight index of all listed stocks on file."
    )

    # ---- Findings, in plain language, most important first
    findings = []

    def add(severity, code, title, detail, symbols=None):
        findings.append({"severity": severity, "code": code, "title": title,
                         "detail": detail, "symbols": symbols or []})

    for hsum in holdings_out:
        if hsum["sector"] == "Mutual Fund":
            # A fund is already a basket of many companies, so the single-company
            # warning does not apply. Only flag reliance on one fund manager when large.
            if hsum["weight"] >= 0.40:
                add("low", "fund_concentration",
                    f"{hsum['symbol']} is {pct(hsum['weight'])} of the portfolio",
                    "A mutual fund is diversified inside, so this is not single-company risk. "
                    "It does mean a large share of your money depends on one fund manager's decisions.",
                    [hsum["symbol"]])
            continue
        if hsum["weight"] >= 0.20:
            add("high", "concentration", f"{hsum['symbol']} is {pct(hsum['weight'])} of the portfolio",
                "One holding above 20% means a single company's bad year becomes the portfolio's bad year.",
                [hsum["symbol"]])
        if hsum["riskShare"] >= 0.10 and hsum["riskShare"] >= 1.5 * hsum["weight"]:
            add("medium", "risk_heavy",
                f"{hsum['symbol']} carries {pct(hsum['riskShare'])} of the risk on {pct(hsum['weight'])} of the money",
                "It swings more than the rest of the portfolio, or moves with your other holdings, "
                "so it drives more of the ups and downs than its size suggests.",
                [hsum["symbol"]])
    for s in sectors_out:
        if s["riskShare"] >= 0.40:
            add("high" if s["riskShare"] >= 0.55 else "medium", "sector_risk",
                f"{s['sector']} drives {pct(s['riskShare'])} of portfolio risk",
                f"It holds {pct(s['weight'])} of the money. Stocks in one sector tend to fall together, "
                "so spreading across more names inside the same sector does not lower this.",
                [r["symbol"] for r in rows if r["sector"] == s["sector"]])
    pairs = []
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            if rows[i]["measured"] and rows[j]["measured"] and corr[i][j] >= 0.75 \
                    and min(rows[i]["weight"], rows[j]["weight"]) >= 0.03:
                pairs.append((corr[i][j], rows[i]["symbol"], rows[j]["symbol"]))
    for c, a, b in sorted(pairs, reverse=True)[:3]:
        add("low", "correlated_pair", f"{a} and {b} move together (correlation {c:.2f})",
            "Holding both adds little diversification; they behave close to one position.", [a, b])
    if vol_ratio is not None and vol_ratio > 1.1:
        add("medium", "above_market_risk",
            f"Portfolio swings about {vol_ratio:.1f}x as much as the market",
            f"Estimated yearly volatility {pct(port_vol)} against {pct(market_vol)} for the equal-weight index.")
    eff_n = 1.0 / hhi if hhi > 0 else 0
    if eff_n < 8:
        add("medium", "few_effective_holdings",
            f"The portfolio behaves like about {eff_n:.0f} equal-sized holdings",
            f"There are {len(rows)} holdings, but the money is concentrated in a few of them.")
    if measured_weight < 0.7:
        add("low", "coverage",
            f"Only {pct(measured_weight, 0)} of the portfolio has its own price history",
            "The rest (mostly mutual funds and new listings) is estimated from the market or sector "
            "average, so treat the risk numbers as approximate.",
            [p["symbol"] for p in proxied])
    if performance["xirr"] is not None and performance["benchmarkXirr"] is not None:
        diff = performance["xirr"] - performance["benchmarkXirr"]
        if abs(diff) >= 0.02:
            add("info", "vs_benchmark",
                f"Your return is {pct(performance['xirr'])} a year; the market index with the same deposits gave {pct(performance['benchmarkXirr'])}",
                "Money-weighted, before dividends and fees. " +
                ("Stock selection, IPO allotments and timing have added value so far." if diff > 0 else
                 "So far a plain basket of all stocks would have done better; a broad mutual fund is the practical equivalent."))
    order = {"high": 0, "medium": 1, "low": 2, "info": 3}
    findings.sort(key=lambda f: order[f["severity"]])

    step = 1
    chart = [{"date": calendar[i].isoformat(),
              "portfolio": round(port_levels[i], 2),
              "market": round(market_levels[i], 2)}
             for i in range(0, len(calendar), step)]
    peak = 0.0
    for point in chart:
        peak = max(peak, point["portfolio"])
        point["drawdown"] = round(point["portfolio"] / peak - 1.0, 4) if peak > 0 else 0.0

    sym_order = [h["symbol"] for h in holdings_out]
    idx = {r["symbol"]: i for i, r in enumerate(rows)}
    corr_out = [[round(corr[idx[a]][idx[b]], 2) for b in sym_order] for a in sym_order]

    return {
        "asOf": calendar[-1].isoformat(),
        "calculatedAt": datetime.now().isoformat(timespec="seconds"),
        "lookbackWeeks": len(calendar) - 1,
        "method": "Weekly returns of adjusted prices; correlations shrunk 20% toward their average.",
        "riskLevel": risk_level,
        "portfolio": {
            "value": round(total_value, 2),
            "cost": round(sum(r["cost"] for r in rows), 2),
            "holdingCount": len(rows),
            "volatility": round(port_vol, 4),
            "volatilityVsMarket": round(vol_ratio, 2) if vol_ratio is not None else None,
            "beta": round(beta, 2) if beta is not None else None,
            "diversificationRatio": round(weighted_vol / port_vol, 2) if port_vol > 0 else None,
            "effectiveHoldings": round(eff_n, 1),
            "averageCorrelation": round(mean_corr, 2),
            "weeklyVar95": round(var95, 4),
            "weeklyCvar95": round(cvar95, 4),
            "weeklyVar95Amount": round(var95 * total_value, 0),
            "maxDrawdown": round(max_drawdown(port_levels), 4),
            "return1y": round(trailing_return(port_levels), 4) if trailing_return(port_levels) is not None else None,
            "worstWeek": round(min(port_obs), 4) if port_obs else None,
            "bestWeek": round(max(port_obs), 4) if port_obs else None,
        },
        "market": {
            "name": "Equal-weight index of all stocks on file",
            "volatility": round(market_vol, 4),
            "maxDrawdown": round(max_drawdown(market_levels), 4),
            "return1y": round(trailing_return(market_levels), 4) if trailing_return(market_levels) is not None else None,
        },
        "performance": performance,
        "coverage": {"measuredWeight": round(measured_weight, 4), "proxied": proxied},
        "holdings": holdings_out,
        "sectors": sectors_out,
        "correlation": {"symbols": sym_order, "matrix": corr_out},
        "history": chart,
        "findings": findings,
        "disclaimer": "Estimates from past prices. They describe risk, not future returns, and are not investment advice.",
    }


def run(write=True):
    portfolio = pc.load_json(os.path.join(pc.DB_DIR, "portfolio.json"))
    fundamentals = pc.load_json(os.path.join(pc.DB_DIR, "fundamentals.json")) or {}
    report = analyze(portfolio, fundamentals)
    if write and "error" not in report:
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
    return report


def main():
    parser = argparse.ArgumentParser(description="Measure portfolio risk from price history.")
    parser.add_argument("--json", action="store_true", help="print the full report as JSON")
    args = parser.parse_args()
    report = run()
    if args.json:
        print(json.dumps(report, indent=2))
        return
    if "error" in report:
        print(report["error"])
        return
    p, m = report["portfolio"], report["market"]
    print(f"Portfolio risk as of {report['asOf']} ({report['lookbackWeeks']} weeks)")
    print(f"  Value Rs. {p['value']:,.0f}  |  risk level: {report['riskLevel']}")
    print(f"  Volatility {pct(p['volatility'])} (market {pct(m['volatility'])}), beta {p['beta']}")
    print(f"  Worst drop {pct(p['maxDrawdown'])} (market {pct(m['maxDrawdown'])}); "
          f"bad week (1 in 20): -{pct(p['weeklyVar95'])} = Rs. {p['weeklyVar95Amount']:,.0f}")
    perf = report["performance"]
    if perf.get("xirr") is not None:
        bench = pct(perf["benchmarkXirr"]) if perf.get("benchmarkXirr") is not None else "n/a"
        print(f"  Money-weighted return {pct(perf['xirr'])}/yr (index, same deposits: {bench})")
    print("\n  Holding   weight   risk share   volatility   beta")
    for h in report["holdings"][:12]:
        flag = "" if h["measured"] else "  (estimated)"
        print(f"  {h['symbol']:<8} {pct(h['weight']):>7} {pct(h['riskShare']):>11} "
              f"{pct(h['volatility']):>11} {str(h['beta']):>7}{flag}")
    print("\nFindings:")
    for f in report["findings"]:
        print(f"  [{f['severity']}] {f['title']}")
    print(f"\nSaved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
