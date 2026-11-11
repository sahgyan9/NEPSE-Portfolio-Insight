"""
Portfolio analysis for the Intelligence page.

Runs the measured risk engine (tools/portfolio_risk.py) and a sector-relative valuation
check, then writes db/portfolio_optimization.json. The file keeps the original top-level
keys (totalValue, holdingCount, volatilityScore, sectorExposure, suggestion,
valuationWarnings) so existing screens keep working, and adds the full report under "risk".

Earlier versions used a fixed volatility guess per sector and weighted holdings at cost.
Both are replaced: volatility is measured from price history and weights use current prices.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402
import portfolio_risk  # noqa: E402

# Kept for callers that imported these from here.
SYMBOL_SECTOR = pc.SYMBOL_SECTOR
normalize_sector = pc.normalize_sector
load_json = pc.load_json

OUTPUT_PATH = os.path.join(pc.DB_DIR, "portfolio_optimization.json")


def valuation_checks(holdings, fundamentals):
    """Compare each holding's P/E with the median of its own sector.

    A bank at P/E 18 and a hydropower company at P/E 18 are not equally priced, so a single
    cut-off for every sector misleads. Loss-making companies are flagged separately because
    a negative P/E has no meaning."""
    medians = pc.sector_medians(fundamentals)
    out = []
    for h in holdings:
        sym = h["symbol"].upper()
        fund = fundamentals.get(sym) or {}
        sector = pc.resolve_sector(sym, fundamentals)
        if sector == "Mutual Fund":
            continue
        pe, eps = fund.get("peRatio"), fund.get("eps")
        median_pe = (medians.get(sector) or {}).get("pe")
        if isinstance(eps, (int, float)) and eps < 0:
            out.append({"symbol": sym, "type": "LOSS_MAKING", "pe": pe, "sectorMedianPe": median_pe,
                        "message": f"{sym} reported a loss (EPS {eps:.2f}). Price is not supported by current earnings."})
            continue
        if not isinstance(pe, (int, float)) or pe <= 0 or not median_pe:
            continue
        ratio = pe / median_pe
        if ratio >= 1.5:
            out.append({"symbol": sym, "type": "OVERVALUED", "pe": pe, "sectorMedianPe": round(median_pe, 1),
                        "message": f"{sym} trades at P/E {pe:.1f}, {ratio:.1f}x the {sector} median of {median_pe:.1f}. "
                                   "The price assumes faster profit growth than its peers."})
        elif ratio <= 0.7:
            out.append({"symbol": sym, "type": "UNDERVALUED", "pe": pe, "sectorMedianPe": round(median_pe, 1),
                        "message": f"{sym} trades at P/E {pe:.1f}, below the {sector} median of {median_pe:.1f}. "
                                   "Cheap against peers; check whether profits are expected to fall."})
    return out


def analyze_portfolio():
    portfolio = pc.load_json(os.path.join(pc.DB_DIR, "portfolio.json"))
    fundamentals = pc.load_json(os.path.join(pc.DB_DIR, "fundamentals.json")) or {}
    if not portfolio or not portfolio.get("holdings"):
        print("No holdings found in portfolio.json.")
        return None

    risk = portfolio_risk.analyze(portfolio, fundamentals)
    if "error" in risk:
        print(risk["error"])
        return None
    with open(portfolio_risk.OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(risk, f, indent=2)

    p = risk["portfolio"]
    top = [f for f in risk["findings"] if f["severity"] in ("high", "medium")][:2]
    suggestion = (
        f"Risk is {risk['riskLevel'].lower()}: estimated yearly swing {p['volatility'] * 100:.0f}% "
        f"against {risk['market']['volatility'] * 100:.0f}% for the market. "
    )
    suggestion += " ".join(f"{f['title']}." for f in top) if top else "No concentration problems found."

    output = {
        "totalValue": p["value"],
        "holdingCount": p["holdingCount"],
        "volatilityScore": p["volatility"],
        "sectorExposure": [{"sector": s["sector"], "weight": s["weight"], "riskShare": s["riskShare"]}
                           for s in risk["sectors"]],
        "suggestion": suggestion,
        "valuationWarnings": valuation_checks(portfolio["holdings"], fundamentals),
        "risk": risk,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Analysed {p['holdingCount']} holdings worth Rs. {p['value']:,.0f}")
    print(suggestion)
    for w in output["valuationWarnings"]:
        print(f"  - {w['message']}")
    print(f"Saved to {OUTPUT_PATH}")
    return output


if __name__ == "__main__":
    analyze_portfolio()
