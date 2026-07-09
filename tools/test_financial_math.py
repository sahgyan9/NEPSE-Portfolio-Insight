import os
import json
import sys
import pytest
from datetime import datetime

# Add project root to python path to import health script
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from tools.portfolio_health import calculate_health

def get_generated_health():
    health_path = os.path.join(project_root, "db", "portfolio_health.json")
    assert os.path.exists(health_path), "portfolio_health.json was not generated"
    with open(health_path, "r", encoding="utf-8") as f:
        return json.load(f)

def test_bank_car_and_npl_metrics(mock_portfolio, mock_fundamentals, mock_quarterly):
    """Test bank-specific metrics: low CAR warning, regulatory thresholds, and NPL provision warnings."""
    # Mock portfolio with a bank
    mock_portfolio([
        {"symbol": "NICA", "quantity": 100, "avgCost": 350.0}
    ])
    
    # Mock fundamentals
    mock_fundamentals({
        "NICA": {
            "eps": 0.97,
            "bookValue": 172.97,
            "peRatio": 343.33,
            "pbRatio": 1.93,
            "dividendYield": 4.5
        }
    })
    
    # Mock quarterly data for NICA with CAR = 9.0% (fails regulatory limit of 11.0%)
    # NPL = 6.0% (fails critical limit of 5.0%)
    mock_quarterly("NICA", [{
        "sector": "Commercial Banks",
        "fy": "2082-83",
        "quarter": 1,
        "raw": {
            "CAR": 9.0,
            "NPL": 6.0,
            "Cost of funds": 5.0,
            "Credit To Deposit Ratio": 82.0
        },
        "computed": {
            "roe_ttm": 12.0
        }
    }])
    
    calculate_health()
    health = get_generated_health()
    
    # Verify warnings were generated
    warnings = health["warnings"]
    assert any("CAR" in w and "NICA" in w for w in warnings), "Should warn about low CAR for NICA"
    assert any("NPL" in w and "NICA" in w for w in warnings), "Should warn about high NPL for NICA"
    
    # Verify overall fundamentals score is low because of these critical failures
    assert health["pillars"]["fundamentals"]["score"] < 50

def test_hydropower_leverage_metrics(mock_portfolio, mock_fundamentals, mock_quarterly):
    """Test hydropower metrics: Debt-to-Equity leverage alerts."""
    mock_portfolio([
        {"symbol": "UPPER", "quantity": 1000, "avgCost": 200.0}
    ])
    
    mock_fundamentals({
        "UPPER": {
            "eps": -1.03,
            "bookValue": 46.69,
            "peRatio": -184.54,
            "pbRatio": 4.07
        }
    })
    
    # Hydropower with extremely high borrowings (D/E ratio = borrowings/equity = 50000 / 10000 = 5.0 > 2.0)
    mock_quarterly("UPPER", [{
        "sector": "Hydropower",
        "fy": "2082-83",
        "quarter": 1,
        "raw": {
            "Borrowings": 50000.0,
            "Total Equity": 10000.0
        },
        "computed": {
            "roa_ttm": 3.0
        }
    }])
    
    calculate_health()
    health = get_generated_health()
    
    # D/E ratio warning assertion
    warnings = health["warnings"]
    assert any("Debt-to-Equity is 5.0" in w or "UPPER" in w and "leverage" in w.lower() for w in warnings)

def test_portfolio_diversification_hhi(mock_portfolio, mock_fundamentals):
    """Test Herfindahl-Hirschman Index (HHI) for diversification scores."""
    # Case A: Well-diversified across 5 stocks in 5 different sectors (weight = 20% each)
    mock_portfolio([
        {"symbol": "NABIL", "quantity": 100, "avgCost": 100.0}, # Commercial Bank
        {"symbol": "BHL", "quantity": 100, "avgCost": 100.0},   # Hydropower
        {"symbol": "CBBL", "quantity": 100, "avgCost": 100.0},  # Microfinance
        {"symbol": "CLI", "quantity": 100, "avgCost": 100.0},   # Life Insurance
        {"symbol": "HDL", "quantity": 100, "avgCost": 100.0}    # Manufacturing
    ])
    
    mock_fundamentals({
        "NABIL": {"peRatio": 10.0, "eps": 10.0},
        "BHL": {"peRatio": 10.0, "eps": 10.0},
        "CBBL": {"peRatio": 10.0, "eps": 10.0},
        "CLI": {"peRatio": 10.0, "eps": 10.0},
        "HDL": {"peRatio": 10.0, "eps": 10.0}
    })
    
    calculate_health()
    health_div = get_generated_health()
    assert health_div["pillars"]["structure"]["score"] >= 80
    assert any("diversification" in s.lower() for s in health_div["strengths"])
    
    # Case B: High concentration risk (> 25% single stock limit)
    mock_portfolio([
        {"symbol": "NABIL", "quantity": 900, "avgCost": 100.0}, # NABIL is 90% weight
        {"symbol": "BHL", "quantity": 100, "avgCost": 100.0}    # BHL is 10% weight
    ])
    
    calculate_health()
    health_conc = get_generated_health()
    assert health_conc["pillars"]["structure"]["score"] < 50
    assert any("concentration" in w.lower() for w in health_conc["warnings"])

