import json
import os
import argparse
import math

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

# Sector volatility heuristics (based on frontier market models from arXiv q-fin)
# Lower is less volatile.
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

# Authoritative symbol -> sector map (kept in sync with
# src/data/companyRegistry.ts). Used as the PRIMARY source because the scraped
# quarterly JSONs mislabel several scrips (e.g. CBBL/SNLI as "unknown", HRL/NTC
# as "Others") and mutual funds have no quarterly file at all.
SYMBOL_SECTOR = {
    # Hydropower
    "BHL": "Hydropower", "CHCL": "Hydropower", "SAHAS": "Hydropower",
    "SGHC": "Hydropower", "UPPER": "Hydropower", "MEN": "Hydropower",
    # Commercial Banks
    "HBL": "Commercial Bank", "NABIL": "Commercial Bank", "NICA": "Commercial Bank",
    "NIMB": "Commercial Bank", "NBL": "Commercial Bank",
    # Microfinance
    "CBBL": "Microfinance", "AVYAN": "Microfinance", "JBLB": "Microfinance",
    "SKBBL": "Microfinance",
    # Hotel / Tourism
    "SHL": "Hotel",
    # Life Insurance
    "CLI": "Life Insurance", "SNLI": "Life Insurance",
    # Non-Life Insurance / Reinsurance
    "HRL": "Non-Life Insurance",
    # Manufacturing & Processing
    "HDL": "Manufacturing", "GCIL": "Manufacturing", "SARBTM": "Manufacturing",
    "SONA": "Manufacturing", "SHIVM": "Manufacturing",
    # Telecom
    "NTC": "Telecom",
    # Mutual Funds
    "CSBY": "Mutual Fund", "CSY": "Mutual Fund", "KDBY": "Mutual Fund",
    "MMF1": "Mutual Fund", "NBF3": "Mutual Fund", "NIBLSF": "Mutual Fund",
    "NMBSBFE": "Mutual Fund",
}


def normalize_sector(sector):
    if not sector:
        return "Others"
    s = sector.strip().lower()
    if "bank" in s:
        if "development" in s:
            return "Development Bank"
        return "Commercial Bank"
    if "microfinance" in s or "laghubitta" in s:
        return "Microfinance"
    # Check non-life/reinsurance BEFORE life, since "non-life insurance"
    # contains the substring "life insurance".
    if "non-life" in s or "non life" in s or "reinsurance" in s:
        return "Non-Life Insurance"
    if "life insurance" in s:
        return "Life Insurance"
    if "insurance" in s:
        return "Life Insurance" # default fallback
    if "hydro" in s:
        return "Hydropower"
    if "manufactur" in s or "distiller" in s or "cement" in s:
        return "Manufacturing"
    if "hotel" in s or "tourism" in s:
        return "Hotels"
    if "invest" in s:
        return "Investment"
    if "trade" in s or "oil" in s:
        return "Trading"
    if "telecom" in s or "phone" in s or "communication" in s:
        return "Telecom"
    if "mutual" in s or "fund" in s:
        return "Mutual Fund"
    return sector.title()

