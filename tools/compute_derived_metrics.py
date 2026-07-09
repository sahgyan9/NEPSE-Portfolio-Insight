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
        
        # Sort quarters chronologically to calculate QoQ momentum
        quarters_sorted = sorted(quarters, key=lambda x: (x.get("fy", ""), x.get("quarter", 0)))
        single_profits = []
        for idx, q_curr in enumerate(quarters_sorted):
            raw_curr = q_curr.get("raw", {})
            q_num = q_curr.get("quarter", 0)
            net_profit_curr = raw_curr.get("Net Profit")
            
            single_profit = None
            if net_profit_curr is not None:
                if q_num == 1:
                    single_profit = net_profit_curr
                else:
                    # Find previous quarter in same FY
                    prev_q = None
                    for j in range(idx - 1, -1, -1):
                        if quarters_sorted[j].get("fy") == q_curr.get("fy") and quarters_sorted[j].get("quarter") == q_num - 1:
                            prev_q = quarters_sorted[j]
                            break
                    if prev_q:
                        prev_net_profit = prev_q.get("raw", {}).get("Net Profit")
                        if prev_net_profit is not None:
                            single_profit = net_profit_curr - prev_net_profit
            single_profits.append(single_profit)
            
        for idx, q in enumerate(quarters_sorted):
            raw = q.get("raw", {})
            computed = q.setdefault("computed", {})
            yoy = q.get("yoy", {})
            
            # --- 1. EPS & Book Value ---
            eps = computed.get("eps_ttm") or raw.get("EPS Reported")
            bvps = computed.get("bvps") or raw.get("Book Value Reported")
            
            # --- 2. Graham Number ---
            graham_number = None
            if eps is not None and bvps is not None:
                if eps > 0 and bvps > 0:
                    try:
                        graham_number = round(math.sqrt(22.5 * eps * bvps), 2)
                    except ValueError:
                        pass
            computed["graham_number"] = graham_number
            
            # --- 3. Earnings Yield ---
            pe = computed.get("pe_ratio")
            earnings_yield = None
            if pe is not None and pe > 0:
                earnings_yield = round((1.0 / pe) * 100, 2)
            computed["earnings_yield"] = earnings_yield
            
            # --- 4. PEG Ratio ---
            growth_rate = yoy.get("net_profit_ttm") or yoy.get("Net Profit")
            peg_ratio = None
            if pe is not None and pe > 0 and growth_rate is not None and growth_rate > 0:
                peg_ratio = round(pe / growth_rate, 2)
            computed["peg_ratio"] = peg_ratio
            
            # --- 5. DuPont ROE Decomposition ---
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
                asset_turnover = round(revenue_ttm / total_assets, 4)
                
            if total_assets and total_equity and total_equity > 0:
                equity_multiplier = round(total_assets / total_equity, 2)
                
            if net_margin is not None and asset_turnover is not None and equity_multiplier is not None:
                dupont_roe = round(net_margin * asset_turnover * equity_multiplier, 2)
                
            computed["dupont_net_margin"] = net_margin
            computed["dupont_asset_turnover"] = asset_turnover
            computed["dupont_equity_multiplier"] = equity_multiplier
            computed["dupont_roe"] = dupont_roe
            
            # --- 6. Debt-to-Equity Ratio ---
            borrowings = raw.get("Borrowings")
            debt_to_equity = None
            if borrowings is not None and total_equity is not None and total_equity > 0:
                debt_to_equity = round(borrowings / total_equity, 2)
            computed["debt_to_equity"] = debt_to_equity
            
            # --- 7. Net Interest Margin (NIM) for Banks ---
            net_interest_income = raw.get("Net Interest Income")
            nim = None
            sector_norm = (data.get("sector") or "").strip().lower()
            is_bank_or_micro = "bank" in sector_norm or "microfinance" in sector_norm or "laghubitta" in sector_norm
            
            if is_bank_or_micro:
                quarter = q.get("quarter")
                if net_interest_income and total_assets and quarter:
                    try:
                        annualized_nii = net_interest_income * (4.0 / quarter)
                        nim = round((annualized_nii / total_assets) * 100, 2)
                    except ZeroDivisionError:
                        pass
            computed["net_interest_margin"] = nim

            # --- 8. Operating Profit Margin ---
            op_profit = raw.get("Operating Profit")
            revenue_cumulative = raw.get("Revenue") or raw.get("Interest Income") or raw.get("Total Operating Income")
            op_margin = None
            if op_profit is not None and revenue_cumulative and revenue_cumulative > 0:
                op_margin = round((op_profit / revenue_cumulative) * 100, 2)
            computed["operating_profit_margin"] = op_margin

            # --- 9. Revenue per Share ---
            revenue_per_share = None
            shares = raw.get("Number of Shares")
            if revenue_ttm and shares and shares > 0:
                revenue_per_share = round(revenue_ttm / shares, 2)
            computed["revenue_per_share"] = revenue_per_share

            # --- 10. QoQ Profit Momentum ---
            qoq_momentum = None
            if idx > 0:
                curr_single = single_profits[idx]
                prev_single = single_profits[idx - 1]
                if curr_single is not None and prev_single is not None and prev_single > 0:
                    qoq_momentum = round(((curr_single - prev_single) / prev_single) * 100, 2)
            computed["qoq_profit_momentum"] = qoq_momentum

            # --- 11. Loan-to-Asset Ratio ---
            loans = raw.get("Loans and Advances to Customers") or raw.get("Loans and Advances to BFIs")
            loan_to_asset = None
            if is_bank_or_micro:
                if loans and total_assets and total_assets > 0:
                    loan_to_asset = round((loans / total_assets) * 100, 2)
            computed["loan_to_asset"] = loan_to_asset

            # --- 12. Efficiency Ratio ---
            total_op_income = raw.get("Total Operating Income") or raw.get("Revenue")
            efficiency_ratio = None
            if is_bank_or_micro:
                if total_op_income and op_profit and total_op_income > 0:
                    op_expenses = total_op_income - op_profit
                    efficiency_ratio = round((op_expenses / total_op_income) * 100, 2)
            computed["efficiency_ratio"] = efficiency_ratio

            # --- 13. Interest Coverage Ratio ---
            interest_income = raw.get("Interest Income")
            net_interest_income = raw.get("Net Interest Income")
            interest_coverage = None
            if is_bank_or_micro:
                if op_profit is not None and interest_income is not None and net_interest_income is not None:
                    interest_expense = interest_income - net_interest_income
                    if interest_expense > 0:
                        interest_coverage = round(op_profit / interest_expense, 2)
            else:
                net_profit = raw.get("Net Profit")
                if op_profit is not None and net_profit is not None:
                    interest_expense = op_profit - net_profit
                    if interest_expense > 0:
                        interest_coverage = round(op_profit / interest_expense, 2)
            computed["interest_coverage"] = interest_coverage

            # --- 14. Fixed Asset Turnover ---
            fixed_asset_turnover = None
            is_capital_heavy = any(k in sector_norm for k in ["hydro", "manufactur", "hotel", "trading", "telecom"])
            if is_capital_heavy:
                revenue_fat = computed.get("revenue_ttm") or raw.get("Revenue")
                current_assets = raw.get("Current Assets")
                if revenue_fat and total_assets and current_assets:
                    fixed_assets = total_assets - current_assets
                    if fixed_assets > 0:
                        fixed_asset_turnover = round(revenue_fat / fixed_assets, 2)
            computed["fixed_asset_turnover"] = fixed_asset_turnover

            # --- 15. Insurance Investment Yield & Combined Ratio ---
            investment_yield = None
            combined_ratio = None
            is_insurance = "insurance" in sector_norm
            if is_insurance:
                inv_income = raw.get("Income From Investment Loans And Others")
                total_inv = raw.get("Total Investment and Loans")
                quarter = q.get("quarter")
                if inv_income and total_inv and total_inv > 0 and quarter:
                    annualized_yield = (inv_income / total_inv) * (4.0 / quarter)
                    investment_yield = round(annualized_yield * 100, 2)
                    
                net_claim = raw.get("Net Claim Payment")
                net_premium = raw.get("Net Premium")
                management_exp = raw.get("Management Expenses")
                if net_claim and net_premium and net_premium > 0:
                    claims_ratio = net_claim / net_premium
                    expense_ratio = 0.0
                    if management_exp:
                        expense_ratio = management_exp / net_premium
                    combined_ratio = round((claims_ratio + expense_ratio) * 100, 2)
            computed["investment_yield"] = investment_yield
            computed["combined_ratio"] = combined_ratio

        # Write back to JSON file
        data["quarters"] = quarters_sorted
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
    print("Derived metrics calculation complete!")

if __name__ == "__main__":
    calculate_derived_metrics()
