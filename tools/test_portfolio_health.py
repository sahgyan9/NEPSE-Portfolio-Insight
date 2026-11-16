import os
import json
import subprocess
import sys
import pytest

# Paths
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
health_out_path = os.path.join(project_root, "db", "portfolio_health.json")
script_path = os.path.join(project_root, "tools", "portfolio_health.py")
python_bin = sys.executable

def test_standard_mock_portfolio(mock_portfolio, mock_fundamentals, mock_quarterly):
    """Test standard portfolio health calculation with two distinct stocks."""
    # Write mock portfolio
    mock_portfolio([
        {
            "symbol": "NICA",
            "company": "NIC Asia Bank Ltd.",
            "quantity": 1000,
            "avgCost": 350.0,
            "dateAdded": "2026-01-01"
        },
        {
            "symbol": "UPPER",
            "company": "Upper Tamakoshi Hydropower Ltd.",
            "quantity": 2000,
            "avgCost": 200.0,
            "dateAdded": "2026-01-01"
        }
    ])
    
    # Mock fundamentals
    mock_fundamentals({
        "NICA": {
            "eps": 0.97,
            "bookValue": 172.97,
            "peRatio": 343.33,
            "pbRatio": 1.93
        },
        "UPPER": {
            "eps": -1.03,
            "bookValue": 46.69,
            "peRatio": -184.54,
            "pbRatio": 4.07
        }
    })
    
    # Run the script
    res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
    assert res.returncode == 0, f"Health script crashed: {res.stderr}"
    assert os.path.exists(health_out_path), "Health output file not generated!"
    
    with open(health_out_path, "r", encoding="utf-8") as f:
        health = json.load(f)
        
    # Standard health structure checks
    assert 0 <= health["overallScore"] <= 100, f"overallScore {health['overallScore']} out of bounds"
    assert health["grade"] in ["A+", "A", "B+", "B", "C", "D", "F"], f"Invalid grade {health['grade']}"
    assert len(health["holdings"]) == 2, "Should have 2 holdings"
    
    for pillar in ["structure", "fundamentals", "valuation", "dividend", "volatility"]:
        assert pillar in health["pillars"], f"Missing pillar: {pillar}"
        assert 0 <= health["pillars"][pillar]["score"] <= 100

def test_single_stock_concentration_penalty(mock_portfolio, mock_fundamentals):
    """Test that a single-stock portfolio is penalized for extreme concentration."""
    mock_portfolio([
        {
            "symbol": "NABIL",
            "company": "Nabil Bank Limited",
            "quantity": 100,
            "avgCost": 500.0,
            "dateAdded": "2026-01-01"
        }
    ])
    
    mock_fundamentals({
        "NABIL": {
            "eps": 31.57,
            "bookValue": 243.3,
            "peRatio": 16.66,
            "pbRatio": 2.16
        }
    })
    
    res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
    assert res.returncode == 0
    
    with open(health_out_path, "r", encoding="utf-8") as f:
        health = json.load(f)
        
    assert len(health["holdings"]) == 1
    # Structure score must be heavily penalized (< 30) for absolute 100% concentration
    assert health["pillars"]["structure"]["score"] < 30, f"Structure score {health['pillars']['structure']['score']} too high for 100% concentration"

def test_empty_portfolio(mock_portfolio):
    """Test that the health algorithm handles an empty portfolio gracefully."""
    mock_portfolio([])
    res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
    # Should print message and exit or run gracefully
    assert "No portfolio holdings found" in res.stdout or res.returncode == 0

