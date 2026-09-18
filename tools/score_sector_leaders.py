"""
Sector Leaders v2 -- research-backed, sector-relative company ranking (PROTOTYPE)
================================================================================
Ranks every scoreable NEPSE company inside its own sector and returns the top
N per sector for the Intelligence page.  This is the reference implementation
of docs/SECTOR_LEADERS_ALGORITHM.md; read that first for the reasoning, the
literature, and the data-coverage caveats.

Design in one paragraph
-----------------------
Hard eligibility gates first (Nepal regulatory floors, loss-makers, stale or
untraded prices), then five pillars -- Profitability, Growth, Safety, Payout,
Valuation -- each a sector-relative percentile rank (Piotroski-style rank
robustness; QMJ pillar structure), blended toward the market-wide rank when a
sector is small (Bayesian shrinkage, k=8), combined with sector-specific
weights, then multiplied by a data-completeness factor so a company can never
win on the strength of fields it does not report.  A 9-point Piotroski-style
checklist is computed alongside for explainability and tie-breaking.

Data sources (all local, nothing fetched):
    db/fundamentals_archive/<SYM>.json   market-wide snapshot rows (one per quarter)
    db/quarterly/<SYM>.json              8-quarter deep history (portfolio symbols)
    db/dividend_data.json                dividend history (HamroShare)
    ../Nepse Fundamentals/.tmp/raw_data.json    merolagani bonus history (optional)
    ../Nepse Fundamentals/.tmp/nepse_alpha_scoreboard.json  YoY profit growth (optional)

Usage:
    python tools/score_sector_leaders.py                 # prints top 3 per sector
    python tools/score_sector_leaders.py --explain SAHAS NABIL HDL
    python tools/score_sector_leaders.py --top 5 --json .tmp/sector_leaders.json
"""

import argparse
import glob
import json
import math
import os
import re
import statistics
from collections import defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "db")
LOCAL_TMP = os.path.join(ROOT, ".tmp")
EXTERNAL_TMP = os.path.join(os.path.dirname(ROOT), "Nepse Fundamentals", ".tmp")
NEPSE_FUND_DIR = LOCAL_TMP if os.path.exists(LOCAL_TMP) else EXTERNAL_TMP

# ----------------------------------------------------------------------------
# Regulatory floors (Nepal). Sources in docs/SECTOR_LEADERS_ALGORITHM.md.
# ----------------------------------------------------------------------------
MIN_CAR = {"Commercial Bank": 11.0, "Development Bank": 10.0, "Finance": 10.0, "Microfinance": 8.0}
NPL_EXCLUDE = 10.0          # asset-quality crisis: hard exclusion
NPL_WATCH = 5.0             # NRB watch level: penalised inside Safety
CD_CEILING = 90.0           # NRB credit-to-deposit ceiling for BFIs
MIN_SOLVENCY = 1.30         # NIA risk-based capital directive target (was 1.5)
STALE_DAYS = 5              # one NEPSE trading week
MIN_TURNOVER = 100_000      # NPR on capture day (filters out truly dormant/untraded scrips)
SHRINK_K = 8                # sector size at which sector rank and market rank get equal weight

# Pillar weights per sector (P, G, S, Y, V). Must sum to 1.
DEFAULT_WEIGHTS = {"P": 0.30, "G": 0.20, "S": 0.20, "Y": 0.15, "V": 0.15}
SECTOR_WEIGHTS = {
    "Commercial Bank":    {"P": 0.30, "G": 0.15, "S": 0.25, "Y": 0.15, "V": 0.15},
    "Development Bank":   {"P": 0.30, "G": 0.15, "S": 0.25, "Y": 0.15, "V": 0.15},
    "Finance":            {"P": 0.30, "G": 0.15, "S": 0.25, "Y": 0.15, "V": 0.15},
    "Microfinance":       {"P": 0.25, "G": 0.15, "S": 0.30, "Y": 0.15, "V": 0.15},
    "Life Insurance":     {"P": 0.30, "G": 0.20, "S": 0.25, "Y": 0.10, "V": 0.15},
    "Non-Life Insurance": {"P": 0.30, "G": 0.20, "S": 0.25, "Y": 0.10, "V": 0.15},
    "Hydropower":         {"P": 0.30, "G": 0.20, "S": 0.25, "Y": 0.10, "V": 0.15},
    "Manufacturing":      {"P": 0.35, "G": 0.20, "S": 0.15, "Y": 0.15, "V": 0.15},
}

