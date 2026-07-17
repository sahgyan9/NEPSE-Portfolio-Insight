import os
import json
import re
from datetime import datetime

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except Exception:
            return None

def scale_metric(val, min_val, max_val, invert=False):
    if val is None:
        return 0.0
    if val <= min_val:
        return -1.0 if not invert else 1.0
    if val >= max_val:
        return 1.0 if not invert else -1.0
    pct = (val - min_val) / (max_val - min_val)
    score = -1.0 + 2.0 * pct
    return -score if invert else score

def scale_cd_ratio(cd):
    if cd is None:
        return 0.0
    if 90.0 <= cd <= 115.0:
        return 1.0
    if cd < 70.0 or cd > 130.0:
        return -1.0
    if cd < 90.0:
        return scale_metric(cd, 70.0, 90.0)
    else:
        return scale_metric(cd, 115.0, 130.0, invert=True)

def compute_quality_modifier(sector, raw, computed, yoy, op_growth, avg_dividend=0.0):
    scores = []
    weights = []
    details = []

    # Get ROA (careful: 0.0 is a valid value, don't use `or` which treats 0 as falsy)
    roa = computed.get("roa_ttm")
    if roa is None:
        roa = raw.get("ROA Reported")
    if roa is None:
        roa = raw.get("roa")

    if sector in ["Commercial Bank", "Development Bank"]:
        car = raw.get("CAR") or raw.get("car")
        npl = raw.get("NPL") or raw.get("npl")
        cof = raw.get("Cost of funds") or raw.get("Cost of Funds") or raw.get("cost_of_funds")
        
        if car is not None:
            score = scale_metric(car, 11.0, 14.0)
            scores.append(score)
            weights.append(0.40)
            details.append(f"CAR: {car:.1f}% ({score:+.1f})")
        if npl is not None:
            score = scale_metric(npl, 1.5, 5.0, invert=True)
            scores.append(score)
            weights.append(0.35)
            details.append(f"NPL: {npl:.2f}% ({score:+.1f})")
        if cof is not None:
            score = scale_metric(cof, 5.0, 9.0, invert=True)
            scores.append(score)
            weights.append(0.25)
            details.append(f"COF: {cof:.1f}% ({score:+.1f})")

    elif sector == "Microfinance":
        npl = raw.get("NPL") or raw.get("npl")
        cof = raw.get("Cost of funds") or raw.get("Cost of Funds") or raw.get("cost_of_funds")
        cd = raw.get("CD ratio") or raw.get("cd_ratio") or raw.get("CD Ratio") or raw.get("Credit To Deposit Ratio")
        
        if npl is not None:
            score = scale_metric(npl, 2.0, 8.0, invert=True)
            scores.append(score)
            weights.append(0.40)
            details.append(f"NPL: {npl:.2f}% ({score:+.1f})")
        if cof is not None:
            score = scale_metric(cof, 7.0, 12.0, invert=True)
            scores.append(score)
            weights.append(0.30)
            details.append(f"COF: {cof:.1f}% ({score:+.1f})")
        if cd is not None:
            score = scale_cd_ratio(cd)
            scores.append(score)
            weights.append(0.30)
            details.append(f"CD Ratio: {cd:.1f}% ({score:+.1f})")

    elif sector == "Hydropower":
        borrowings = raw.get("Borrowings")
        if borrowings is None:
            borrowings = 0.0
        equity = raw.get("Total Equity")
        if equity is None:
            equity = raw.get("total_equity")
        if equity is None or equity <= 0:
            equity = 1.0
        de = borrowings / equity
        
        # D/E = 0 means debt-free, which is excellent (+1.0)
        score = scale_metric(de, 0.8, 2.0, invert=True)
        scores.append(score)
        weights.append(0.50)
        details.append(f"D/E: {de:.2f} ({score:+.1f})")
        if roa is not None:
            score = scale_metric(roa, 2.0, 8.0)
            scores.append(score)
            weights.append(0.50)
            details.append(f"ROA: {roa:.1f}% ({score:+.1f})")

    elif sector in ["Life Insurance", "Non-Life Insurance"]:
        if roa is not None:
            score = scale_metric(roa, 1.0, 4.0)
            scores.append(score)
            weights.append(0.50)
            details.append(f"ROA: {roa:.1f}% ({score:+.1f})")
        if op_growth is not None:
            score = scale_metric(op_growth, 0.0, 25.0)
            scores.append(score)
            weights.append(0.50)
            details.append(f"Op Profit Growth: {op_growth:+.1f}% ({score:+.1f})")

    else:
        # Manufacturing, Trading, Telecom, Hotels, Others
        if roa is not None:
            score = scale_metric(roa, 1.0, 5.0)
            scores.append(score)
            weights.append(0.50)
            details.append(f"ROA: {roa:.1f}% ({score:+.1f})")
        if op_growth is not None:
            score = scale_metric(op_growth, 0.0, 20.0)
            scores.append(score)
            weights.append(0.50)
            details.append(f"Op Profit Growth: {op_growth:+.1f}% ({score:+.1f})")

    if not scores and avg_dividend <= 0:
        return 0.0, "Standard quality baseline"

    if scores:
        weighted_avg = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
        modifier = weighted_avg * 0.25  # Scaled to [-0.25, +0.25]
    else:
        modifier = 0.0

    # Dividend Premium (+ up to 10% for high consistent payers)
    if avg_dividend > 0:
        # Scale 0% to 25% linearly to 0.0 - 1.0
        div_score = (avg_dividend - 0.0) / (25.0 - 0.0)
        div_score = max(0.0, min(1.0, div_score))
        div_boost = div_score * 0.10
        modifier += div_boost
        details.append(f"Avg Div: {avg_dividend:.1f}% (+{div_boost*100:.1f}%)")

    return modifier, "; ".join(details)

