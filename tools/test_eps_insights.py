"""EPS insights: TTM vs annualized EPS, flags, personal arithmetic. Synthetic data except the
anchor test, which reads the real files read-only."""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import eps_insights as ei  # noqa: E402
import portfolio_common as pc  # noqa: E402


def q(fy, n, profit, shares=1000.0, ann=None, cap=None):
    raw = {"Net Profit": profit}
    if shares is not None:
        raw["Number of Shares"] = shares
    if cap is not None:
        raw["Paid Up Capital"] = cap
    return {"fy": fy, "quarter": n, "quarter_label": f"Q{n} {fy[2:4]}-{fy[7:]}", "raw": raw,
            "computed": {"eps_ttm": ann}}


def write_quarterly(tmp_path, symbol, quarters, sector="Commercial Bank"):
    (tmp_path / f"{symbol}.json").write_text(
        json.dumps({"symbol": symbol, "sector": sector, "company_name": symbol, "quarters": quarters}),
        encoding="utf-8")


def test_prev_fy():
    assert ei.prev_fy("2083-84") == "2082-83"
    assert ei.prev_fy("2099-00") == "2098-99"


def test_ttm_at_q4_is_year_to_date():
    qs = [q("2082-83", 1, 100), q("2082-83", 4, 700)]
    assert ei.ttm_profit(ei.index_quarters(qs), qs[-1]) == 700


def test_ttm_at_q1_uses_previous_year():
    # NABIL shape: Q4 7,905.8m, Q1 prev 1,757.0m, Q1 now 2,555.1m
    qs = [q("2082-83", 1, 1_756_991_000), q("2082-83", 4, 7_905_796_000), q("2083-84", 1, 2_555_105_000)]
    assert ei.ttm_profit(ei.index_quarters(qs), qs[-1]) == 8_703_910_000


def test_missing_previous_quarter_gives_none():
    qs = [q("2082-83", 4, 700), q("2083-84", 2, 300)]  # no Q2 of the previous year
    assert ei.ttm_profit(ei.index_quarters(qs), qs[-1]) is None
    assert ei.ttm_eps_for(ei.index_quarters(qs), qs[-1]) is None


def test_shares_fallback_chain():
    assert ei.shares_for({"raw": {"Number of Shares": 500}}, 900) == 500
    assert ei.shares_for({"raw": {"Paid Up Capital": 50_000}}, 900) == 500
    assert ei.shares_for({"raw": {}}, 900) == 900
    assert ei.shares_for({"raw": {}}, None) is None


def run(tmp_path, quarters, symbol="AAA", sector="Commercial Bank", qty=10, cost=100.0, price=200.0,
        fundamentals=None, extra=None, peer_price=None):
    write_quarterly(tmp_path, symbol, quarters, sector)
    for sym, qs, sec in (extra or []):
        write_quarterly(tmp_path, sym, qs, sec)
    pf = {"holdings": [{"symbol": symbol, "company": symbol, "quantity": qty, "avgCost": cost}]}
    prices = {symbol: (price, "2026-11-01")}
    for sym, _, _ in (extra or []):
        prices[sym] = (peer_price or price, "2026-11-01")
    return ei.build_insights(pf, fundamentals or {}, str(tmp_path),
                             price_fn=lambda s: prices.get(s, (None, None)))


def test_loss_has_no_pe_and_loss_flag(tmp_path):
    qs = [q("2082-83", 4, -5000)]
    res = run(tmp_path, qs)
    h = res["holdings"][0]
    assert h["ttm_eps"] == -5.0
    assert h["market_pe"] is None and h["pe_at_cost"] is None and h["payback_years"] is None
    assert any(f["code"] == "LOSS" and f["severity"] == "high" for f in h["flags"])