def test_value_history_volatility_and_drawdown(mock_portfolio, mock_fundamentals):
    """Test standard deviation, coefficient of variation (CoV), and drawdown checks in valueHistory."""
    # Portfolio value rest below invested cost (drawdown test)
    history = [
        {"date": "2026-01-01T00:00:00", "invested": 10000.0, "value": 10000.0},
        {"date": "2026-02-01T00:00:00", "invested": 10000.0, "value": 9000.0},
        {"date": "2026-03-01T00:00:00", "invested": 10000.0, "value": 7500.0}  # 25% drawdown
    ]
    
    mock_portfolio(
        holdings=[{"symbol": "NABIL", "quantity": 10, "avgCost": 750.0}],
        value_history=history
    )
    
    mock_fundamentals({
        "NABIL": {"peRatio": 10.0, "eps": 75.0}
    })
    
    calculate_health()
    health = get_generated_health()
    
    # Verify volatility warnings for drawdown
    warnings = health["warnings"]
    assert any("drawdown" in w.lower() or "below total invested cost" in w.lower() for w in warnings)

def test_derived_metrics_calculation(mock_quarterly):
    """Test computed derived metrics (DuPont ROE, Graham Number, PEG, NIM, D/E) on mock quarterly data."""
    # Mock bank quarterly reports
    mock_quarterly("NABIL", [{
        "sector": "Commercial Bank",
        "fy": "2082-83",
        "quarter": 4,
        "raw": {
            "Total Assets": 400000000000.0,
            "Total Equity": 40000000000.0,
            "Net Interest Income": 10000000000.0,
            "Net Profit": 5000000000.0,
            "Revenue": 20000000000.0,
            "EPS Reported": 18.5,
            "Book Value Reported": 160.0
        },
        "computed": {
            "eps_ttm": 18.5,
            "bvps": 160.0,
            "pe_ratio": 15.0,
            "net_profit_ttm": 5000000000.0,
            "revenue_ttm": 20000000000.0
        },
        "yoy": {
            "net_profit_ttm": 12.5
        }
    }])
    
    from tools.compute_derived_metrics import calculate_derived_metrics
    calculate_derived_metrics()
    
    # Read computed data
    quarterly_path = os.path.join(project_root, "db", "quarterly", "NABIL.json")
    with open(quarterly_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    latest_q = data["quarters"][0]
    comp = latest_q["computed"]
    
    # Assert DuPont Components
    # Net Margin = (5B / 20B) * 100 = 25%
    # Asset Turnover = 20B / 400B = 0.05
    # Equity Multiplier = 400B / 40B = 10
    # Computed DuPont ROE = 25 * 0.05 * 10 = 12.5%
    assert comp["dupont_net_margin"] == 25.0
    assert comp["dupont_asset_turnover"] == 0.05
    assert comp["dupont_equity_multiplier"] == 10.0
    assert comp["dupont_roe"] == 12.50
    
    # Assert Graham Number = sqrt(22.5 * 18.5 * 160) = sqrt(66600) = 258.07
    assert comp["graham_number"] == 258.07
    
    # Assert PEG Ratio = PE / Growth = 15.0 / 12.5 = 1.2
    assert comp["peg_ratio"] == 1.2
    
    # Assert Earnings Yield = 1 / 15 * 100 = 6.67%
    assert comp["earnings_yield"] == 6.67
    
    # Assert NIM = (NII * (4/4) / Total Assets) * 100 = (10B / 400B) * 100 = 2.5%
    assert comp["net_interest_margin"] == 2.5
