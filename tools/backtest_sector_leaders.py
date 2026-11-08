"""
Sector Leaders point-in-time backtest (Phase 2)
===============================================
Implements docs/research/PHASE2_PREREGISTRATION.md. Read that first: it fixes every rule
here before results were seen.

At each quarterly rebalance date the script rebuilds every company as it looked on that day
(only reports public under the fixed-lag rule, the signal-day price, trailing liquidity),
scores it with the FROZEN production code in tools/score_sector_leaders.py, buys the top 3 per
sector at the next session's close, and measures returns to the next rebalance.

Usage:
    python tools/backtest_sector_leaders.py              # lags 45, 60, 90
    python tools/backtest_sector_leaders.py --lags 60

Output: .tmp/backtest/sector_leaders_lag<L>.json  (per-period detail + summary)
"""

import argparse
import bisect
import glob
import hashlib
import json
import math
import os
import statistics
import sys
from collections import defaultdict
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from quarterly_db import normalize_sector  # noqa: E402
from tools import score_sector_leaders as SL  # noqa: E402
from tools.report_availability import quarter_end  # noqa: E402

FROZEN = {
    "tools/score_sector_leaders.py": "76ee5142044a8992fd1ea7e90d3e068778d58ea6d685d2706a6bd5e80383f455",
    "quarterly_db.py": "14c723ec2de32ba6a2415ef44e8285ac7cbf5c8b7a3cce7c751dbfb88cf338a2",
}
PRICES_DIR = os.path.join(ROOT, "db", "prices")
QUARTERLY_DIR = os.path.join(ROOT, "db", "quarterly")
DIVIDENDS_PATH = os.path.join(ROOT, "db", "dividend_data.json")
OUT_DIR = os.path.join(ROOT, ".tmp", "backtest")

CALENDAR_LAG = 60            # rebalance calendar is fixed on the 60-day availability dates
FIRST_FY, LAST_FY = "2079-80", "2082-83"
EPS_WINDOW = 8               # quarters used for the EPS trend
TURNOVER_SESSIONS = 20
STALE_CAL_DAYS = 7
COST_PER_SIDE = 0.005
TOP_N = 3


# ---------------------------------------------------------------- integrity

def sha256(path):
    """SHA-256 of the file with CRLF normalised to LF, so a Windows checkout
    (core.autocrlf=true) hashes the same as the LF original."""
    with open(path, "rb") as f:
        return hashlib.sha256(f.read().replace(b"\r\n", b"\n")).hexdigest()


def check_frozen():
    bad = [p for p, h in FROZEN.items() if sha256(os.path.join(ROOT, p)) != h]
    if bad:
        raise SystemExit(f"Frozen algorithm changed: {bad}. Record a deviation before re-running.")


# ---------------------------------------------------------------- data

class Prices:
    """Per-symbol adjusted closes (for returns) and raw close x volume (for liquidity)."""

    def __init__(self, series: dict, calendar: list):
        self.series = series          # sym -> {"dates": [...], "adj": [...], "turn": {date: npr}}
        self.calendar = calendar      # sorted union of all session dates

    @classmethod
    def load(cls, symbols=None):
        series, cal = {}, set()
        for path in glob.glob(os.path.join(PRICES_DIR, "*.json")):
            if os.path.basename(path).startswith("_"):
                continue
            with open(path, encoding="utf-8") as f:
                doc = json.load(f)
            sym = doc["symbol"]
            if symbols is not None and sym not in symbols:
                continue
            adj = [r for r in doc["adjusted"]["rows"] if r[4] and r[4] > 0]
            turn = {r[0]: (r[4] or 0) * (r[5] or 0) for r in doc["raw"]["rows"]}
            series[sym] = {"dates": [r[0] for r in adj], "adj": [r[4] for r in adj], "turn": turn}
            cal.update(series[sym]["dates"])
        return cls(series, sorted(cal))

    def last_on_or_before(self, sym, d):
        """(date, adjusted close) of the last trade on or before d, else (None, None)."""
        s = self.series.get(sym)
        if not s:
            return None, None
        i = bisect.bisect_right(s["dates"], d) - 1
        return (s["dates"][i], s["adj"][i]) if i >= 0 else (None, None)

    def session_on_or_before(self, d):
        i = bisect.bisect_right(self.calendar, d) - 1
        return self.calendar[i] if i >= 0 else None

    def session_after(self, d):
        i = bisect.bisect_right(self.calendar, d)
        return self.calendar[i] if i < len(self.calendar) else None

    def median_turnover(self, sym, d):
        s = self.series.get(sym)
        if not s:
            return None
        i = bisect.bisect_right(self.calendar, d)
        window = self.calendar[max(0, i - TURNOVER_SESSIONS):i]
        if not window:
            return None
        return statistics.median(s["turn"].get(x, 0.0) for x in window)

    def period_return(self, sym, entry, exit_):
        """Adjusted-close return from entry session to exit session. A stock that stops
        trading inside the period is valued at its last close (then held as cash)."""
        _, p0 = self.last_on_or_before(sym, entry)
        _, p1 = self.last_on_or_before(sym, exit_)
        if not p0 or not p1:
            return None
        return p1 / p0 - 1.0