# Metric weights inside the Profitability pillar
PROFIT_WEIGHTS = {
    "default":         {"roe": 0.50, "roa": 0.25, "net_margin": 0.25},
    "Commercial Bank": {"roe": 0.40, "roa": 0.40, "net_margin": 0.20},
    "Development Bank": {"roe": 0.40, "roa": 0.40, "net_margin": 0.20},
    "Finance":         {"roe": 0.40, "roa": 0.40, "net_margin": 0.20},
    "Microfinance":    {"roe": 0.40, "roa": 0.40, "net_margin": 0.20},
    "Hydropower":      {"roe": 0.40, "roa": 0.35, "net_margin": 0.25},
}


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def num(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else float(v)
    s = str(v).strip().replace(",", "").replace("%", "")
    if s in ("", "N/A", "-", "null"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def normalize_sector(s):
    if not s:
        return "Others"
    t = s.lower()
    if "development" in t:
        return "Development Bank"
    if "bank" in t:
        return "Commercial Bank"
    if "microfinance" in t or "laghubitta" in t:
        return "Microfinance"
    if "non" in t and "insurance" in t:
        return "Non-Life Insurance"
    if "reinsurance" in t:
        return "Non-Life Insurance"
    if "insurance" in t:
        return "Life Insurance"
    if "hydro" in t:
        return "Hydropower"
    if "manufactur" in t or "distiller" in t or "cement" in t:
        return "Manufacturing"
    if "hotel" in t or "tourism" in t:
        return "Hotels & Tourism"
    if "invest" in t:
        return "Investment"
    if "trad" in t:
        return "Trading"
    if "finance" in t:
        return "Finance"
    if "fund" in t or "mutual" in t:
        return "Mutual Fund"
    if "debenture" in t or "bond" in t or "preference" in t:
        return "Debt"
    return "Others"


def clip(v, lo, hi):
    return None if v is None else max(lo, min(hi, v))


def percentile_ranks(values):
    """values: {symbol: number|None}. Returns {symbol: 0..100} using average
    ranks for ties; None values are excluded (caller decides how to treat)."""
    items = [(s, v) for s, v in values.items() if v is not None]
    n = len(items)
    if n == 0:
        return {}
    if n == 1:
        return {items[0][0]: 50.0}
    items.sort(key=lambda x: x[1])
    ranks = {}
    i = 0
    while i < n:
        j = i
        while j + 1 < n and items[j + 1][1] == items[i][1]:
            j += 1
        avg = (i + j) / 2.0
        for k in range(i, j + 1):
            ranks[items[k][0]] = 100.0 * avg / (n - 1)
        i = j + 1
    return ranks


def wmean(pairs):
    """pairs: list of (value|None, weight). Renormalises over present values.
    Returns (mean|None, completeness 0..1)."""
    tot_w = sum(w for _, w in pairs)
    present = [(v, w) for v, w in pairs if v is not None]
    if not present or tot_w == 0:
        return None, 0.0
    pw = sum(w for _, w in present)
    return sum(v * w for v, w in present) / pw, pw / tot_w


def eps_trend(series):
    """8-quarter TTM-EPS series (oldest->newest) -> (annualised log-slope %,
    consistency 0..1 = share of non-decreasing steps, coefficient of variation).
    Theil-Sen slope so one bad quarter cannot flip the trend."""
    xs = [v for v in series if v is not None]
    if len(xs) < 4:
        return None, None, None
    steps = sum(1 for a, b in zip(xs, xs[1:]) if b >= a)
    consistency = steps / (len(xs) - 1)
    mean = statistics.fmean(xs)
    cv = (statistics.pstdev(xs) / abs(mean)) if mean else None
    if all(v > 0 for v in xs):
        logs = [math.log(v) for v in xs]
        slopes = []
        for i in range(len(logs)):
            for j in range(i + 1, len(logs)):
                slopes.append((logs[j] - logs[i]) / (j - i))
        slope_q = statistics.median(slopes)          # per quarter
        growth = (math.exp(4 * slope_q) - 1) * 100.0  # annualised %
    else:
        growth = None
    return growth, consistency, cv


# ----------------------------------------------------------------------------
# Loading: build one unified record per symbol
# ----------------------------------------------------------------------------
def load_universe():
    recs = {}

    # 1) Market-wide snapshot archive
    for path in glob.glob(os.path.join(DB, "fundamentals_archive", "*.json")):
        doc = load_json(path, {})
        snaps = doc.get("snapshots") or []
        if not snaps:
            continue
        s = snaps[-1]
        sym = doc.get("symbol") or os.path.basename(path)[:-5]
        sector = normalize_sector(s.get("sector") or doc.get("sector"))
        pe = num(s.get("pe_ratio"))
        recs[sym] = {
            "symbol": sym, "name": doc.get("full_name"), "sector": sector,
            "period": s.get("reported_quarter"), "captured_at": s.get("captured_at"),
            "ltp": num(s.get("ltp_at_capture")),
            "eps_ttm": num(s.get("eps_ttm")), "bvps": num(s.get("book_value")),
            "roe": num(s.get("roe")), "roa": num(s.get("roa")),
            "net_margin": num(s.get("net_margin_ttm")),
            "pe": pe, "pb": num(s.get("pb_ratio")),
            "graham_discount": num(s.get("discount_from_graham")),
            "payout_ratio": num(s.get("dividend_payout_ratio")),
            "div_yield": num(s.get("dividend_to_ltp")),
            "promoter": num(s.get("promoter_holding")),
            "turnover": num(s.get("trade_turnover")),
            "days_since_trade": num(s.get("days_since_trade")),
            "price_is_stale": bool(s.get("price_is_stale", False)),
            "quarters": len(snaps),
            "eps_growth": None, "rev_growth": None, "profit_growth": None,
            "consistency": None, "eps_cv": None,
            "car": None, "npl": None, "cd": None, "solvency": None, "de": None,
            "de_prev": None, "roa_prev": None, "margin_prev": None,
            "shares_growth": None, "bonus_avg5": None, "bonus_years_frac": None,
            "history_depth": 1,
        }

    # 2) Deep 8-quarter files override / enrich
    for path in glob.glob(os.path.join(DB, "quarterly", "*.json")):
        doc = load_json(path, {})
        qs = doc.get("quarters") or []
        if not qs:
            continue
        sym = (doc.get("symbol") or os.path.basename(path)[:-5]).upper()
        qs = sorted(qs, key=lambda q: (q.get("fy", ""), q.get("quarter", 0)))
        last = qs[-1]
        c, r, y = last.get("computed", {}), last.get("raw", {}), last.get("yoy", {})
        rec = recs.get(sym) or {"symbol": sym, "name": doc.get("company_name"),
                                "sector": normalize_sector(doc.get("sector")),
                                "quarters": 0, "promoter": None, "turnover": None,
                                "days_since_trade": None, "price_is_stale": False,
                                "payout_ratio": None, "div_yield": None,
                                "graham_discount": None, "ltp": None,
                                "bonus_avg5": None, "bonus_years_frac": None}
        if rec.get("sector") in (None, "Others") and doc.get("sector"):
            rec["sector"] = normalize_sector(doc.get("sector"))
        rec["period"] = f"{last.get('fy')}-Q{last.get('quarter')}"
        rec["history_depth"] = len(qs)

        def first(*keys, src=c):
            for k in keys:
                v = num(src.get(k))
                if v is not None:
                    return v
            return None

        rec["eps_ttm"] = first("eps_ttm") or first("EPS Reported", src=r) or rec.get("eps_ttm")
        rec["bvps"] = first("bvps") or first("Book Value Reported", src=r) or rec.get("bvps")
        rec["roe"] = first("roe_ttm") or first("ROE Reported", src=r) or rec.get("roe")
        rec["roa"] = first("roa_ttm") if first("roa_ttm") is not None else rec.get("roa")
        rec["net_margin"] = first("net_margin") if first("net_margin") is not None else rec.get("net_margin")
        rec["pe"] = first("pe_ratio") if first("pe_ratio") is not None else rec.get("pe")
        rec["pb"] = first("pb_ratio") if first("pb_ratio") is not None else rec.get("pb")
        gn = first("graham_number")
        if gn and rec.get("ltp"):
            rec["graham_discount"] = gn / rec["ltp"] - 1.0

        # growth: YoY blocks first, else derive from 4-quarters-back
        rec["eps_growth"] = first("eps_ttm", "EPS Reported", src=y)
        rec["rev_growth"] = first("revenue_ttm", "Revenue", "Revenue Till Qtr", src=y)
        rec["profit_growth"] = first("net_profit_ttm", "Net Profit", src=y)
        series = [num(q.get("computed", {}).get("eps_ttm")) for q in qs]
        g, cons, cv = eps_trend(series)
        if rec["eps_growth"] is None:
            rec["eps_growth"] = g
        rec["trend_growth"] = g
        rec["consistency"] = cons
        rec["eps_cv"] = cv

        # safety raw fields
        rec["car"] = first("CAR", "car", src=r)
        rec["npl"] = first("NPL", "npl", src=r)
        rec["cd"] = first("Credit To Deposit Ratio", "CD ratio", "CD Ratio", "cd_ratio", src=r)
        rec["solvency"] = first("Solvency Ratio", src=r)
        borrow = first("Borrowings", src=r)
        equity = first("Total Equity", src=r)
        if equity and equity > 0:
            rec["de"] = (borrow or 0.0) / equity if borrow is not None else None
        # prior-year comparables for the checklist
        prev = next((q for q in qs if q.get("quarter") == last.get("quarter")
                     and q.get("fy") != last.get("fy")), None)
        if prev:
            pc, pr = prev.get("computed", {}), prev.get("raw", {})
            rec["roa_prev"] = num(pc.get("roa_ttm"))
            rec["margin_prev"] = num(pc.get("net_margin"))
            pb_, pe_ = num(pr.get("Borrowings")), num(pr.get("Total Equity"))
            if pe_ and pe_ > 0 and pb_ is not None:
                rec["de_prev"] = pb_ / pe_
            sh_now, sh_prev = num(r.get("Number of Shares")), num(pr.get("Number of Shares"))
            if sh_now and sh_prev:
                rec["shares_growth"] = (sh_now / sh_prev - 1) * 100.0
        recs[sym] = rec

    # 3) Dividend history (HamroShare) -> payout consistency
    divs = load_json(os.path.join(DB, "dividend_data.json"), {}) or {}
    for sym, d in divs.items():
        if sym not in recs:
            continue
        rows = d.get("dividends") or []
        rows = sorted(rows, key=lambda x: x.get("fiscalYear", ""), reverse=True)[:5]
        if rows:
            recs[sym]["bonus_avg5"] = statistics.fmean(num(x.get("totalPercent")) or 0.0 for x in rows)
            recs[sym]["bonus_years_frac"] = sum(1 for x in rows if (num(x.get("totalPercent")) or 0) > 0) / 5.0

    # 3b) merolagani history for symbols not covered above
    raw = load_json(os.path.join(NEPSE_FUND_DIR, "raw_data.json"), []) or []
    for r in raw:
        sym = r.get("symbol")
        if sym in recs and recs[sym].get("bonus_avg5") is None:
            byfy = defaultdict(float)
            for x in (r.get("bonus_shares") or []):
                byfy[x.get("fy")] += num(x.get("value")) or 0.0
            for x in (r.get("cash_dividends") or []):
                byfy[x.get("fy")] += num(x.get("value")) or 0.0
            fys = sorted(byfy.keys(), reverse=True)[:5]
            if fys:
                recs[sym]["bonus_avg5"] = statistics.fmean(byfy[f] for f in fys)
                recs[sym]["bonus_years_frac"] = sum(1 for f in fys if byfy[f] > 0) / 5.0

    # 3c) scoreboard YoY profit growth as a stop-gap for symbols without history
    sb = load_json(os.path.join(NEPSE_FUND_DIR, "nepse_alpha_scoreboard.json"), []) or []
    for r in sb:
        sym = r.get("Symbol")
        if sym in recs and recs[sym].get("profit_growth") is None:
            recs[sym]["profit_growth"] = num(r.get("YoY Growth"))
            if recs[sym].get("eps_growth") is None:
                recs[sym]["eps_growth"] = num(r.get("YoY Growth"))
    return recs


# ----------------------------------------------------------------------------
# Stage 0: eligibility gates
# ----------------------------------------------------------------------------
def gate(rec):
    """Returns list of reasons the company is excluded (empty = eligible)."""
    why = []
    sec = rec["sector"]
    if sec in ("Mutual Fund", "Debt"):
        why.append("not an operating company")
    if rec.get("eps_ttm") is None or rec.get("bvps") is None:
        why.append("missing EPS/BVPS")
    else:
        if rec["eps_ttm"] <= 0:
            why.append("loss-making (EPS TTM <= 0)")
        if rec["bvps"] <= 0:
            why.append("negative book value")
    if rec.get("roe") is not None and rec["roe"] < 0:
        why.append("negative ROE")
    if rec.get("price_is_stale"):
        why.append(f"price stale (> {STALE_DAYS} days since last trade)")
    if rec.get("turnover") is not None and rec["turnover"] < MIN_TURNOVER:
        why.append(f"illiquid (turnover < NPR {MIN_TURNOVER:,})")
    car_min = MIN_CAR.get(sec)
    if car_min and rec.get("car") is not None and rec["car"] < car_min:
        why.append(f"CAR {rec['car']:.2f}% below regulatory {car_min}%")
    if sec in MIN_CAR and rec.get("npl") is not None and rec["npl"] > NPL_EXCLUDE:
        why.append(f"NPL {rec['npl']:.2f}% > {NPL_EXCLUDE}%")
    if sec in ("Life Insurance", "Non-Life Insurance") and rec.get("solvency") is not None \
            and rec["solvency"] < MIN_SOLVENCY:
        why.append(f"solvency {rec['solvency']:.2f} < {MIN_SOLVENCY}")
    return why


# ----------------------------------------------------------------------------
# Stage 1-3: pillars, shrinkage, composite
# ----------------------------------------------------------------------------
def build_metric_table(recs):
    """Per-company raw pillar inputs, sign-adjusted so higher is always better."""
    t = {}
    for sym, r in recs.items():
        ey = (1.0 / r["pe"]) if r.get("pe") and r["pe"] > 0 else None
        cd_score = None
        if r.get("cd") is not None:
            cd_score = -abs(r["cd"] - 80.0)            # 80% is comfortable; 90% is the ceiling
        npl_score = None
        if r.get("npl") is not None:
            npl_score = -r["npl"] - (5.0 if r["npl"] > NPL_WATCH else 0.0)
        t[sym] = {
            # Profitability
            "roe": r.get("roe"), "roa": r.get("roa"), "net_margin": r.get("net_margin"),
            # Growth (winsorised so one restatement cannot dominate)
            "eps_growth": clip(r.get("eps_growth"), -100, 150),
            "rev_growth": clip(r.get("rev_growth"), -100, 150),
            "profit_growth": clip(r.get("profit_growth"), -100, 150),
            "consistency": (r["consistency"] * 100.0) if r.get("consistency") is not None else None,
            # Safety (higher = safer)
            "car": r.get("car"), "npl_s": npl_score, "cd_s": cd_score,
            "solvency": r.get("solvency"),
            "de_s": (-r["de"]) if r.get("de") is not None else None,
            "stability": (-r["eps_cv"]) if r.get("eps_cv") is not None else None,
            # Payout
            "payout": clip(r.get("payout_ratio"), 0, 1.0),
            "div_yield": r.get("div_yield"),
            "bonus_avg5": r.get("bonus_avg5"), "bonus_years": r.get("bonus_years_frac"),
            # Valuation (higher = cheaper)
            "earnings_yield": ey, "pb_s": (-r["pb"]) if r.get("pb") and r["pb"] > 0 else None,
            "graham_discount": r.get("graham_discount"),
        }
    return t


PILLAR_METRICS = {
    "P": lambda sec: [(k, w) for k, w in PROFIT_WEIGHTS.get(sec, PROFIT_WEIGHTS["default"]).items()],
    "G": lambda sec: [("eps_growth", 0.45), ("rev_growth", 0.25), ("consistency", 0.30)],
    "Y": lambda sec: [("payout", 0.30), ("div_yield", 0.25), ("bonus_avg5", 0.25), ("bonus_years", 0.20)],
    "V": lambda sec: [("earnings_yield", 0.45), ("pb_s", 0.30), ("graham_discount", 0.25)],
}


def safety_metrics(sec):
    if sec in ("Commercial Bank", "Development Bank", "Finance"):
        return [("car", 0.35), ("npl_s", 0.35), ("cd_s", 0.15), ("stability", 0.15)]
    if sec == "Microfinance":
        return [("npl_s", 0.45), ("car", 0.35), ("stability", 0.20)]
    if sec in ("Life Insurance", "Non-Life Insurance"):
        return [("solvency", 0.60), ("stability", 0.40)]
    return [("de_s", 0.55), ("stability", 0.45)]          # Hydropower, Manufacturing, Hotels, Others


def score_universe(recs, top_n=3):
    eligible = {s: r for s, r in recs.items() if not gate(r)}
    excluded = {s: gate(r) for s, r in recs.items() if gate(r)}
    table = build_metric_table(eligible)

    # market-wide and sector-wide percentile ranks for every metric
    metrics = set()
    for v in table.values():
        metrics.update(v.keys())
    market_pct = {m: percentile_ranks({s: table[s][m] for s in table}) for m in metrics}
    by_sector = defaultdict(list)
    for s, r in eligible.items():
        by_sector[r["sector"]].append(s)
    sector_pct = {}
    for sec, syms in by_sector.items():
        sector_pct[sec] = {m: percentile_ranks({s: table[s][m] for s in syms}) for m in metrics}

    results = {}
    for s, r in eligible.items():
        sec = r["sector"]
        n = len(by_sector[sec])
        w_sec = n / (n + SHRINK_K)                          # shrink small sectors toward market

        def pct(m):
            sp = sector_pct[sec][m].get(s)
            mp = market_pct[m].get(s)
            if sp is None and mp is None:
                return None
            if sp is None:
                return mp
            if mp is None:
                return sp
            return w_sec * sp + (1 - w_sec) * mp

        pillars, completeness = {}, {}
        for name, fn in PILLAR_METRICS.items():
            val, comp = wmean([(pct(m), w) for m, w in fn(sec)])
            pillars[name], completeness[name] = val, comp
        val, comp = wmean([(pct(m), w) for m, w in safety_metrics(sec)])
        pillars["S"], completeness["S"] = val, comp

        weights = SECTOR_WEIGHTS.get(sec, DEFAULT_WEIGHTS)
        # a pillar that is entirely missing is scored conservatively:
        # for BFIs without verified credit/safety metrics, unverified safety receives 35.0
        # other missing pillars receive 50.0; then an audited completeness haircut is applied
        comp_items = []
        for k in weights:
            if pillars[k] is not None:
                comp_items.append(weights[k] * pillars[k])
            else:
                default_val = 35.0 if k == "S" and ("Bank" in sec or sec in ("Finance", "Microfinance")) else 50.0
                comp_items.append(weights[k] * default_val)
        composite = sum(comp_items)
        data_cov = sum(weights[k] * completeness[k] for k in weights)
        final = composite * (0.80 + 0.20 * data_cov)

        results[s] = {
            "symbol": s, "name": r.get("name"), "sector": sec, "period": r.get("period"),
            "score": round(final, 1), "composite": round(composite, 1),
            "coverage": round(data_cov, 2), "sector_n": n, "shrink_w": round(w_sec, 2),
            "pillars": {k: (round(v, 1) if v is not None else None) for k, v in pillars.items()},
            "checklist": checklist(r),
            "metrics": {k: r.get(k) for k in ("eps_ttm", "bvps", "roe", "roa", "net_margin", "pe", "pb",
                                              "eps_growth", "rev_growth", "consistency", "eps_cv",
                                              "car", "npl", "cd", "solvency", "de",
                                              "payout_ratio", "div_yield", "bonus_avg5",
                                              "turnover", "days_since_trade", "history_depth")},
        }

    leaders = {}
    for sec, syms in by_sector.items():
        ranked = sorted((results[s] for s in syms),
                        key=lambda x: (x["score"], x["checklist"]["passed"], x["metrics"]["turnover"] or 0),
                        reverse=True)
        for i, x in enumerate(ranked):
            x["sector_rank"] = i + 1
        leaders[sec] = ranked[:top_n]
    return results, leaders, excluded


def checklist(r):
    """Piotroski-style binary signals adapted to what NEPSE companies report.
    Each item is (label, passed|None). None = not assessable with current data."""
    items = []
    items.append(("ROE > 0", (r["roe"] > 0) if r.get("roe") is not None else None))
    items.append(("ROA > 0", (r["roa"] > 0) if r.get("roa") is not None else None))
    items.append(("EPS TTM grew YoY", (r["eps_growth"] > 0) if r.get("eps_growth") is not None else None))
    items.append(("Revenue TTM grew YoY", (r["rev_growth"] > 0) if r.get("rev_growth") is not None else None))
    items.append(("ROA improved YoY", (r["roa"] > r["roa_prev"]) if r.get("roa") is not None and r.get("roa_prev") is not None else None))
    items.append(("Net margin improved YoY", (r["net_margin"] > r["margin_prev"]) if r.get("net_margin") is not None and r.get("margin_prev") is not None else None))
    lev = None
    if r.get("de") is not None and r.get("de_prev") is not None:
        lev = r["de"] <= r["de_prev"]
    elif r.get("cd") is not None:
        lev = r["cd"] <= CD_CEILING
    items.append(("Leverage not rising / within ceiling", lev))
    items.append(("No dilution beyond bonus", (r["shares_growth"] <= (r.get("bonus_avg5") or 0) + 1.0) if r.get("shares_growth") is not None else None))
    items.append(("Pays a dividend", ((r.get("payout_ratio") or 0) > 0 or (r.get("bonus_avg5") or 0) > 0) if (r.get("payout_ratio") is not None or r.get("bonus_avg5") is not None) else None))
    passed = sum(1 for _, v in items if v is True)
    assessable = sum(1 for _, v in items if v is not None)
    return {"passed": passed, "assessable": assessable, "items": items}


def export_top_performers(output_path=None, top_n=3):
    if output_path is None:
        output_path = os.path.join(DB, "quarterly_top_performers.json")
    recs = load_universe()
    results, leaders, excluded = score_universe(recs, top_n=top_n)
    
    period_key = "Active (Multi-Factor Leaders)"
    period_data = {}
    
    for sec, stocks in leaders.items():
        if sec in ("Debt", "Mutual Fund"):
            continue
        stock_list = []
        for s in stocks:
            m = s.get("metrics", {})
            stock_list.append({
                "symbol": s["symbol"],
                "name": s.get("name"),
                "sector": s["sector"],
                "score": s["score"],
                "composite": s["composite"],
                "coverage": s["coverage"],
                "rank": s["sector_rank"],
                "period": s.get("period"),
                "roe": m.get("roe") or 0.0,
                "roa": m.get("roa") or 0.0,
                "eps": m.get("eps_ttm") or 0.0,
                "bvps": m.get("bvps") or 0.0,
                "pe": m.get("pe") or 0.0,
                "pb": m.get("pb") or 0.0,
                "epsGrowth": m.get("eps_growth") or 0.0,
                "revGrowth": m.get("rev_growth") or 0.0,
                "profitGrowth": m.get("profit_growth") or 0.0,
                "netMargin": m.get("net_margin") or 0.0,
                "divYield": round((m.get("div_yield") or 0.0) * 100, 2) if m.get("div_yield") else 0.0,
                "pillars": s.get("pillars", {}),
                "checklist": s.get("checklist", {}),
                "turnover": m.get("turnover") or 0.0,
                "historyDepth": m.get("history_depth") or 1,
            })
        period_data[sec] = stock_list

    payload = {
        "generatedAt": datetime.now().isoformat(),
        "latestPeriod": period_key,
        "algorithm": "Sector Leaders Multi-Factor v2 (QMJ / Piotroski / Bayesian Shrinkage)",
        "periods": {
            period_key: period_data
        },
        "excludedCount": len(excluded),
        "eligibleCount": len(results)
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"[score_sector_leaders] Successfully exported top performers to {output_path}")
    return payload


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
def fmt(v, nd=1):
    return "-" if v is None else (f"{v:.{nd}f}" if isinstance(v, float) else str(v))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=3)
    ap.add_argument("--explain", nargs="*", default=[])
    ap.add_argument("--json", default=None)
    ap.add_argument("--export", action="store_true", help="Export top performers to db/quarterly_top_performers.json")
    ap.add_argument("--show-excluded", action="store_true")
    args = ap.parse_args()

    if args.export:
        export_top_performers(top_n=args.top)

    recs = load_universe()
    results, leaders, excluded = score_universe(recs, args.top)
    print(f"universe={len(recs)} eligible={len(results)} excluded={len(excluded)}")
    for sec in sorted(leaders, key=lambda s: -len([r for r in results.values() if r['sector'] == s])):
        n = sum(1 for r in results.values() if r["sector"] == sec)
        print(f"\n== {sec} (eligible n={n}, shrink w={leaders[sec][0]['shrink_w'] if leaders[sec] else '-'})")
        for x in leaders[sec]:
            p = x["pillars"]
            print(f"  #{x['sector_rank']} {x['symbol']:<8} score={x['score']:5.1f} cov={x['coverage']:.2f} "
                  f"P={fmt(p['P'])} G={fmt(p['G'])} S={fmt(p['S'])} Y={fmt(p['Y'])} V={fmt(p['V'])} "
                  f"check={x['checklist']['passed']}/{x['checklist']['assessable']} hist={x['metrics']['history_depth']}q")

    for sym in args.explain:
        sym = sym.upper()
        if sym in excluded:
            print(f"\n{sym}: EXCLUDED -> {excluded[sym]}")
            continue
        x = results.get(sym)
        if not x:
            print(f"\n{sym}: not in universe")
            continue
        print(f"\n---- {sym} ({x['sector']}, period {x['period']}) rank #{x['sector_rank']} score {x['score']} ----")
        print("  pillars:", x["pillars"], "coverage", x["coverage"], "shrink_w", x["shrink_w"])
        print("  metrics:", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in x["metrics"].items()})
        for label, v in x["checklist"]["items"]:
            print(f"  [{'x' if v else ' ' if v is False else '?'}] {label}")

    if args.show_excluded:
        print("\nexcluded:")
        for s, why in sorted(excluded.items()):
            print(f"  {s}: {'; '.join(why)}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump({"leaders": leaders, "all": results, "excluded": excluded}, f, indent=2, default=str)
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