def analyze_portfolio():
    print("="*60)
    print("QUANTITATIVE PORTFOLIO OPTIMIZATION (MPT HEURISTIC)")
    print("="*60)
    
    db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db")
    portfolio_data = load_json(os.path.join(db_dir, "portfolio.json"))
    fundamentals_data = load_json(os.path.join(db_dir, "fundamentals.json"))
    
    if not portfolio_data or "holdings" not in portfolio_data or not portfolio_data["holdings"]:
        print("No holdings found in portfolio.json.")
        return
        
    holdings = portfolio_data["holdings"]
    fundamentals = fundamentals_data if fundamentals_data else {}
    
    total_value = sum([h.get("quantity", 0) * h.get("avgCost", 0) for h in holdings])
    if total_value == 0:
        print("Total portfolio value is zero.")
        return
        
    print(f"\nAnalyzing {len(holdings)} holdings. Total Value: Rs. {total_value:,.2f}")
    
    # Calculate current weights and risk profile
    portfolio_volatility = 0
    sector_exposure = {}
    
    for h in holdings:
        sym = h["symbol"]
        value = h.get("quantity", 0) * h.get("avgCost", 0)
        weight = value / total_value
        
        # Sector resolution order: authoritative map -> fundamentals -> quarterly.
        # The map wins first because scraped sources mislabel several scrips.
        sector = SYMBOL_SECTOR.get(sym.upper())

        if not sector:
            fund = fundamentals.get(sym, {})
            sector = fund.get("sector")

        if not sector:
            # Fallback to quarterly JSON sector
            q_path = os.path.join(db_dir, "quarterly", f"{sym}.json")
            q_data = load_json(q_path)
            if q_data and q_data.get("sector"):
                sector = q_data["sector"]
                
        normalized_sector = normalize_sector(sector)
        vol = SECTOR_VOLATILITY.get(normalized_sector, 0.25)
            
        sector_exposure[normalized_sector] = sector_exposure.get(normalized_sector, 0.0) + weight
        portfolio_volatility += (weight * vol)
        
    print(f"\nCurrent Portfolio Volatility Score: {portfolio_volatility:.3f} (Lower is safer)")
    print("\nSector Exposure:")
    for sec, w in sorted(sector_exposure.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {sec}: {w*100:.1f}%")
        
    # Simple Optimization Suggestion
    print("\n[OPTIMIZATION SUGGESTIONS]")
    if portfolio_volatility > 0.30:
        print("[WARN] HIGH RISK: Your portfolio is heavily tilted towards highly volatile sectors (e.g. Hydropower, Microfinance).")
        print("   Suggestion: Consider rebalancing 15-20% of your capital into Commercial Banks or Manufacturing to reduce variance drag.")
        suggestion_text = "HIGH RISK: Your portfolio is heavily tilted towards highly volatile sectors (e.g. Hydropower, Microfinance). Suggestion: Consider rebalancing 15-20% of your capital into Commercial Banks or Manufacturing to reduce variance drag."
    elif portfolio_volatility < 0.18:
        print("[WARN] LOW VOLATILITY: Your portfolio is extremely defensive.")
        print("   Suggestion: If you have a long time horizon, you are sacrificing expected returns. Consider adding 10% exposure to high-beta sectors like Hydropower or Microfinance.")
        suggestion_text = "LOW VOLATILITY: Your portfolio is extremely defensive. Suggestion: If you have a long time horizon, you are sacrificing expected returns. Consider adding 10% exposure to high-beta sectors like Hydropower or Microfinance."
    else:
        print("[OK] BALANCED: Your portfolio has a healthy mix of defensive and growth variance.")
        suggestion_text = "BALANCED: Your portfolio has a healthy mix of defensive and growth variance."
        
    # Stock-specific PE check
    valuation_warnings = []
    print("\n[VALUATION CHECK]")
    for h in holdings:
        sym = h["symbol"]
        fund = fundamentals.get(sym, {})
        pe = fund.get("peRatio")
        if pe is not None:
            if pe > 50:
                msg = f"{sym}: VERY HIGH P/E ({pe}). Consider taking profits if growth slows."
                print(f"  - {msg}")
                valuation_warnings.append({"symbol": sym, "type": "OVERVALUED", "message": msg, "pe": pe})
            elif pe > 0 and pe < 15:
                msg = f"{sym}: VALUE ZONE P/E ({pe}). Potentially undervalued based on earnings."
                print(f"  - {msg}")
                valuation_warnings.append({"symbol": sym, "type": "UNDERVALUED", "message": msg, "pe": pe})

    # Save Structured JSON Output
    output = {
        "totalValue": total_value,
        "holdingCount": len(holdings),
        "volatilityScore": round(portfolio_volatility, 3),
        "sectorExposure": [{"sector": k, "weight": round(v, 4)} for k, v in sorted(sector_exposure.items(), key=lambda x: x[1], reverse=True)],
        "suggestion": suggestion_text,
        "valuationWarnings": valuation_warnings
    }
    
    output_path = os.path.join(db_dir, "portfolio_optimization.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
        
    print(f"\nOptimization data saved to {output_path}")

if __name__ == "__main__":
    analyze_portfolio()
