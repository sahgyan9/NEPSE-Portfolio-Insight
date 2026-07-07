import json
import os
import sys
import math
import subprocess
from datetime import datetime

# Sector volatility heuristics
SECTOR_VOLATILITY = {
    "Commercial Bank": 0.15,
    "Development Bank": 0.20,
    "Life Insurance": 0.22,
    "Non-Life Insurance": 0.25,
    "Microfinance": 0.35,
    "Hydropower": 0.40,
    "Finance": 0.30,
    "Manufacturing": 0.18,
    "Hotels": 0.38,
    "Investment": 0.25,
    "Trading": 0.30,
    "Telecom": 0.12,
    "Mutual Fund": 0.10,
    "Others": 0.25
}

# Known sectors for portfolio stocks
SECTOR_MAPPING = {
    "BHL": "Hydropower",
    "CHCL": "Hydropower",
    "SAHAS": "Hydropower",
    "SGHC": "Hydropower",
    "UPPER": "Hydropower",
    "MEN": "Hydropower",
    "HBL": "Commercial Bank",
    "NABIL": "Commercial Bank",
    "NICA": "Commercial Bank",
    "NIMB": "Commercial Bank",
    "CBBL": "Microfinance",
    "JBLB": "Microfinance",
    "CLI": "Life Insurance",
    "SNLI": "Life Insurance",
    "HRL": "Non-Life Insurance",
    "HDL": "Manufacturing",
    "GCIL": "Manufacturing",
    "SARBTM": "Manufacturing",
    "SHIVM": "Manufacturing",
    "SONA": "Trading",
    "NTC": "Telecom",
    "SHL": "Hotels",
    "CSY": "Mutual Fund",
    "CSBY": "Mutual Fund",
    "KDBY": "Mutual Fund",
    "MMF1": "Mutual Fund",
    "NBF3": "Mutual Fund",
    "NIBLSF": "Mutual Fund",
    "NMBSBFE": "Mutual Fund"
}

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except Exception:
            return None

def trigger_fetch_quarterly(symbol):
    """Trigger the scrape and parse scripts programmatically if quarterly data is missing."""
    symbol = symbol.upper()
    python_bin = sys.executable
    tools_dir = os.path.dirname(__file__)
    project_root = os.path.dirname(tools_dir)
    
    scrape_script = os.path.join(tools_dir, "scrape_nepsealpha.py")
    parse_script = os.path.join(tools_dir, "parse_nepsealpha_md.py")
    
    print(f"[Health Algorithm] Missing quarterly data for {symbol}. Fetching live...")
    try:
        # Run scrape script
        r1 = subprocess.run([python_bin, scrape_script, symbol], capture_output=True, text=True, cwd=project_root)
        if r1.returncode != 0:
            print(f"[Health Algorithm] Scrape script failed for {symbol}: {r1.stderr}")
            return False
        
        # Run parse script
        r2 = subprocess.run([python_bin, parse_script, symbol], capture_output=True, text=True, cwd=project_root)
        if r2.returncode != 0:
            print(f"[Health Algorithm] Parse script failed for {symbol}: {r2.stderr}")
            return False
        
        print(f"[Health Algorithm] Successfully fetched quarterly data for {symbol}.")
        return True
    except Exception as e:
        print(f"[Health Algorithm] Failed to run fetch scripts for {symbol}: {e}")
        return False