def load_quarterly():
    docs = {}
    for path in glob.glob(os.path.join(QUARTERLY_DIR, "*.json")):
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        sym = (doc.get("symbol") or os.path.basename(path)[:-5]).upper()
        qs = []
        for q in doc.get("quarters", []):
            try:
                q = dict(q, _qe=quarter_end(q.get("fy"), q.get("quarter")))
            except ValueError:
                continue
            qs.append(q)
        qs.sort(key=lambda q: (q["fy"], q["quarter"]))
        docs[sym] = {"name": doc.get("company_name"), "sector": doc.get("sector"), "quarters": qs}
    return docs


def load_dividends():
    raw = SL.load_json(DIVIDENDS_PATH, {}) or {}
    out = {}
    for sym, d in raw.items():
        rows = [r for r in (d.get("dividends") or []) if r.get("announcementDateAD")]
        out[sym] = sorted(rows, key=lambda r: r["announcementDateAD"])
    return out


# ---------------------------------------------------------------- point-in-time record

def known_quarters(quarters, signal: date, lag: int):
    return [q for q in quarters if q["_qe"] + timedelta(days=lag) <= signal]


def build_record(sym, doc, signal: date, lag: int, prices: Prices, dividends: dict):
    """Rebuild one company exactly as the production loader would have seen it on `signal`.
    Returns None when no report is public yet or the stock has never traded."""
    known = known_quarters(doc["quarters"], signal, lag)
    if not known:
        return None
    last_trade, price = prices.last_on_or_before(sym, signal.isoformat())
    if price is None:
        return None
    qs = known[-EPS_WINDOW:]
    last = qs[-1]
    c, r, y = last.get("computed", {}) or {}, last.get("raw", {}) or {}, last.get("yoy", {}) or {}
    num = SL.num

    def first(*keys, src=c):
        for k in keys:
            v = num(src.get(k))
            if v is not None:
                return v
        return None

    rec = {"symbol": sym, "name": doc.get("name"),
           "sector": normalize_sector(doc.get("sector"), doc.get("name")),
           "period": f"{last['fy']}-Q{last['quarter']}", "history_depth": len(qs)}

    # Same precedence as production load_universe() section 2 (note: `or` treats 0 as missing).
    rec["eps_ttm"] = first("eps_ttm") or first("EPS Reported", src=r)
    rec["bvps"] = first("bvps") or first("Book Value Reported", src=r)
    rec["roe"] = first("roe_ttm") or first("ROE Reported", src=r)

    profit, revenue, assets = first("net_profit_ttm"), first("revenue_ttm"), num(r.get("Total Assets"))
    roa = first("roa_ttm")
    if roa is None and profit is not None and assets:
        roa = profit * 4.0 / last["quarter"] / assets * 100.0       # YTD profit annualised
    rec["roa"] = roa
    margin = first("net_margin")
    if margin is None and profit is not None and revenue:
        margin = profit / revenue * 100.0                            # both YTD
    rec["net_margin"] = margin

    # Valuation from the signal-day price, never the harvest-day price.
    eps, bvps = rec["eps_ttm"], rec["bvps"]
    rec["ltp"] = price
    rec["pe"] = price / eps if eps and eps > 0 else None
    rec["pb"] = price / bvps if bvps and bvps > 0 else None
    gn = first("graham_number")
    rec["graham_discount"] = (gn / price - 1.0) if gn else None

    rec["eps_growth"] = first("eps_ttm", "EPS Reported", src=y)
    rec["rev_growth"] = first("revenue_ttm", "Revenue", "Revenue Till Qtr", src=y)
    rec["profit_growth"] = first("net_profit_ttm", "Net Profit", src=y)
    g, cons, cv = SL.eps_trend([num((q.get("computed") or {}).get("eps_ttm")) for q in qs])
    if rec["eps_growth"] is None:
        rec["eps_growth"] = g
    rec["trend_growth"], rec["consistency"], rec["eps_cv"] = g, cons, cv

    rec["car"] = first("CAR", "car", src=r)
    rec["npl"] = first("NPL", "npl", src=r)
    rec["cd"] = first("Credit To Deposit Ratio", "CD ratio", "CD Ratio", "cd_ratio", src=r)
    rec["solvency"] = first("Solvency Ratio", src=r)
    borrow, equity = first("Borrowings", src=r), first("Total Equity", src=r)
    rec["de"] = (borrow / equity) if (equity and equity > 0 and borrow is not None) else None

    rec.update(roa_prev=None, margin_prev=None, de_prev=None, shares_growth=None)
    prev = next((q for q in qs if q.get("quarter") == last.get("quarter") and q.get("fy") != last.get("fy")), None)
    if prev:
        pc, pr = prev.get("computed", {}) or {}, prev.get("raw", {}) or {}
        rec["roa_prev"] = num(pc.get("roa_ttm"))
        rec["margin_prev"] = num(pc.get("net_margin"))
        pb_, pe_ = num(pr.get("Borrowings")), num(pr.get("Total Equity"))
        if pe_ and pe_ > 0 and pb_ is not None:
            rec["de_prev"] = pb_ / pe_
        sh_now, sh_prev = num(r.get("Number of Shares")), num(pr.get("Number of Shares"))
        if sh_now and sh_prev:
            rec["shares_growth"] = (sh_now / sh_prev - 1) * 100.0

    # Liquidity and staleness at the signal date.
    rec["turnover"] = prices.median_turnover(sym, signal.isoformat())
    rec["days_since_trade"] = (signal - date.fromisoformat(last_trade)).days
    rec["price_is_stale"] = rec["days_since_trade"] > STALE_CAL_DAYS

    # Dividends announced on or before the signal date only.
    rows = [x for x in dividends.get(sym, []) if x["announcementDateAD"] <= signal.isoformat()][-5:]
    rec["payout_ratio"] = rec["div_yield"] = rec["bonus_avg5"] = rec["bonus_years_frac"] = None
    if rows:
        rec["bonus_avg5"] = statistics.fmean(num(x.get("totalPercent")) or 0.0 for x in rows)
        rec["bonus_years_frac"] = sum(1 for x in rows if (num(x.get("totalPercent")) or 0) > 0) / 5.0
        cash = num(rows[-1].get("cashPercent")) or 0.0                # % of Rs 100 face = Rs/share
        rec["payout_ratio"] = cash / eps if eps and eps > 0 else None
        rec["div_yield"] = cash / price
    return rec


