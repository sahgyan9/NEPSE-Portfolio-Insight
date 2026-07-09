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



