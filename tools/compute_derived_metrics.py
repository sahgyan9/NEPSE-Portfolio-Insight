import os
import json
import math

def calculate_derived_metrics():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    quarterly_dir = os.path.join(project_root, "db", "quarterly")
    
    if not os.path.exists(quarterly_dir):
        print(f"Error: quarterly directory {quarterly_dir} does not exist.")
        return
        
    files = [f for f in os.listdir(quarterly_dir) if f.endswith(".json")]
    print(f"Found {len(files)} quarterly data files to process.")
    
    for filename in files:
        filepath = os.path.join(quarterly_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Failed to load {filename}: {e}")
                continue
                
        quarters = data.get("quarters", [])
        if not quarters:
            continue
            
        print(f"Processing {data.get('symbol')}...")
        
        for q in quarters:
            raw = q.get("raw", {})
            computed = q.setdefault("computed", {})
            yoy = q.get("yoy", {})
            
            # --- 1. EPS & Book Value ---
            eps = computed.get("eps_ttm") or raw.get("EPS Reported")
            bvps = computed.get("bvps") or raw.get("Book Value Reported")
            
            # --- 2. Graham Number ---
            # Formula: sqrt(22.5 * EPS * BVPS)
            graham_number = None
            if eps is not None and bvps is not None:
                if eps > 0 and bvps > 0:
                    try:
                        graham_number = round(math.sqrt(22.5 * eps * bvps), 2)
                    except ValueError:
                        pass
            computed["graham_number"] = graham_number
            
            # --- 3. Earnings Yield ---
            # Formula: (1 / PE) * 100 or EPS / LTP * 100
            pe = computed.get("pe_ratio")
            earnings_yield = None
            if pe is not None and pe > 0:
                earnings_yield = round((1.0 / pe) * 100, 2)
            computed["earnings_yield"] = earnings_yield
            
            # --- 4. PEG Ratio ---
            # Formula: PE / YoY net profit TTM growth rate
            growth_rate = yoy.get("net_profit_ttm") or yoy.get("Net Profit")
            peg_ratio = None
            if pe is not None and pe > 0 and growth_rate is not None and growth_rate > 0:
                peg_ratio = round(pe / growth_rate, 2)
            computed["peg_ratio"] = peg_ratio
            
            # --- 5. DuPont ROE Decomposition ---
            # ROE = Net Margin * Asset Turnover * Equity Multiplier
            net_profit_ttm = computed.get("net_profit_ttm") or raw.get("Net Profit")
            revenue_ttm = computed.get("revenue_ttm") or raw.get("Revenue")
            total_assets = raw.get("Total Assets")
            total_equity = raw.get("Total Equity")
            
            net_margin = None
            asset_turnover = None
            equity_multiplier = None
            dupont_roe = None
            
            if net_profit_ttm and revenue_ttm:
                net_margin = round((net_profit_ttm / revenue_ttm) * 100, 2)
                
            if revenue_ttm and total_assets:
                # Annualized asset turnover (revenue_ttm is TTM, total_assets is point-in-time)
                asset_turnover = round(revenue_ttm / total_assets, 4)
                
            if total_assets and total_equity and total_equity > 0:
                equity_multiplier = round(total_assets / total_equity, 2)
                
            if net_margin is not None and asset_turnover is not None and equity_multiplier is not None:
                # Re-calculate ROE via DuPont components
                # net_margin is in %, asset_turnover is factor, equity_multiplier is factor
                dupont_roe = round(net_margin * asset_turnover * equity_multiplier, 2)
                
            computed["dupont_net_margin"] = net_margin
            computed["dupont_asset_turnover"] = asset_turnover
            computed["dupont_equity_multiplier"] = equity_multiplier
            computed["dupont_roe"] = dupont_roe
            
            # --- 6. Debt-to-Equity Ratio ---
            # Formula: Borrowings / Total Equity
            borrowings = raw.get("Borrowings")
            debt_to_equity = None
            if borrowings is not None and total_equity is not None and total_equity > 0:
                debt_to_equity = round(borrowings / total_equity, 2)
            computed["debt_to_equity"] = debt_to_equity
            
            # --- 7. Net Interest Margin (NIM) for Banks ---
            net_interest_income = raw.get("Net Interest Income")
            nim = None
            if data.get("sector") in ["Commercial Banks", "Commercial Bank", "Development Banks", "Development Bank"]:
                # If we have Net Interest Income and Total Assets, approximate NIM
                # For banks, Net Interest Income is reported cumulative. To get NIM for the quarter:
                # We can approximate with NIM = Net Interest Income TTM / Total Assets
                # Let's see if we can find Net Interest Income TTM or approximate
                # For simplicity, we can use NIM = (Net Interest Income / Total Assets) * (4 / quarter) * 100
                quarter = q.get("quarter")
                if net_interest_income and total_assets and quarter:
                    try:
                        # Annualize based on quarter number (e.g. Q1 * 4, Q2 * 2, Q3 * 4/3, Q4 * 1)
                        annualized_nii = net_interest_income * (4.0 / quarter)
                        nim = round((annualized_nii / total_assets) * 100, 2)
                    except ZeroDivisionError:
                        pass
            computed["net_interest_margin"] = nim

        # Write back to JSON file
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
    print("Derived metrics calculation complete!")

if __name__ == "__main__":
    calculate_derived_metrics()