def test_hydro_seasonal_flag(tmp_path):
    # Q1 is the monsoon quarter: annualized 34.0 vs TTM 13.0
    qs = [q("2082-83", 1, 100), q("2082-83", 4, 130), q("2083-84", 1, 110)]
    qs[-1]["computed"]["eps_ttm"] = 34.0
    res = run(tmp_path, qs, sector="Hydropower")
    h = res["holdings"][0]
    assert h["ttm_eps"] == 0.14  # 130 - 100 + 110 = 140 over 1000 shares
    codes = [f["code"] for f in h["flags"]]
    assert "SEASONAL_ANNUALIZED" in codes and "ANNUALIZED_GAP" not in codes


def test_annualized_gap_for_other_sector(tmp_path):
    qs = [q("2082-83", 1, 100), q("2082-83", 4, 800), q("2083-84", 1, 50, ann=0.2)]
    res = run(tmp_path, qs, sector="Commercial Bank")
    codes = [f["code"] for f in res["holdings"][0]["flags"]]
    assert "ANNUALIZED_GAP" in codes and "SEASONAL_ANNUALIZED" not in codes


def test_yield_on_cost_and_payback_arithmetic(tmp_path):
    qs = [q("2082-83", 4, 20_000, shares=1000.0)]  # EPS 20
    res = run(tmp_path, qs, qty=15, cost=200.0, price=300.0)
    h = res["holdings"][0]
    assert h["ttm_eps"] == 20.0
    assert h["pe_at_cost"] == 10.0
    assert h["earnings_yield_on_cost_pct"] == 10.0
    assert h["payback_years"] == 10.0
    assert h["share_of_yearly_profit"] == 300.0
    assert h["market_pe"] == 15.0
    assert h["market_earnings_yield_pct"] == pytest.approx(6.7, abs=0.05)
    assert h["gain_pct"] == 50.0


def test_growth_states(tmp_path):
    qs = [q("2082-83", 1, 100), q("2082-83", 4, 500), q("2083-84", 1, 60)]
    h = run(tmp_path, qs)["holdings"][0]
    assert h["growth_yoy_pct"] == -40.0
    assert any(f["code"] == "PROFIT_FALLING" for f in h["flags"])
    idx = ei.index_quarters([q("2082-83", 1, -10), q("2083-84", 1, 5)])
    assert ei.growth_info(idx, idx[("2083-84", 1)]) == (None, "turned_profitable")
    idx = ei.index_quarters([q("2082-83", 1, 10), q("2083-84", 1, -5)])
    g, state = ei.growth_info(idx, idx[("2083-84", 1)])
    assert state == "turned_to_loss" and g == -150.0


def test_sector_median_and_valuation_flags(tmp_path):
    # four banks with EPS 10 and price 100 -> sector median P/E 10
    peers = [(f"P{i}", [q("2082-83", 4, 10_000)], "Commercial Bank") for i in range(4)]
    mine = [q("2082-83", 4, 10_000)]  # EPS 10
    res = run(tmp_path, mine, cost=250.0, price=100.0, extra=peers, peer_price=100.0)
    assert res["sector_median_pe"]["Commercial Bank"] == 10.0
    h = res["holdings"][0]
    assert h["pe_at_cost"] == 25.0
    assert any(f["code"] == "EXPENSIVE_AT_COST" for f in h["flags"])
    res = run(tmp_path, mine, cost=100.0, price=50.0, extra=peers, peer_price=100.0)
    assert any(f["code"] == "CHEAP_VS_SECTOR" for f in res["holdings"][0]["flags"])


def test_sector_median_needs_three_peers(tmp_path):
    peers = [(f"P{i}", [q("2082-83", 4, 10_000)], "Commercial Bank") for i in range(1)]
    res = run(tmp_path, [q("2082-83", 4, 10_000)], extra=peers)
    assert "Commercial Bank" not in res["sector_median_pe"]
    assert res["holdings"][0]["sector_median_pe"] is None


def test_skipped_reasons(tmp_path):
    write_quarterly(tmp_path, "NOSH", [q("2082-83", 4, 100, shares=None)])
    pf = {"holdings": [
        {"symbol": "CSBY", "quantity": 1, "avgCost": 10}, {"symbol": "GONE", "quantity": 1, "avgCost": 10},
        {"symbol": "NOSH", "quantity": 1, "avgCost": 10}]}
    res = ei.build_insights(pf, {}, str(tmp_path), price_fn=lambda s: (None, None))
    reasons = {s["symbol"]: s["reason"] for s in res["skipped"]}
    assert set(reasons) == {"CSBY", "GONE", "NOSH"} and res["holdings"] == []


