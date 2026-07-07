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
    "Commercial Banks": 0.15,
    "Development Banks": 0.20,
    "Life Insurance": 0.22,
    "Non Life Insurance": 0.25,
    "Microfinance": 0.35,
    "Hydropower": 0.40,
    "Finance": 0.30,
    "Manufacturing And Processing": 0.18,
    "Hotels And Tourism": 0.38,
    "Investment": 0.25,
    "Trading": 0.30,
    "Others": 0.25
}

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
        
        # Get sector from fundamentals if available
        fund = fundamentals.get(sym, {})
        # For this heuristic, if sector isn't in fundamental, we'll try to guess or use Others
        # NepseAlpha usually doesn't give sector in our raw fundamental pull, so we might need to fallback.
        # Let's just assign a default volatility if unknown, but we can look for "sector" key.
        sector = fund.get("sector", "Others")
        if sector not in SECTOR_VOLATILITY:
            # Map common abbreviations
            if "bank" in sector.lower(): vol = 0.15
            elif "hydro" in sector.lower(): vol = 0.40
            elif "micro" in sector.lower(): vol = 0.35
            else: vol = 0.25
        else:
            vol = SECTOR_VOLATILITY[sector]
            
        sector_exposure[sector] = sector_exposure.get(sector, 0) + weight
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