# ---------------------------------------------------------------- statistics

def spearman(xs, ys):
    if len(xs) < 3:
        return None
    rx = SL.percentile_ranks(dict(enumerate(xs)))
    ry = SL.percentile_ranks(dict(enumerate(ys)))
    a = [rx[i] for i in range(len(xs))]
    b = [ry[i] for i in range(len(ys))]
    ma, mb = statistics.fmean(a), statistics.fmean(b)
    cov = sum((p - ma) * (q - mb) for p, q in zip(a, b))
    va = math.sqrt(sum((p - ma) ** 2 for p in a))
    vb = math.sqrt(sum((q - mb) ** 2 for q in b))
    return cov / (va * vb) if va and vb else None


def tstat(xs):
    xs = [x for x in xs if x is not None]
    if len(xs) < 2:
        return None
    sd = statistics.stdev(xs)
    return statistics.fmean(xs) / (sd / math.sqrt(len(xs))) if sd else None


def ew(rets):
    rets = [r for r in rets if r is not None]
    return statistics.fmean(rets) if rets else None


# ---------------------------------------------------------------- backtest

def rebalance_dates():
    out = []
    y = int(FIRST_FY[:4])
    while True:
        fy = f"{y}-{(y + 1) % 100:02d}"
        if fy > LAST_FY:
            break
        for q in (1, 2, 3, 4):
            out.append(quarter_end(fy, q) + timedelta(days=CALENDAR_LAG))
        y += 1
    return out