def test_portfolio_totals(tmp_path):
    write_quarterly(tmp_path, "A", [q("2082-83", 4, 10_000)])   # EPS 10
    write_quarterly(tmp_path, "B", [q("2082-83", 4, 5_000)])    # EPS 5
    pf = {"holdings": [{"symbol": "A", "quantity": 10, "avgCost": 100.0},
                       {"symbol": "B", "quantity": 20, "avgCost": 50.0}]}
    prices = {"A": (200.0, "d"), "B": (100.0, "d")}
    res = ei.build_insights(pf, {}, str(tmp_path), price_fn=lambda s: prices[s])
    p = res["portfolio"]
    assert p["share_of_yearly_profit"] == 200  # 10*10 + 20*5
    assert p["total_cost"] == 2000
    assert p["earnings_yield_on_cost_pct"] == 10.0
    assert p["market_earnings_yield_pct"] == pytest.approx(200 / 4000 * 100)
    assert p["pe_at_cost"] == 10.0 and p["market_pe"] == 20.0


# ---------------------------------------------------------------- translation support
# Flags, notes and skip reasons carry a code and params so the app can build the sentence
# in Nepali (src/lib/epsText.ts, `eps.*` templates).

import ast  # noqa: E402
import inspect  # noqa: E402
import re  # noqa: E402

LOCALES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "i18n", "locales")


def locale_keys(lang, namespace):
    with open(os.path.join(LOCALES, lang, f"{namespace}.ts"), "r", encoding="utf-8") as f:
        return set(re.findall(r"^\s*([A-Za-z_][\w]*)\s*:", f.read(), flags=re.M))


def _calls(func, name):
    tree = ast.parse(inspect.getsource(func))
    return tree, [n for n in ast.walk(tree)
                  if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == name]


def emitted_eps_keys():
    """Template keys for every flag, note and skip reason the Python can emit."""
    keys = set()
    _, calls = _calls(ei.make_flags, "flag")
    for c in calls:
        code = c.args[0].value
        params = c.args[2]
        variant = next((v.value for k, v in zip(params.keys, params.values)
                        if isinstance(k, ast.Constant) and k.value == "variant"), None)
        keys.add(f"flag_{code}_{variant}" if variant else f"flag_{code}")
    tree = ast.parse(inspect.getsource(ei.build_holding))
    for d in ast.walk(tree):
        if isinstance(d, ast.Dict):
            for k, v in zip(d.keys, d.values):
                if isinstance(k, ast.Constant) and k.value == "code" and isinstance(v, ast.Constant):
                    keys.add(f"note_{v.value}")
    keys |= {f"skip_{code}" for code in ei.SKIP_REASONS}
    return keys