def test_promoter_and_liquidity_health_warnings(mock_portfolio, mock_fundamentals):
    """Test health algorithm warning flags for low promoter holdings and low liquidity."""
    mock_portfolio([
        {
            "symbol": "NABIL",
            "company": "Nabil Bank Limited",
            "quantity": 100,
            "avgCost": 500.0,
            "dateAdded": "2026-01-01"
        },
        {
            "symbol": "UPPER",
            "company": "Upper Tamakoshi Hydropower Ltd.",
            "quantity": 200,
            "avgCost": 200.0,
            "dateAdded": "2026-01-01"
        }
    ])
    
    # Mock fundamentals with NPL, low promoter, and low liquidity
    mock_fundamentals({
        "NABIL": {
            "eps": 31.57,
            "bookValue": 243.3,
            "peRatio": 16.66,
            "pbRatio": 2.16,
            "promoterHolding": 48.0, # Below 51% limit for Bank
            "avgVolume120d": 12000
        },
        "UPPER": {
            "eps": -1.03,
            "bookValue": 46.69,
            "peRatio": -184.54,
            "pbRatio": 4.07,
            "promoterHolding": 51.0, # Above 30% limit for Hydropower
            "avgVolume120d": 3200  # Below 5000 limit
        }
    })
    
    res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
    assert res.returncode == 0
    
    with open(health_out_path, "r", encoding="utf-8") as f:
        health = json.load(f)
        
    warnings = health["warnings"]
    assert any("Low Promoter Shareholding" in w and "NABIL" in w for w in warnings), "Should warn about low NABIL promoter holding"
    assert any("Low Liquidity alert" in w and "UPPER" in w for w in warnings), "Should warn about low UPPER liquidity"

def test_relative_valuation_premium_warning(mock_portfolio, mock_fundamentals):
    """Test health algorithm warning for stocks trading at a premium relative to sector average PE."""
    mock_portfolio([
        {"symbol": "NABIL", "quantity": 100, "avgCost": 500.0}, # Commercial Bank
        {"symbol": "HBL", "quantity": 100, "avgCost": 200.0}    # Commercial Bank
    ])
    
    # Mock fundamentals where NABIL PE is 32.0 and HBL PE is 10.0 (Sector Avg = 21.0, NABIL is 32.0 > 1.5 * 21.0 = 31.5)
    mock_fundamentals({
        "NABIL": {
            "eps": 10.0,
            "bookValue": 100.0,
            "peRatio": 32.0,
            "pbRatio": 2.0
        },
        "HBL": {
            "eps": 10.0,
            "bookValue": 100.0,
            "peRatio": 10.0,
            "pbRatio": 1.0
        }
    })
    
    res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
    assert res.returncode == 0
    
    with open(health_out_path, "r", encoding="utf-8") as f:
        health = json.load(f)
        
    warnings = health["warnings"]
    assert any("Relative Overvaluation" in w and "NABIL" in w for w in warnings), "Should warn about relative overvaluation of NABIL"


# ---------------------------------------------------------------- translation support
# Every sentence the health report shows is also sent as {code, params, text} so the app can
# build it in Nepali (src/lib/healthText.ts, `health.<code>` templates).

import ast  # noqa: E402
import inspect  # noqa: E402
import re  # noqa: E402

sys.path.insert(0, os.path.join(project_root, "tools"))
import portfolio_health as ph  # noqa: E402

LOCALES = os.path.join(project_root, "src", "i18n", "locales")
ITEM_LISTS = ("strengthItems", "warningItems", "recommendationItems", "summaryItems")
HELPERS = {"strength": "s_", "warn": "w_", "recommend": "r_", "summary": "sum_"}


def locale_keys(lang, namespace):
    """Keys of a flat locale file (`key: "text"` or `key:` followed by the string)."""
    path = os.path.join(LOCALES, lang, f"{namespace}.ts")
    with open(path, "r", encoding="utf-8") as f:
        return set(re.findall(r"^\s*([A-Za-z_][\w]*)\s*:", f.read(), flags=re.M))


def emitted_health_codes():
    """Every code passed to strength/warn/recommend/summary in calculate_health()."""
    tree = ast.parse(inspect.getsource(ph.calculate_health))
    calls = [n for n in ast.walk(tree)
             if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in HELPERS]
    return tree, calls