def calculate_health():
    db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db")
    portfolio_data = load_json(os.path.join(db_dir, "portfolio.json"))
    fundamentals_data = load_json(os.path.join(db_dir, "fundamentals.json")) or {}
    manual_dividends = load_json(os.path.join(db_dir, "manual_dividends.json")) or {"entries": []}
    
    if not portfolio_data or "holdings" not in portfolio_data or not portfolio_data["holdings"]:
        print("No portfolio holdings found.")
        return
        
    holdings = portfolio_data["holdings"]
    total_value = 0
    holdings_processed = []
    
    # Calculate current values and total portfolio value
    for h in holdings:
        sym = h["symbol"]
        qty = h.get("quantity", 0)
        avg_cost = h.get("avgCost", 0)
        
        # Look up price in valueHistory or fundamentals or default
        price = avg_cost # default
        fund = fundamentals_data.get(sym, {})
        if fund.get("peRatio") and fund.get("eps"):
            price = fund["peRatio"] * fund["eps"]
            
        current_value = qty * price
        total_value += current_value
        
        holdings_processed.append({
            "symbol": sym,
            "quantity": qty,
            "avgCost": avg_cost,
            "currentPrice": price,
            "currentValue": current_value,
            "sector": SECTOR_MAPPING.get(sym, "Others")
        })
        
    if total_value == 0:
        total_value = sum(h["currentValue"] for h in holdings_processed) or 1.0

    # Populate weights
    for h in holdings_processed:
        h["weight"] = h["currentValue"] / total_value

    alerts = []
    strengths = []
    warnings = []
    recommendations = []

    # ---------------------------------------------------------
    # Pillar 1: Structure & Diversification (20% weight)
    # ---------------------------------------------------------
    sector_weights = {}
    for h in holdings_processed:
        sector_weights[h["sector"]] = sector_weights.get(h["sector"], 0.0) + h["weight"]
        
    hhi = sum(w**2 for w in sector_weights.values())
    diversification_score = max(0, min(100, round((1.0 - hhi) * 125)))  # scale to make it reach 100 more easily

    max_weight = max(h["weight"] for h in holdings_processed) if holdings_processed else 0
    concentration_score = 100
    if max_weight > 0.25:
        penalty = (max_weight - 0.25) * 200
        concentration_score = max(0, min(100, round(100 - penalty)))
        max_stock = next(h["symbol"] for h in holdings_processed if h["weight"] == max_weight)
        warnings.append(f"Concentration risk: {max_stock} represents {max_weight*100:.1f}% of the portfolio.")
        recommendations.append(f"Trim position in {max_stock} to bring it below 20-25% of total asset allocation.")
    else:
        strengths.append("Concentration risk is well-managed with no holding exceeding 25% weight.")
        
    if len(sector_weights) >= 5:
        strengths.append(f"Good sector diversification across {len(sector_weights)} sectors.")
    elif len(sector_weights) <= 2:
        warnings.append("Low sector diversification. Highly vulnerable to sector-specific shocks.")
        recommendations.append("Consider allocating capital to other sectors (e.g. Commercial Banks or Manufacturing) to spread risk.")

    structure_score = round(diversification_score * 0.6 + concentration_score * 0.4)

    # ---------------------------------------------------------
    # Pillar 2: Sector-Aware Fundamentals (25% weight)
    # ---------------------------------------------------------
    fundamental_scores = []
    fundamental_weights = []

    for h in holdings_processed:
        sym = h["symbol"]
        weight = h["weight"]
        sector = h["sector"]
        
        if sector == "Mutual Fund":
            continue # Mutual Funds don't report normal quarterly ratios
            
        # Check if quarterly report exists
        q_path = os.path.join(db_dir, "quarterly", f"{sym}.json")
        if not os.path.exists(q_path):
            # Attempt to auto-fetch
            success = trigger_fetch_quarterly(sym)
            if not success:
                print(f"[Health Algorithm] Fetch failed for {sym}. Using defaults.")
        
        q_data = load_json(q_path)
        latest_q = q_data["quarters"][-1] if q_data and q_data.get("quarters") else None
        
        scrip_score = 70.0 # default baseline
        
        if latest_q:
            raw = latest_q.get("raw", {})
            computed = latest_q.get("computed", {})
            
            if sector in ["Commercial Bank", "Microfinance"]:
                # CAR Score
                car = raw.get("CAR")
                if car is None:
                    # try fallback key lowercase
                    car = raw.get("car") or computed.get("car")
                
                car_score = 50.0
                if car is not None:
                    min_car = 11.0 if sector == "Commercial Bank" else 8.0
                    exc_car = 14.0 if sector == "Commercial Bank" else 15.0
                    
                    if car < min_car:
                        car_score = 0.0
                        warnings.append(f"Regulatory Alert: {sym} CAR ({car:.2f}%) is below NRB requirement ({min_car}%). Dividends may be frozen.")
                        recommendations.append(f"Avoid adding more to {sym} until its capital cushion (CAR) improves.")
                    elif car >= exc_car:
                        car_score = 100.0
                    else:
                        car_score = 80.0
                
                # CD Ratio Score
                cd = raw.get("CD ratio") or raw.get("cd_ratio") or raw.get("CD Ratio")
                cd_score = 70.0
                if cd is not None:
                    if sector == "Commercial Bank":
                        if 80.0 <= cd <= 85.0: cd_score = 100.0
                        elif 75.0 <= cd <= 88.0: cd_score = 85.0
                        elif cd > 90.0:
                            cd_score = 30.0
                            warnings.append(f"Liquidity Crunch: {sym} CD ratio ({cd:.2f}%) exceeds safe 90% limit.")
                    else:  # Microfinance
                        if 90.0 <= cd <= 115.0: cd_score = 100.0
                        elif 85.0 <= cd <= 125.0: cd_score = 80.0
                        elif cd > 125.0:
                            cd_score = 40.0
                            warnings.append(f"Leverage Alert: {sym} CD ratio is {cd:.2f}%. Highly dependent on commercial bank borrowings.")
                            recommendations.append(f"Monitor {sym}'s Cost of Funds since high CD indicates borrow-heavy growth.")
                
                # Cost of Funds (COF) Score
                cof = raw.get("Cost of funds") or raw.get("Cost of Funds") or raw.get("cost_of_funds")
                cof_score = 70.0
                if cof is not None:
                    if cof < 6.5: cof_score = 100.0
                    elif cof < 7.5: cof_score = 85.0
                    elif cof > 9.5:
                        cof_score = 30.0
                        warnings.append(f"Margin Squeeze: {sym} Cost of Funds is very high at {cof:.2f}%.")
                
                # NPL Score
                npl = raw.get("NPL") or raw.get("npl")
                npl_score = 70.0
                if npl is not None:
                    if npl < 1.5: npl_score = 100.0
                    elif npl <= 3.0: npl_score = 80.0
                    elif npl > 5.0:
                        npl_score = 20.0
                        warnings.append(f"Bad Loans Warning: {sym} NPL has hit {npl:.2f}%, exceeding 5% threshold.")
                        recommendations.append(f"Review asset quality and provisioning trends for {sym}.")
                
                scrip_score = 0.35 * car_score + 0.25 * cd_score + 0.20 * cof_score + 0.20 * npl_score
                
            elif sector == "Hydropower":
                # Debt to Equity
                borrowings = raw.get("Borrowings") or 0.0
                equity = raw.get("Total Equity") or 1.0
                de = borrowings / equity if equity > 0 else 0
                
                de_score = 70.0
                if de > 0:
                    if de < 0.8: de_score = 100.0
                    elif de <= 1.2: de_score = 85.0
                    elif de <= 1.6: de_score = 60.0
                    elif de > 2.0:
                        de_score = 20.0
                        warnings.append(f"Highly Leveraged: {sym} Debt-to-Equity is {de:.2f}. High interest payment drag.")
                        recommendations.append(f"Favor hydropowers like CHCL or MEN that have lower debt loads.")
                
                # ROA Score
                roa = computed.get("roa_ttm") or computed.get("roa")
                roa_score = 60.0
                if roa is not None:
                    if roa >= 8.0: roa_score = 100.0
                    elif roa >= 5.0: roa_score = 80.0
                    elif roa < 2.0: roa_score = 30.0
                
                # YoY Profit Growth
                yoy_np = latest_q.get("yoy", {}).get("net_profit_ttm") or latest_q.get("yoy", {}).get("Net Profit") or 0.0
                growth_score = 60.0
                if yoy_np:
                    if yoy_np >= 20.0: growth_score = 100.0
                    elif yoy_np >= 5.0: growth_score = 80.0
                    elif yoy_np < 0: growth_score = 30.0
                    
                scrip_score = 0.40 * de_score + 0.30 * roa_score + 0.30 * growth_score
                
            else: # Manufacturing, Insurance, Telecom, Trading, etc.
                # ROE Score
                roe = computed.get("roe_ttm") or computed.get("roe")
                roe_score = 60.0
                if roe is not None:
                    if roe >= 18.0: roe_score = 100.0
                    elif roe >= 12.0: roe_score = 80.0
                    elif roe < 6.0: roe_score = 30.0
                
                # ROA Score
                roa = computed.get("roa_ttm") or computed.get("roa")
                roa_score = 60.0
                if roa is not None:
                    if roa >= 4.0: roa_score = 100.0
                    elif roa >= 2.0: roa_score = 80.0
                    elif roa < 0.5: roa_score = 30.0
                
                # YoY Profit Growth
                yoy_np = latest_q.get("yoy", {}).get("net_profit_ttm") or latest_q.get("yoy", {}).get("Net Profit") or 0.0
                growth_score = 60.0
                if yoy_np:
                    if yoy_np >= 20.0: growth_score = 100.0
                    elif yoy_np >= 5.0: growth_score = 80.0
                    elif yoy_np < 0: growth_score = 30.0
                
                scrip_score = 0.40 * roe_score + 0.30 * roa_score + 0.30 * growth_score

        fundamental_scores.append(scrip_score)
        fundamental_weights.append(weight)
        
    if fundamental_weights:
        total_f_weight = sum(fundamental_weights)
        f_score = sum(s * w for s, w in zip(fundamental_scores, fundamental_weights)) / total_f_weight
        fundamentals_score = round(f_score)
    else:
        fundamentals_score = 75 # default

    # Add strength if fundamentals score is high
    if fundamentals_score >= 80:
        strengths.append("The portfolio is anchored by highly profitable and capital-efficient businesses.")

    # ---------------------------------------------------------
    # Pillar 3: Valuation Margin of Safety (20% weight)
    # ---------------------------------------------------------
    valuation_scores = []
    
    for h in holdings_processed:
        sym = h["symbol"]
        weight = h["weight"]
        fund = fundamentals_data.get(sym, {})
        
        pe = fund.get("peRatio")
        pb = fund.get("pbRatio")
        
        # PE Score
        pe_score = 60
        if pe is not None:
            if pe < 0: pe_score = 20
            elif pe < 15: pe_score = 100
            elif pe <= 25: pe_score = 80
            elif pe <= 35: pe_score = 60
            elif pe <= 50: pe_score = 40
            else: pe_score = 20
            
        # PB Score
        pb_score = 60
        if pb is not None:
            if pb < 1.2: pb_score = 100
            elif pb <= 2.2: pb_score = 80
            elif pb <= 3.5: pb_score = 60
            elif pb <= 5.0: pb_score = 40
            else: pb_score = 20
            
        # PEG Score (PE / YoY profit growth)
        # Fetch growth from quarterly
        q_path = os.path.join(db_dir, "quarterly", f"{sym}.json")
        q_data = load_json(q_path)
        latest_q = q_data["quarters"][-1] if q_data and q_data.get("quarters") else None
        growth = 0.0
        if latest_q:
            growth = latest_q.get("yoy", {}).get("net_profit_ttm") or latest_q.get("yoy", {}).get("Net Profit") or 0.0
            
        peg_score = 60
        if pe and pe > 0 and growth > 0:
            peg = pe / growth
            if peg < 1.0: peg_score = 100
            elif peg <= 1.5: peg_score = 80
            elif peg <= 2.5: peg_score = 50
            else: peg_score = 20
        elif growth <= 0:
            peg_score = 20
            
        scrip_val_score = 0.40 * pe_score + 0.30 * pb_score + 0.30 * peg_score
        valuation_scores.append(scrip_val_score)

    if holdings_processed:
        valuation_score = round(sum(s * h["weight"] for s, h in zip(valuation_scores, holdings_processed)))
    else:
        valuation_score = 60
        
    if valuation_score >= 75:
        strengths.append("High Margin of Safety: Portfolio is priced reasonably relative to its earnings power.")
    elif valuation_score < 50:
        warnings.append("Valuation warning: Portfolio components are trading at premium multiples relative to earnings.")
        recommendations.append("Consider locking in profits on extremely high PE/PB holdings and reallocating to value-zone stocks.")

    # ---------------------------------------------------------
    # Pillar 4: Dividend & Compounding Quality (15% weight)
    # ---------------------------------------------------------
    # Let's check manual dividends to compute yield and alignment
    # Group manual dividends by symbol
    div_map = {}
    for entry in manual_dividends.get("entries", []):
        sym = entry.get("symbol", "").upper()
        if sym and sym not in div_map:
            div_map[sym] = entry
            
    total_yield = 0.0
    roe_alignment_scores = []
    
    for h in holdings_processed:
        sym = h["symbol"]
        weight = h["weight"]
        
        # Calculate yield
        manual_div = div_map.get(sym, {})
        cash_pct = manual_div.get("cashPercent")
        bonus_pct = manual_div.get("bonusPercent")
        
        fund = fundamentals_data.get(sym, {})
        static_yield = fund.get("dividendYield") or 0.0
        
        if cash_pct is not None:
            # Yield = cash_pct * 100 / currentPrice (assuming standard face value of 100)
            yield_val = (cash_pct * 100.0) / h["currentPrice"]
        else:
            yield_val = static_yield
            
        total_yield += yield_val * weight
        
        # ROE Alignment: high ROE (>15) + bonus = excellent compounding. low ROE (<10) + bonus = dilutive.
        eps_val = fund.get("eps")
        if eps_val is None:
            eps_val = 0.0
        bv_val = fund.get("bookValue")
        if bv_val is None or bv_val == 0:
            bv_val = 100.0
        roe = (eps_val / bv_val) * 100.0
        # Check quarterly for TTM ROE
        q_path = os.path.join(db_dir, "quarterly", f"{sym}.json")
        q_data = load_json(q_path)
        if q_data and q_data.get("quarters"):
            roe = q_data["quarters"][-1].get("computed", {}).get("roe_ttm") or roe
            
        alignment = 80
        if bonus_pct and bonus_pct > 0:
            if roe > 15.0:
                alignment = 100
            elif roe < 10.0:
                alignment = 45
                warnings.append(f"Compounding Drag: {sym} has low ROE ({roe:.1f}%) but issues bonus shares, causing capital dilution.")
                recommendations.append(f"For low ROE holdings like {sym}, prefer cash dividends over bonus share issuances.")
        elif cash_pct and cash_pct > 0:
            if roe > 15.0:
                alignment = 70 # paying cash when they could compound inside
                
        roe_alignment_scores.append(alignment)

    # Yield score
    yield_score = 20
    if total_yield >= 6.0: yield_score = 100
    elif total_yield >= 4.0: yield_score = 80
    elif total_yield >= 2.0: yield_score = 60
    elif total_yield >= 1.0: yield_score = 40
    
    avg_alignment = sum(s * h["weight"] for s, h in zip(roe_alignment_scores, holdings_processed)) if holdings_processed else 80
    dividend_score = round(yield_score * 0.5 + avg_alignment * 0.5)

    if total_yield >= 4.5:
        strengths.append(f"High income potential: Portfolio is yielding {total_yield:.2f}% in cash flow.")

    # ---------------------------------------------------------
    # Pillar 5: Market Risk & Volatility (20% weight)
    # ---------------------------------------------------------
    weighted_vol = sum(SECTOR_VOLATILITY.get(h["sector"], 0.25) * h["weight"] for h in holdings_processed)
    vol_score = round((1.0 - weighted_vol) * 100)
    
    # Check valueHistory for drawdown
    history = portfolio_data.get("valueHistory", [])
    trend_score = 80.0
    
    if history:
        # Parse history
        vals = [pt["value"] for pt in history if pt.get("value", 0) > 0]
        invested = [pt["invested"] for pt in history if pt.get("invested", 0) > 0]
        
        if vals:
            current = vals[-1]
            inv = invested[-1] if invested else current
            
            # Loss check
            if current < inv:
                loss_pct = (inv - current) / inv * 100
                trend_score -= min(40, loss_pct * 2)
                warnings.append(f"Current portfolio value is resting at {loss_pct:.1f}% below total invested cost.")
            else:
                gain_pct = (current - inv) / inv * 100
                trend_score += min(20, gain_pct * 0.5)
                
            # Standard Deviation check (Volatility)
            if len(vals) > 5:
                mean = sum(vals) / len(vals)
                variance = sum((x - mean) ** 2 for x in vals) / len(vals)
                std_dev = math.sqrt(variance)
                cov = std_dev / mean if mean > 0 else 0
                
                if cov > 0.15:
                    trend_score -= 15
                    warnings.append(f"Historical portfolio volatility is high (CoV={cov*100:.1f}%).")
                    
    trend_score = max(0, min(100, trend_score))
    volatility_score = round(vol_score * 0.6 + trend_score * 0.4)

    # ---------------------------------------------------------
    # NRB Margin Lending Cap Warning (Rs. 25 Crores)
    # ---------------------------------------------------------
    NRB_CAP_NPR = 250000000.0  # 25 Crores
    for h in holdings_processed:
        if h["currentValue"] > NRB_CAP_NPR:
            warnings.append(f"Regulatory Cap Threat: Your holding in {h['symbol']} (Rs. {h['currentValue']:,.2f}) exceeds the NRB single-obligor margin lending cap of Rs. 25 Crores.")
            recommendations.append(f"Consider diversifying out of {h['symbol']} to avoid lending-related liquidity constraints.")

    # ---------------------------------------------------------
    # Overall Score Calculation
    # ---------------------------------------------------------
    overall_score = round(
        structure_score * 0.20 +
        fundamentals_score * 0.25 +
        valuation_score * 0.20 +
        dividend_score * 0.15 +
        volatility_score * 0.20
    )

    # Determine grade
    if overall_score >= 85: grade = 'A+'
    elif overall_score >= 78: grade = 'A'
    elif overall_score >= 70: grade = 'B+'
    elif overall_score >= 60: grade = 'B'
    elif overall_score >= 50: grade = 'C'
    elif overall_score >= 40: grade = 'D'
    else: grade = 'F'

    # Build response structure
    result = {
        "overallScore": overall_score,
        "grade": grade,
        "pillars": {
            "structure": {
                "name": "Diversification & Structure",
                "score": structure_score,
                "description": "Measures sector weight balance and concentration limits."
            },
            "fundamentals": {
                "name": "Financial Fundamentals",
                "score": fundamentals_score,
                "description": "Sector-aware banking metrics (CAR, CD, COF) and hydropower leverage analysis."
            },
            "valuation": {
                "name": "Margin of Safety",
                "score": valuation_score,
                "description": "Portfolio pricing relative to book value, earnings, and PEG growth metrics."
            },
            "dividend": {
                "name": "Dividend & Compounding",
                "score": dividend_score,
                "description": "Cash flow yield and ROE-to-retention alignment."
            },
            "volatility": {
                "name": "Market Risk & Drawdown",
                "score": volatility_score,
                "description": "Volatility scores combined with historical drawdown metrics."
            }
        },
        "holdings": [
            {
                "symbol": h["symbol"],
                "sector": h["sector"],
                "weight": round(h["weight"], 4),
                "currentValue": round(h["currentValue"], 2)
            } for h in holdings_processed
        ],
        "strengths": strengths,
        "warnings": warnings,
        "recommendations": recommendations,
        "calculatedAt": datetime.now().isoformat()
    }

    # Save to db
    output_path = os.path.join(db_dir, "portfolio_health.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"Health score computed: {overall_score} ({grade})")
    print(f"Health score data saved to {output_path}")

if __name__ == "__main__":
    calculate_health()