def main():
    print("Computing top quarterly stock performers per sector with hybrid formula...")
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    quarterly_dir = os.path.join(project_root, "db", "quarterly")
    
    # Load Dividend History for Average calculation
    dividend_db = load_json(os.path.join(project_root, "db", "dividend_data.json")) or {}
    
    avg_dividends = {}
    for sym, data in dividend_db.items():
        divs = data.get("dividends", [])
        if divs:
            # Rank based ONLY on bonus shares
            avg_dividends[sym] = sum(float(d.get("bonusPercent", 0)) for d in divs) / len(divs)
    
    if not os.path.exists(quarterly_dir):
        print(f"Directory {quarterly_dir} does not exist.")
        return
        
    all_data = {}
    
    # 1. Load all stock data
    for filename in os.listdir(quarterly_dir):
        if filename.endswith(".json"):
            symbol = filename[:-5].upper()
            filepath = os.path.join(quarterly_dir, filename)
            stock_data = load_json(filepath)
            if stock_data and "quarters" in stock_data:
                all_data[symbol] = stock_data
                
    if not all_data:
        print("No quarterly data files found.")
        return
        
    # 2. Map sector and quarters
    scrip_quarters = {} # (symbol, fy, quarter) -> quarter_entry
    sector_map = {} # symbol -> sector
    all_periods = set() # (fy, quarter)
    
    for symbol, stock_data in all_data.items():
        sector = stock_data.get("sector") or "Others"
        # Standardize sector name
        if "bank" in sector.lower():
            if "development" in sector.lower():
                sector = "Development Bank"
            else:
                sector = "Commercial Bank"
        elif "microfinance" in sector.lower() or "bittiya" in sector.lower():
            sector = "Microfinance"
        elif "insurance" in sector.lower():
            if "non" in sector.lower() or "re" in sector.lower():
                sector = "Non-Life Insurance"
            else:
                sector = "Life Insurance"
        elif "hydro" in sector.lower():
            sector = "Hydropower"
        elif "manufactur" in sector.lower() or "distiller" in sector.lower():
            sector = "Manufacturing"
        elif "fund" in sector.lower():
            sector = "Mutual Fund"
        
        sector_map[symbol] = sector
        
        for q in stock_data["quarters"]:
            fy = q.get("fy")
            quarter = q.get("quarter")
            if fy and quarter:
                scrip_quarters[(symbol, fy, quarter)] = q
                all_periods.add((fy, quarter))
                
    if not all_periods:
        print("No quarters found in files.")
        return
        
    # Sort periods: 2082-83 > 2081-82 etc.
    def period_key(p):
        fy, q = p
        match = re.search(r'(\d+)', fy)
        fy_num = int(match.group(1)) if match else 0
        return (fy_num, q)
        
    sorted_periods = sorted(list(all_periods), key=period_key, reverse=True)
    latest_period = sorted_periods[0]
    latest_fy, latest_qtr = latest_period
    
    print(f"Latest quarter detected in DB: FY {latest_fy} Q{latest_qtr}")
    
    rankings = {} # period_label -> { sector -> [top_performers] }
    
    # Compute for the latest 4 periods to show history
    for period in sorted_periods[:4]:
        fy, qtr = period
        period_label = f"FY {fy} Q{qtr}"
        
        sector_groups = {} # sector -> list of stock records
        
        for symbol, stock_data in all_data.items():
            q_entry = scrip_quarters.get((symbol, fy, qtr))
            if not q_entry:
                continue
                
            computed = q_entry.get("computed", {})
            raw = q_entry.get("raw", {})
            yoy = q_entry.get("yoy", {})
            
            sector = sector_map[symbol]
            if sector == "Mutual Fund":
                continue
            
            # 1. Fetch ROE (TTM)
            roe = computed.get("roe_ttm")
            if roe is None:
                roe = raw.get("ROE Reported") or raw.get("ROE") or 0.0
                
            # 2. Fetch EPS (TTM)
            eps = computed.get("eps_ttm")
            if eps is None:
                eps = raw.get("EPS Reported") or raw.get("EPS") or 0.0
                
            # 3. Fetch Net Margin (TTM)
            net_margin = computed.get("net_margin")
            if net_margin is None:
                curr_profit = raw.get("Net Profit") or raw.get("net_profit")
                curr_rev = raw.get("Revenue") or raw.get("revenue") or raw.get("Interest Income") or raw.get("Total Operating Income")
                if curr_profit is not None and curr_rev and curr_rev != 0:
                    net_margin = (curr_profit / curr_rev) * 100.0
                else:
                    net_margin = 0.0

            # 4. Fetch previous year's corresponding quarter for YoY growth
            match = re.match(r'(\d+)-(\d+)', fy)
            prev_fy = None
            if match:
                y1 = int(match.group(1)) - 1
                y2 = int(match.group(2)) - 1
                prev_fy = f"{y1:04d}-{y2:02d}" if len(match.group(2)) == 2 else f"{y1:04d}-{y2:04d}"
                
            prev_q_entry = scrip_quarters.get((symbol, prev_fy, qtr)) if prev_fy else None
            
            eps_growth = 0.0
            revenue_growth = 0.0
            profit_growth = 0.0
            op_growth = None
            
            # Primary: try fetching from YoY blocks
            # IMPORTANT: use explicit `is not None` checks — `or` treats 0.0 as falsy
            eps_growth_yoy = yoy.get("eps_ttm")
            if eps_growth_yoy is None:
                eps_growth_yoy = yoy.get("EPS Reported")
            if eps_growth_yoy is not None:
                eps_growth = eps_growth_yoy
            elif prev_q_entry:
                prev_computed = prev_q_entry.get("computed", {})
                prev_raw = prev_q_entry.get("raw", {})
                prev_eps = prev_computed.get("eps_ttm") or prev_raw.get("EPS Reported") or prev_raw.get("EPS")
                if prev_eps and prev_eps != 0:
                    eps_growth = ((eps - prev_eps) / abs(prev_eps)) * 100.0

            # Revenue Growth
            rev_growth_yoy = yoy.get("revenue_ttm")
            if rev_growth_yoy is None:
                rev_growth_yoy = yoy.get("Revenue Till Qtr")
            if rev_growth_yoy is None:
                rev_growth_yoy = yoy.get("Revenue")
            if rev_growth_yoy is None:
                rev_growth_yoy = yoy.get("revenue")
            if rev_growth_yoy is not None:
                revenue_growth = rev_growth_yoy
            elif prev_q_entry:
                prev_computed = prev_q_entry.get("computed", {})
                prev_raw = prev_q_entry.get("raw", {})
                curr_rev = computed.get("revenue_ttm") or raw.get("Revenue") or raw.get("revenue") or raw.get("Interest Income") or raw.get("Total Operating Income")
                prev_rev = prev_computed.get("revenue_ttm") or prev_raw.get("Revenue") or prev_raw.get("revenue") or prev_raw.get("Interest Income") or prev_raw.get("Total Operating Income")
                if curr_rev is not None and prev_rev and prev_rev != 0:
                    revenue_growth = ((curr_rev - prev_rev) / abs(prev_rev)) * 100.0

            # Net Profit Growth (Backward compatibility / Display only)
            np_growth_yoy = yoy.get("net_profit_ttm")
            if np_growth_yoy is None:
                np_growth_yoy = yoy.get("Net Profit")
            if np_growth_yoy is None:
                np_growth_yoy = yoy.get("net_profit")
            if np_growth_yoy is not None:
                profit_growth = np_growth_yoy
            elif prev_q_entry:
                prev_raw = prev_q_entry.get("raw", {})
                curr_profit = raw.get("Net Profit") or raw.get("net_profit")
                prev_profit = prev_raw.get("Net Profit") or prev_raw.get("net_profit")
                if curr_profit is not None and prev_profit and prev_profit != 0:
                    profit_growth = ((curr_profit - prev_profit) / abs(prev_profit)) * 100.0
                else:
                    profit_growth = eps_growth

            # Operating Profit Growth
            op_growth_yoy = yoy.get("operating_profit")
            if op_growth_yoy is None:
                op_growth_yoy = yoy.get("Operating Profit")
            if op_growth_yoy is not None:
                op_growth = op_growth_yoy
            elif prev_q_entry:
                prev_raw = prev_q_entry.get("raw", {})
                curr_op = raw.get("Operating Profit") or raw.get("operating_profit")
                prev_op = prev_raw.get("Operating Profit") or prev_raw.get("operating_profit")
                if curr_op is not None and prev_op and prev_op != 0:
                    op_growth = ((curr_op - prev_op) / abs(prev_op)) * 100.0

            # --- EPS CONSISTENCY INDEX CALCULATION ---
            current_idx = sorted_periods.index((fy, qtr))
            comparison_periods = sorted_periods[current_idx : current_idx + 5]
            
            eps_sequence = []
            for p_fy, p_qtr in comparison_periods:
                p_q_entry = scrip_quarters.get((symbol, p_fy, p_qtr))
                if p_q_entry:
                    p_comp = p_q_entry.get("computed", {})
                    p_raw = p_q_entry.get("raw", {})
                    p_eps = p_comp.get("eps_ttm")
                    if p_eps is None:
                        p_eps = p_raw.get("EPS Reported") or p_raw.get("EPS")
                    if p_eps is not None:
                        eps_sequence.append(p_eps)
                    else:
                        break
                else:
                    break
            
            eps_sequence.reverse()
            transitions = 0
            consistent_transitions = 0
            for i in range(len(eps_sequence) - 1):
                transitions += 1
                if eps_sequence[i+1] >= eps_sequence[i]:
                    consistent_transitions += 1
            
            consistency_ratio = 1.0
            if transitions > 0:
                consistency_ratio = consistent_transitions / transitions
            
            # Consistency-Adjusted EPS Growth
            if eps_growth >= 0:
                eps_growth_adjusted = eps_growth * consistency_ratio
            else:
                eps_growth_adjusted = eps_growth * (2.0 - consistency_ratio)

            # --- QUALITY GATES (EXCLUSIONS) ---
            if roe < 0.0:
                # Exclude if destroying shareholder equity
                continue

            car = raw.get("CAR") or raw.get("car")
            if sector in ["Commercial Bank", "Development Bank"] and car is not None and car < 10.0:
                # Exclude banks with sub-regulatory capital adequacy
                continue

            npl = raw.get("NPL") or raw.get("npl")
            if sector in ["Commercial Bank", "Development Bank", "Microfinance"] and npl is not None and npl > 10.0:
                # Exclude institutions in asset quality crisis
                continue
                
            if sector not in sector_groups:
                sector_groups[sector] = []
                
            sector_groups[sector].append({
                "symbol": symbol,
                "roe": roe,
                "eps": eps,
                "epsGrowth": eps_growth,
                "epsGrowthAdjusted": eps_growth_adjusted,
                "epsConsistency": consistency_ratio * 100.0,
                "profitGrowth": profit_growth,
                "revenueGrowth": revenue_growth,
                "netMargin": net_margin,
                "raw": raw,
                "computed": computed,
                "yoy": yoy,
                "opGrowth": op_growth
            })
            
        # Calculate percentiles and hybrid scores within each sector
        ranked_sectors = {}
        for sector, stocks in sector_groups.items():
            n = len(stocks)
            if n == 0:
                continue
                
            def get_percentiles(key_func):
                sorted_stocks = sorted(stocks, key=key_func)
                pcts = {}
                for idx, s in enumerate(sorted_stocks):
                    val = key_func(s)
                    indices = [j for j, item in enumerate(sorted_stocks) if key_func(item) == val]
                    avg_idx = sum(indices) / len(indices)
                    pct = (avg_idx / (n - 1)) * 100.0 if n > 1 else 100.0
                    pcts[s["symbol"]] = pct
                return pcts
                
            roe_pcts = get_percentiles(lambda x: x["roe"])
            eps_growth_pcts = get_percentiles(lambda x: x["epsGrowthAdjusted"])
            net_margin_pcts = get_percentiles(lambda x: x["netMargin"])
            revenue_growth_pcts = get_percentiles(lambda x: x["revenueGrowth"])
            
            scored_stocks = []
            for s in stocks:
                r_pct = roe_pcts.get(s["symbol"], 50.0)
                eg_pct = eps_growth_pcts.get(s["symbol"], 50.0)
                nm_pct = net_margin_pcts.get(s["symbol"], 50.0)
                rg_pct = revenue_growth_pcts.get(s["symbol"], 50.0)
                
                # Universal Base Percentile Score (0-100)
                base_score = 0.35 * r_pct + 0.25 * eg_pct + 0.20 * nm_pct + 0.20 * rg_pct
                
                # Quality Modifier
                avg_div = avg_dividends.get(s["symbol"], 0.0)
                mod, detail_str = compute_quality_modifier(
                    sector, s["raw"], s["computed"], s["yoy"], s["opGrowth"], avg_div
                )
                
                # Final Score = Base * (1 + Modifier)
                final_score = base_score * (1.0 + mod)
                final_score = max(0.0, min(100.0, final_score))
                
                scored_stocks.append({
                    "symbol": s["symbol"],
                    "score": round(final_score, 1),
                    "baseScore": round(base_score, 1),
                    "roe": round(s["roe"], 2),
                    "eps": round(s["eps"], 2),
                    "epsGrowth": round(s["epsGrowth"], 2),
                    "epsConsistency": round(s["epsConsistency"], 1),
                    "profitGrowth": round(s["profitGrowth"], 2),
                    "revenueGrowth": round(s["revenueGrowth"], 2),
                    "netMargin": round(s["netMargin"], 2),
                    "qualityModifier": round(mod * 100.0, 1), # as percentage (e.g. +12.5 or -8.3)
                    "qualityDetail": detail_str
                })
                
            # Sort descending by final score
            ranked = sorted(scored_stocks, key=lambda x: x["score"], reverse=True)
            # Keep top 3
            ranked_sectors[sector] = ranked[:3]
            
        rankings[period_label] = ranked_sectors
        
    # Write to database
    output_path = os.path.join(project_root, "db", "quarterly_top_performers.json")
    result = {
        "generatedAt": datetime.now().isoformat(),
        "latestPeriod": f"FY {latest_fy} Q{latest_qtr}",
        "periods": rankings
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        
    print(f"Top performers analysis saved to {output_path}")

if __name__ == "__main__":
    main()