def test_health_items_carry_code_and_params(mock_portfolio, mock_fundamentals):
    mock_portfolio([
        {"symbol": "NABIL", "quantity": 100, "avgCost": 500.0},
        {"symbol": "HBL", "quantity": 100, "avgCost": 200.0},
        {"symbol": "UPPER", "quantity": 200, "avgCost": 200.0},
    ])
    mock_fundamentals({
        "NABIL": {"eps": 10.0, "bookValue": 100.0, "peRatio": 32.0, "pbRatio": 2.0,
                  "promoterHolding": 48.0, "avgVolume120d": 12000},
        "HBL": {"eps": 10.0, "bookValue": 100.0, "peRatio": 10.0, "pbRatio": 1.0},
        "UPPER": {"eps": -1.03, "bookValue": 46.69, "peRatio": -184.54, "pbRatio": 4.07,
                  "avgVolume120d": 3200},
    })
    res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
    assert res.returncode == 0, res.stderr
    with open(health_out_path, "r", encoding="utf-8") as f:
        health = json.load(f)

    for key in ITEM_LISTS:
        assert isinstance(health[key], list), key
        for item in health[key]:
            assert isinstance(item.get("code"), str) and item["code"], item
            assert isinstance(item.get("params"), dict), item
            assert isinstance(item.get("text"), str) and item["text"], item
    assert health["warningItems"] and health["recommendationItems"] and health["summaryItems"]
    # The old plain-string lists are kept, in the same order, for older readers.
    assert health["strengths"] == [i["text"] for i in health["strengthItems"]]
    assert health["warnings"] == [i["text"] for i in health["warningItems"]]
    assert health["recommendations"] == [i["text"] for i in health["recommendationItems"]]
    assert health["textSummary"] == " ".join(i["text"] for i in health["summaryItems"])
    for pid, pillar in health["pillars"].items():
        assert pillar["id"] == pid
    codes = {i["code"] for i in health["warningItems"]}
    assert {"w_promoter_low", "w_liquidity_low", "w_pe_premium"} <= codes


def test_every_health_sentence_goes_through_a_helper():
    """Static guard: each emit site passes a constant code with the right prefix and a params dict,
    and nothing appends to the item lists except the four helpers."""
    tree, calls = emitted_health_codes()
    assert len(calls) >= 40
    for c in calls:
        assert len(c.args) == 3, ast.dump(c)
        assert isinstance(c.args[0], ast.Constant) and isinstance(c.args[0].value, str), ast.dump(c)
        assert c.args[0].value.startswith(HELPERS[c.func.id]), c.args[0].value
        assert isinstance(c.args[1], ast.Dict), c.args[0].value
    appends = [n for n in ast.walk(tree)
               if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "append"
               and isinstance(n.func.value, ast.Name)]
    targets = [n.func.value.id for n in appends]
    item_appends = [t for t in targets if t.endswith("_items")]
    assert sorted(item_appends) == sorted(["strength_items", "warning_items", "recommendation_items", "summary_items"])
    # The old string lists must not come back as separate emit sites.
    names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
    assert not names & {"strengths", "warnings", "recommendations"}


def test_every_health_code_has_templates_in_both_languages():
    _, calls = emitted_health_codes()
    codes = {c.args[0].value for c in calls}
    pillars = {f"pillar_{p}_{part}" for p in ("structure", "fundamentals", "valuation", "dividend", "volatility")
               for part in ("name", "desc")}
    en, ne = locale_keys("en", "health"), locale_keys("ne", "health")
    assert en == ne, f"en/ne key mismatch: {sorted(en ^ ne)}"
    missing = sorted((codes | pillars) - en)
    assert not missing, f"codes without a health template: {missing}"


def test_performance_note_code_has_templates():
    with open(os.path.join(project_root, "tools", "portfolio_risk.py"), "r", encoding="utf-8") as f:
        codes = re.findall(r'performance\["noteCode"\]\s*=\s*"(\w+)"', f.read())
    assert codes
    for lang in ("en", "ne"):
        keys = locale_keys(lang, "home")
        for code in codes:
            assert f"rvmNote_{code}" in keys, (lang, code)


