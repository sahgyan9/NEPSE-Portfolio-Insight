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

def main():
    print("Computing top quarterly stock performers per sector...")
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    quarterly_dir = os.path.join(project_root, "db", "quarterly")
    
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
    # We will compile a lookup for every (symbol, fy, quarter)
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
                
    # Find the latest period overall
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
    
    # 3. Calculate metrics and score for each stock in the latest quarter
    rankings = {} # period_label -> { sector -> [top_performers] }
    
    # Let's compute for the latest 4 periods to show history if needed,
    # but primarily we focus on the latest detected period
    for period in sorted_periods[:4]:
        fy, qtr = period
        period_label = f"FY {fy} Q{qtr}"
        
        # Collect raw values first in each sector
        sector_groups = {} # sector -> list of stock records
        
        for symbol, stock_data in all_data.items():
            q_entry = scrip_quarters.get((symbol, fy, qtr))
            if not q_entry:
                continue
                
            computed = q_entry.get("computed", {})
            raw = q_entry.get("raw", {})
            
            # Fetch current metrics
            roe = computed.get("roe_ttm")
            if roe is None:
                roe = raw.get("ROE Reported") or 0.0
                
            eps = computed.get("eps_ttm")
            if eps is None:
                eps = raw.get("EPS Reported") or 0.0
                
            # To calculate growth, find previous year's corresponding quarter
            match = re.match(r'(\d+)-(\d+)', fy)
            prev_fy = None
            if match:
                y1 = int(match.group(1)) - 1
                y2 = int(match.group(2)) - 1
                prev_fy = f"{y1:04d}-{y2:02d}" if len(match.group(2)) == 2 else f"{y1:04d}-{y2:04d}"
                
            prev_q_entry = scrip_quarters.get((symbol, prev_fy, qtr)) if prev_fy else None
            
            eps_growth = 0.0
            profit_growth = 0.0
            
            if prev_q_entry:
                prev_computed = prev_q_entry.get("computed", {})
                prev_raw = prev_q_entry.get("raw", {})
                
                # EPS growth
                prev_eps = prev_computed.get("eps_ttm") or prev_raw.get("EPS Reported")
                if prev_eps and prev_eps != 0:
                    eps_growth = ((eps - prev_eps) / abs(prev_eps)) * 100.0
                    
                # Profit growth
                curr_profit = raw.get("Net Profit")
                prev_profit = prev_raw.get("Net Profit")
                if curr_profit is not None and prev_profit and prev_profit != 0:
                    profit_growth = ((curr_profit - prev_profit) / abs(prev_profit)) * 100.0
                else:
                    # Fallback to EPS growth
                    profit_growth = eps_growth
            
            sector = sector_map[symbol]
            if sector == "Mutual Fund":
                # Skip mutual funds as they don't have standard quarterly ratios
                continue
                
            if sector not in sector_groups:
                sector_groups[sector] = []
                
            sector_groups[sector].append({
                "symbol": symbol,
                "roe": roe,
                "eps": eps,
                "epsGrowth": eps_growth,
                "profitGrowth": profit_growth
            })
            
        # Calculate percentiles and score within each sector
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
            eps_growth_pcts = get_percentiles(lambda x: x["epsGrowth"])
            profit_growth_pcts = get_percentiles(lambda x: x["profitGrowth"])
            
            scored_stocks = []
            for s in stocks:
                r_pct = roe_pcts.get(s["symbol"], 50.0)
                eg_pct = eps_growth_pcts.get(s["symbol"], 50.0)
                pg_pct = profit_growth_pcts.get(s["symbol"], 50.0)
                
                # Composite Percentile Score (0-100)
                score = 0.4 * r_pct + 0.3 * eg_pct + 0.3 * pg_pct
                
                scored_stocks.append({
                    "symbol": s["symbol"],
                    "score": round(score, 1),
                    "roe": round(s["roe"], 2),
                    "eps": round(s["eps"], 2),
                    "epsGrowth": round(s["epsGrowth"], 2),
                    "profitGrowth": round(s["profitGrowth"], 2)
                })
                
            # Sort descending by score
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