def test_flags_notes_and_skips_carry_code_and_params(tmp_path):
    peers = [(f"P{i}", [q("2082-83", 4, 10_000)], "Commercial Bank") for i in range(4)]
    # falling profit, annualized gap and expensive at cost in one holding
    mine = [q("2082-83", 1, 100), q("2082-83", 4, 10_000), q("2083-84", 1, 50, ann=0.2)]
    res = run(tmp_path, mine, cost=2_000.0, price=100.0, extra=peers, peer_price=100.0)
    flags = res["holdings"][0]["flags"]
    assert {"PROFIT_FALLING", "ANNUALIZED_GAP", "EXPENSIVE_AT_COST"} <= {f["code"] for f in flags}
    for f in flags:
        assert isinstance(f.get("params"), dict) and f["params"], f["code"]
        assert isinstance(f.get("text"), str) and f["text"]
    falling = next(f for f in flags if f["code"] == "PROFIT_FALLING")
    assert falling["params"]["variant"] == "lower" and falling["params"]["growthPct"] == -50.0

    # only annualized EPS: the previous year's same quarter is missing
    sub = tmp_path / "only_annualized"
    sub.mkdir()
    only_ann = run(sub, [q("2082-83", 4, 700), q("2083-84", 2, 300, ann=6.0)])["holdings"][0]
    assert only_ann["notes"] == [n["text"] for n in only_ann["note_items"]]
    assert [n["code"] for n in only_ann["note_items"]] == ["ONLY_ANNUALIZED"]
    assert all(isinstance(n["params"], dict) for n in only_ann["note_items"])

    write_quarterly(tmp_path, "NOSH", [q("2082-83", 4, 100, shares=None)])
    pf = {"holdings": [{"symbol": "CSBY", "quantity": 1, "avgCost": 10},
                       {"symbol": "GONE", "quantity": 1, "avgCost": 10},
                       {"symbol": "NOSH", "quantity": 1, "avgCost": 10}]}
    skipped = ei.build_insights(pf, {}, str(tmp_path), price_fn=lambda s: (None, None))["skipped"]
    by = {s["symbol"]: s for s in skipped}
    assert by["CSBY"]["reason_code"] == "MUTUAL_FUND"
    assert by["GONE"]["reason_code"] == "NO_QUARTERLY"
    assert by["NOSH"]["reason_code"] == "NO_SHARES"
    assert all(s["reason"] == ei.SKIP_REASONS[s["reason_code"]] for s in skipped)


def test_every_flag_emit_site_passes_params():
    """Static guard: every flag goes through flag(code, severity, params, text) with a constant
    code and a params dict, and nothing else appends to the flag list."""
    tree, calls = _calls(ei.make_flags, "flag")
    assert len(calls) >= 8
    for c in calls:
        assert len(c.args) == 4, ast.dump(c)
        assert isinstance(c.args[0], ast.Constant) and isinstance(c.args[1], ast.Constant)
        assert isinstance(c.args[2], ast.Dict), c.args[0].value
    appends = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
               and n.func.attr == "append"]
    assert len(appends) == 1  # the one inside flag()
    # skipped entries are built only by skip()
    tree = ast.parse(inspect.getsource(ei.build_insights))
    for n in ast.walk(tree):
        if (isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "append"
                and isinstance(n.func.value, ast.Name) and n.func.value.id == "skipped"):
            assert isinstance(n.args[0], ast.Call) and n.args[0].func.id == "skip"


def test_every_eps_code_has_templates_in_both_languages():
    keys = emitted_eps_keys()
    assert "flag_PROFIT_FALLING_lower" in keys and "flag_PROFIT_FALLING_turned_to_loss" in keys
    en, ne = locale_keys("en", "eps"), locale_keys("ne", "eps")
    assert en == ne, f"en/ne key mismatch: {sorted(en ^ ne)}"
    missing = sorted(keys - en)
    assert not missing, f"codes without an eps template: {missing}"


def test_real_data_anchors():
    """Reads the real quarterly files read-only."""
    fundamentals = pc.load_json(os.path.join(pc.DB_DIR, "fundamentals.json")) or {}

    def at(sym, label):
        data = pc.load_json(os.path.join(pc.QUARTERLY_DIR, f"{sym}.json"))
        qs = data["quarters"]
        row = next(x for x in qs if x["quarter_label"] == label)
        fs = (fundamentals.get(sym) or {}).get("sharesOutstanding")
        return row, ei.ttm_eps_for(ei.index_quarters(qs), row, fs)

    row, eps = at("SGHC", "Q1 83-84")
    assert round(eps, 2) == 13.58 and round(row["computed"]["eps_ttm"], 2) == 34.22
    row, eps = at("NABIL", "Q1 83-84")
    assert round(eps, 2) == 26.05 and ei.shares_for(row) == 334_098_470
    row, eps = at("NIMB", "Q1 83-84")
    assert round(eps, 2) == 8.05 and round(row["computed"]["eps_ttm"], 2) == 0.53
    row, eps = at("HRL", "Q4 82-83")
    assert round(eps, 2) == -21.50
