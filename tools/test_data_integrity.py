import os
import json
import pytest

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_dir = os.path.join(project_root, "db")

def test_value_history_has_no_date_duplicates():
    """Verify that the valueHistory in portfolio.json does not contain duplicate entries on the same day."""
    portfolio_path = os.path.join(db_dir, "portfolio.json")
    if not os.path.exists(portfolio_path):
        pytest.skip("portfolio.json not found")
        
    with open(portfolio_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    history = data.get("valueHistory", [])
    seen_dates = set()
    duplicates = []
    
    for entry in history:
        date_str = entry.get("date")
        if not date_str:
            continue
        # Check day resolution (YYYY-MM-DD)
        day = date_str.split("T")[0]
        if day in seen_dates:
            duplicates.append(day)
        seen_dates.add(day)
        
    # We will print warning if duplicates exist, but once we apply the deduplication fix, 
    # we want this test to pass. Let's make it a soft check for now or assert it.
    # Since the user currently has duplicates, we can assert len(duplicates) == 0 once Phase 2 is done.
    # For now, let's just make it a failing test or assertion so that our Phase 2 fix is validated!
    assert len(duplicates) == 0, f"Found duplicate date entries in valueHistory: {duplicates}"

def test_quarterly_reports_exist_for_active_portfolio_symbols():
    """Ensure every corporate holding in portfolio has a corresponding quarterly data file."""
    portfolio_path = os.path.join(db_dir, "portfolio.json")
    if not os.path.exists(portfolio_path):
        pytest.skip("portfolio.json not found")
        
    with open(portfolio_path, "r", encoding="utf-8") as f:
        portfolio = json.load(f)
        
    holdings = portfolio.get("holdings", [])
    
    # Exclude mutual funds as they do not have standard quarterly reports
    excluded_sectors = ["Mutual Fund", "Mutual Funds"]
    
    # We need to map which symbols are mutual funds. We can look at portfolioData.ts or sector mappings.
    # For this check, let's look up if their sector is known or if they are a mutual fund.
    # Let's map typical NEPSE mutual funds:
    mutual_funds = {"CSY", "CSBY", "KDBY", "MMF1", "NBF3", "NIBLSF", "NMBSBFE"}
    
    missing_quarterly = []
    for h in holdings:
        symbol = h["symbol"].upper()
        if symbol in mutual_funds:
            continue
            
        quarterly_path = os.path.join(db_dir, "quarterly", f"{symbol}.json")
        if not os.path.exists(quarterly_path):
            missing_quarterly.append(symbol)
            
    assert len(missing_quarterly) == 0, f"Missing quarterly JSON reports for active portfolio companies: {missing_quarterly}"

def test_sector_name_consistency():
    """Check that sector names do not contain duplicate variations like 'Commercial Bank' vs 'Commercial Banks'."""
    portfolio_path = os.path.join(db_dir, "portfolio.json")
    if os.path.exists(portfolio_path):
        with open(portfolio_path, "r", encoding="utf-8") as f:
            portfolio = json.load(f)
            
    quarterly_dir = os.path.join(db_dir, "quarterly")
    if not os.path.exists(quarterly_dir):
        pytest.skip("quarterly directory not found")
        
    sectors = set()
    for filename in os.listdir(quarterly_dir):
        if not filename.endswith(".json"):
            continue
        with open(os.path.join(quarterly_dir, filename), "r", encoding="utf-8") as f:
            qdata = json.load(f)
            sector = qdata.get("sector")
            if sector:
                sectors.add(sector)
                
    # Check for confusing sector name pairs
    normalized_sectors = [s.lower().replace(" ", "").rstrip("s") for s in sectors]
    duplicates = [s for s in sectors if normalized_sectors.count(s.lower().replace(" ", "").rstrip("s")) > 1]
    
    # E.g., having both "Commercial Bank" and "Commercial Banks" in the data
    assert len(duplicates) == 0, f"Found sector name variations that could lead to logic bugs: {sectors}"