def run(lag: int, prices: Prices, docs: dict, dividends: dict):
    dates = rebalance_dates()
    last_price_day = prices.calendar[-1]
    periods, prev_weights = [], {}
    for d0, d1 in zip(dates, dates[1:]):
        signal = prices.session_on_or_before(d0.isoformat())
        entry = prices.session_after(signal)
        exit_signal = prices.session_on_or_before(d1.isoformat())
        exit_ = prices.session_after(exit_signal) if exit_signal else None
        if not entry or not exit_ or exit_ > last_price_day or d1.isoformat() > last_price_day:
            continue                                   # incomplete period: excluded by rule
        sig = date.fromisoformat(signal)
        recs = {}
        for sym, doc in docs.items():
            rec = build_record(sym, doc, sig, lag, prices, dividends)
            if rec:
                recs[sym] = rec
        results, leaders, excluded = SL.score_universe(recs, top_n=TOP_N)

        rets = {s: prices.period_return(s, entry, exit_) for s in recs}
        eligible = list(results)
        holdings = [x["symbol"] for xs in leaders.values() for x in xs]
        port_gross = ew([rets[s] for s in holdings])

        # benchmarks
        sec_of = {s: results[s]["sector"] for s in eligible}
        by_sec = defaultdict(list)
        for s in eligible:
            by_sec[sec_of[s]].append(s)
        sec_mean = {sec: ew([rets[s] for s in syms]) for sec, syms in by_sec.items()}
        hold_secs = defaultdict(int)
        for s in holdings:
            hold_secs[sec_of[s]] += 1
        matched = sum(n * sec_mean[sec] for sec, n in hold_secs.items() if sec_mean[sec] is not None) / len(holdings)
        bench_eligible = ew([rets[s] for s in eligible])
        bench_all = ew([rets[s] for s in recs if not recs[s]["price_is_stale"]])

        # costs: trade from drifted previous weights to new equal weights
        new_w = {s: 1.0 / len(holdings) for s in holdings}
        traded = sum(abs(new_w.get(s, 0.0) - prev_weights.get(s, 0.0)) for s in set(new_w) | set(prev_weights))
        cost = COST_PER_SIDE * traded
        port_net = port_gross - cost
        grown = {s: w * (1 + (rets[s] or 0.0)) for s, w in new_w.items()}
        tot = sum(grown.values())
        prev_weights = {s: v / tot for s, v in grown.items()} if tot else {}

        # sector-neutral information coefficient
        xs, ys = [], []
        for s in eligible:
            if rets[s] is not None and sec_mean[sec_of[s]] is not None:
                xs.append(results[s]["score"])
                ys.append(rets[s] - sec_mean[sec_of[s]])
        ic = spearman(xs, ys)

        periods.append({
            "rebalance": d0.isoformat(), "signal": signal, "entry": entry, "exit": exit_,
            "universe": len(recs), "eligible": len(eligible), "excluded": len(excluded),
            "holdings": holdings, "n_holdings": len(holdings),
            "port_gross": port_gross, "port_net": port_net, "cost": cost,
            "bench_sector_matched": matched, "bench_eligible": bench_eligible, "bench_all": bench_all,
            "excess_vs_matched": port_gross - matched, "ic": ic,
        })
    return periods


def summarize(periods):
    def comp(key):
        v = 1.0
        for p in periods:
            v *= 1 + p[key]
        return v - 1

    ex = [p["excess_vs_matched"] for p in periods]
    ics = [p["ic"] for p in periods if p["ic"] is not None]
    years = (date.fromisoformat(periods[-1]["exit"]) - date.fromisoformat(periods[0]["entry"])).days / 365.25
    ann = lambda total: (1 + total) ** (1 / years) - 1 if years > 0 else None
    out = {"periods": len(periods), "first_entry": periods[0]["entry"], "last_exit": periods[-1]["exit"],
           "years": round(years, 2)}
    for k in ("port_gross", "port_net", "bench_sector_matched", "bench_eligible", "bench_all"):
        total = comp(k)
        out[k] = {"total": round(total, 4), "annualised": round(ann(total), 4)}
    out["excess_vs_matched"] = {"mean_per_period": round(statistics.fmean(ex), 4), "t_stat": _r(tstat(ex)),
                                "hit_rate": round(sum(1 for x in ex if x > 0) / len(ex), 3)}
    out["ic"] = {"mean": _r(statistics.fmean(ics) if ics else None), "t_stat": _r(tstat(ics)),
                 "positive_share": round(sum(1 for x in ics if x > 0) / len(ics), 3) if ics else None}
    out["avg_holdings"] = round(statistics.fmean(p["n_holdings"] for p in periods), 1)
    out["avg_eligible"] = round(statistics.fmean(p["eligible"] for p in periods), 1)
    return out


def _r(x, nd=4):
    return None if x is None else round(x, nd)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lags", type=int, nargs="+", default=[45, 60, 90])
    args = ap.parse_args()
    check_frozen()
    docs = load_quarterly()
    prices = Prices.load(set(docs))
    dividends = load_dividends()
    os.makedirs(OUT_DIR, exist_ok=True)
    for lag in args.lags:
        periods = run(lag, prices, docs, dividends)
        summary = summarize(periods)
        with open(os.path.join(OUT_DIR, f"sector_leaders_lag{lag}.json"), "w", encoding="utf-8") as f:
            json.dump({"lag_days": lag, "frozen_hashes": FROZEN, "summary": summary, "periods": periods}, f, indent=1)
        print(f"\n=== lag {lag} days ===")
        print(json.dumps(summary, indent=1))
        print(" rebalance   elig hold   port%   matched%  excess%    IC")
        for p in periods:
            print(f" {p['rebalance']}  {p['eligible']:4d} {p['n_holdings']:4d}  {p['port_gross']*100:7.2f}  "
                  f"{p['bench_sector_matched']*100:7.2f}  {p['excess_vs_matched']*100:7.2f}  "
                  f"{p['ic'] if p['ic'] is None else round(p['ic'], 3)}")


if __name__ == "__main__":
    main()
