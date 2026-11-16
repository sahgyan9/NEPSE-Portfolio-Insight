import json
import os
import sys
import math
import subprocess
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402
import portfolio_risk  # noqa: E402

normalize_sector = pc.normalize_sector
load_json = pc.load_json

# Sectors licensed by Nepal Rastra Bank, where the 51% promoter-group rule applies (see the promoter check).
NRB_PROMOTER_RULE_SECTORS = ("Commercial Bank", "Development Bank", "Finance", "Microfinance")


def get_sector_averages(fundamentals_data, db_dir=None):
    """Typical (median) P/E and P/B per sector. Medians are used because a few loss-recovery
    companies with P/E in the hundreds otherwise distort a sector mean."""
    return {sector: {"pe": m["pe"], "pb": m["pb"]}
            for sector, m in pc.sector_medians(fundamentals_data).items() if m["pe"]}


def first_value(mapping, *keys):
    """First key present with a non-null value (0 is a real value, unlike with `or`)."""
    for key in keys:
        if mapping.get(key) is not None:
            return mapping[key]
    return None


def plausible_percent(value, ceiling):
    """Guard against a known scraper fault: some quarterly reports lose the decimal point
    (CAR 11.12 stored as 1112). A value above `ceiling` is rescaled by 100 when that lands
    in range, otherwise treated as unknown rather than raising a false alarm."""
    if not isinstance(value, (int, float)):
        return None
    if value <= ceiling:
        return float(value)
    if value / 100.0 <= ceiling:
        return value / 100.0
    return None


def score_between(value, best, worst):
    """Linear 100..0 score: `best` or better scores 100, `worst` or beyond scores 0."""
    if best == worst:
        return 100.0
    return max(0.0, min(100.0, 100.0 * (worst - value) / (worst - best)))


def calculate_health():
    db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db")
    portfolio_data = load_json(os.path.join(db_dir, "portfolio.json"))
    fundamentals_data = load_json(os.path.join(db_dir, "fundamentals.json")) or {}
    manual_dividends = load_json(os.path.join(db_dir, "manual_dividends.json")) or {"entries": []}
    sector_averages = get_sector_averages(fundamentals_data, db_dir)
    
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
        
        # Current price: last traded close on file, then scraped LTP/NAV, then cost.
        fund = fundamentals_data.get(sym, {})
        price, _price_source = pc.current_price(sym, avg_cost, fundamentals_data)
        if not price:
            price = avg_cost

        current_value = qty * price
        total_value += current_value
        
        normalized_sector = pc.resolve_sector(sym, fundamentals_data)

        holdings_processed.append({
            "symbol": sym,
            "quantity": qty,
            "avgCost": avg_cost,
            "currentPrice": price,
            "currentValue": current_value,
            "sector": normalized_sector
        })
        
    if total_value == 0:
        total_value = sum(h["currentValue"] for h in holdings_processed) or 1.0

    # Populate weights
    for h in holdings_processed:
        h["weight"] = h["currentValue"] / total_value

    # Every sentence is stored as {code, params, text}: `text` is the English sentence, `params`
    # holds the raw values so the app can build the same sentence in Nepali from the
    # `health.<code>` templates (src/lib/healthText.ts). Percentages are percent numbers
    # (23.4 = 23.4%). The old plain-string lists are still written for older readers.
    strength_items = []
    warning_items = []
    recommendation_items = []

    def strength(code, params, text):
        strength_items.append({"code": code, "params": params, "text": text})

    def warn(code, params, text):
        warning_items.append({"code": code, "params": params, "text": text})

    def recommend(code, params, text):
        recommendation_items.append({"code": code, "params": params, "text": text})

    # ---------------------------------------------------------
    # Pillar 1: Structure & Diversification (20% weight)
    # ---------------------------------------------------------
    sector_weights = {}
    for h in holdings_processed:
        sector_weights[h["sector"]] = sector_weights.get(h["sector"], 0.0) + h["weight"]
        
    hhi = sum(w**2 for w in sector_weights.values())
    effective_sectors = 1.0 / hhi if hhi > 0 else 1.0
    diversification_score = round(score_between(effective_sectors, 6.0, 1.0))

    # Single-company concentration: mutual funds are excluded because a fund is itself
    # a diversified basket (e.g. an open-ended fund bought by SIP).
    single_names = [h for h in holdings_processed if h["sector"] != "Mutual Fund"]
    max_weight = max((h["weight"] for h in single_names), default=0)
    concentration_score = 100
    if max_weight > 0.25:
        penalty = (max_weight - 0.25) * 200
        concentration_score = max(0, min(100, round(100 - penalty)))
        max_stock = next((h["symbol"] for h in single_names if h["weight"] == max_weight), "Unknown")
        target_allocation = 0.20
        excess_weight = max_weight - target_allocation
        trim_value = total_value * excess_weight
        max_stock_entry = next((h for h in holdings_processed if h["symbol"] == max_stock), None)
        if max_stock_entry:
            qty_to_trim = int(trim_value / max_stock_entry["currentPrice"]) if max_stock_entry["currentPrice"] > 0 else 0
            warn("w_concentration",
                 {"symbol": max_stock, "weightPct": round(max_weight * 100, 1), "limitPct": 25.0},
                 f"Concentration risk: {max_stock} represents {max_weight*100:.1f}% of your portfolio (limit: 25.0%). "
                 f"Having too much capital in a single stock exposes your entire portfolio to extreme downside risk if that company underperforms.")
            recommend("r_concentration",
                      {"symbol": max_stock, "shares": qty_to_trim, "amount": round(trim_value, 2),
                       "targetPct": round(target_allocation * 100)},
                      f"{max_stock} is about {qty_to_trim:,} shares (approx. Rs. {trim_value:,.2f}) above a {target_allocation*100:.0f}% share of your portfolio. Check whether you are comfortable with that much in one company.")
    else:
        strength("s_concentration_ok", {"limitPct": 25.0},
                 "Concentration risk is well-managed with no holding exceeding 25% weight.")

    if len(sector_weights) >= 5:
        strength("s_sectors_spread", {"sectors": len(sector_weights)},
                 f"Good sector diversification across {len(sector_weights)} sectors.")
    elif len(sector_weights) <= 2:
        warn("w_few_sectors", {"sectors": len(sector_weights)},
             "Low sector diversification. Highly vulnerable to sector-specific shocks.")
        recommend("r_few_sectors", {"sectors": len(sector_weights)},
                  "Most of your money is in few sectors. A portfolio spread across more sectors is less exposed to one sector's bad news.")

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
            print(f"[Health Algorithm] Missing quarterly data for {sym}. Using defaults.")
        
        q_data = load_json(q_path)
        latest_q = q_data["quarters"][-1] if q_data and q_data.get("quarters") and len(q_data["quarters"]) > 0 else None
        
        scrip_score = 70.0 # default baseline
        
        if latest_q:
            raw = latest_q.get("raw", {})
            computed = latest_q.get("computed", {})
            
            if sector in ["Commercial Bank", "Microfinance"]:
                # CAR Score
                car = raw.get("CAR")
                if car is None:
                    # try fallback key lowercase
                    car = first_value(raw, "car") or computed.get("car")
                car = plausible_percent(car, 60.0)
                
                car_score = 50.0
                if car is not None:
                    min_car = 11.0 if sector == "Commercial Bank" else 8.0
                    exc_car = 14.0 if sector == "Commercial Bank" else 15.0
                    
                    # min_car equals the NRB minimum (checked 2026-11-15):
                    # - commercial banks 11% (minimum total capital ratio plus conservation buffer),
                    #   NRB Unified Directive 2082 for class A/B/C, Directive 1 and the Capital Adequacy
                    #   Framework, https://www.nrb.org.np/contents/uploads/2026/01/Unified-Directive-ABC-2082.pdf
                    # - microfinance 8% total capital fund (core capital 4%), NRB Unified Directive 2082
                    #   for class D, Directive 1(1), https://www.nrb.org.np/contents/uploads/2026/01/MFI-Unified-Directive-2082.pdf
                    # exc_car is this tool's own line for a comfortable cushion.
                    if car < min_car:
                        car_score = 0.0
                        warn("w_car_low", {"symbol": sym, "carPct": round(car, 2), "sector": sector, "thresholdPct": min_car},
                             f"Capital Adequacy Alert: {sym} has a capital adequacy ratio (CAR) of {car:.2f}%, below the {min_car:.0f}% minimum "
                             f"that Nepal Rastra Bank sets for a {sector}. A bank or microfinance below the minimum can be stopped from paying dividends.")
                        recommend("r_car_low", {"symbol": sym, "carPct": round(car, 2)},
                                  f"{sym}'s CAR is {car:.2f}%. Check the next quarterly reports to see whether it is rising, "
                                  f"and look for any Nepal Rastra Bank notice about {sym}'s capital.")
                    elif car >= exc_car:
                        car_score = 100.0
                    else:
                        car_score = 80.0
                
                # CD Ratio Score
                cd = plausible_percent(first_value(raw, "Credit To Deposit Ratio", "CD ratio", "CD Ratio", "cd_ratio"), 200.0)
                cd_score = 70.0
                if cd is not None:
                    if sector == "Commercial Bank":
                        if 80.0 <= cd <= 85.0: cd_score = 100.0
                        elif 75.0 <= cd <= 88.0: cd_score = 85.0
                        elif cd > 90.0:
                            cd_score = 30.0
                            # 90% is the NRB ceiling for class A/B/C (checked 2026-11-15): NRB Unified
                            # Directive 2082, Directive 5, clause 6(6) ("CD Ratio ... maximum limit 90 percent"),
                            # https://www.nrb.org.np/contents/uploads/2026/01/Unified-Directive-ABC-2082.pdf
                            warn("w_cd_high_bank", {"symbol": sym, "cdPct": round(cd, 2)},
                                 f"Liquidity Strain Warning: {sym} has lent out {cd:.2f}% of its deposits (CD ratio), which is very high. "
                                 f"As of November 2026, Nepal Rastra Bank caps this ratio at 90% for banks. A bank at or above the cap has little room "
                                 f"to give new loans, which can squeeze interest income.")
                            recommend("r_cd_high_bank", {"symbol": sym, "cdPct": round(cd, 2)},
                                      f"{sym}'s CD ratio is {cd:.2f}%. A bank that has lent out almost all its deposits has less room to grow its loans. "
                                      f"Check how this ratio moves in the next quarterly reports.")
                    else:  # Microfinance
                        # 125% is this tool's own line, not a rule. NRB sets no CD ratio ceiling for
                        # microfinance. Its limit is on total funds raised (savings, deposits, borrowing
                        # and debentures together): at most 30 times core capital, NRB Unified Directive
                        # 2082 for class D, Directive 15(1)(a), checked 2026-11-15,
                        # https://www.nrb.org.np/contents/uploads/2026/01/MFI-Unified-Directive-2082.pdf
                        # The sentence below therefore states no number.
                        if 90.0 <= cd <= 115.0: cd_score = 100.0
                        elif 85.0 <= cd <= 125.0: cd_score = 80.0
                        elif cd > 125.0:
                            cd_score = 40.0
                            warn("w_cd_high_mfi", {"symbol": sym, "cdPct": round(cd, 2)},
                                 f"Microfinance Leverage Warning: {sym} CD ratio is {cd:.2f}%, which is high for a microfinance. "
                                 f"It means {sym} lends much more than it collects in deposits and depends on loans from banks.")
                            recommend("r_cd_high_mfi", {"symbol": sym},
                                      f"Check {sym}'s cost of funds (COF) in the quarterly report. Money borrowed from banks costs more, and that cost cuts into profit.")
                
                # Cost of Funds (COF) Score
                cof = plausible_percent(first_value(raw, "Cost of funds", "Cost of Funds", "cost_of_funds"), 25.0)
                cof_score = 70.0
                if cof is not None:
                    if cof < 6.5: cof_score = 100.0
                    elif cof < 7.5: cof_score = 85.0
                    elif cof > 9.5:
                        cof_score = 30.0
                        warn("w_cof_high", {"symbol": sym, "cofPct": round(cof, 2)},
                             f"Margin Squeeze: {sym} Cost of Funds is very high at {cof:.2f}%.")
                
                # NPL Score
                npl = plausible_percent(first_value(raw, "NPL", "npl"), 40.0)
                npl_score = 70.0
                if npl is not None:
                    if npl < 1.5: npl_score = 100.0
                    elif npl <= 3.0: npl_score = 80.0
                    elif npl > 5.0:
                        npl_score = 20.0
                        # 5% is this tool's own alert line, not a regulatory figure.
                        warn("w_npl_high", {"symbol": sym, "nplPct": round(npl, 2), "thresholdPct": 5.0},
                             f"Asset Quality Alert: {sym} NPL ratio ({npl:.2f}%) is above the 5.0% level this tool treats as high. "
                             f"High NPLs require heavy provision charges which severely reduce net income and dividend capacity.")
                        recommend("r_npl_high", {"symbol": sym},
                                  f"Check in {sym}'s quarterly report how much of its bad loans is already covered by provisions (money set aside for losses).")
                
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
                        warn("w_de_high", {"symbol": sym, "de": round(de, 2), "limit": 2.0},
                             f"High Balance Sheet Leverage: {sym} Debt-to-Equity is {de:.2f} (this tool's comfort line: below 2.0). "
                             f"Hydropower projects with excessive debt carry high fixed interest expenses that eat profits in dry seasons.")
                        recommend("r_de_high", {"symbol": sym},
                                  "Hydropower companies with heavy debt lose more of their income to interest. Check the debt level in the latest quarterly report.")
                
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

        # Check promoter holdings and average volume if available in fundamentals.json
        fund = fundamentals_data.get(sym, {})
        promoter_holding = fund.get("promoterHolding") or None  # 0 means "not captured"
        avg_volume_120d = fund.get("avgVolume120d")
        
        # 1. Promoter holding check
        if promoter_holding is not None:
            min_promoter = 51.0 if sector in ["Commercial Bank", "Development Bank", "Life Insurance", "Non-Life Insurance"] else 30.0
            # min_promoter is this tool's scoring line. Rule checked 2026-11-15: for NRB-licensed
            # banks, finance companies and microfinance, promoter shares may be turned into public
            # shares only while the promoter group keeps at least 51% (NRB Unified Directive 2082,
            # Directive 9 for class A/B/C and the class D directive, under BAFIA 2073 s. 11(4);
            # https://www.nrb.org.np/contents/uploads/2026/01/Unified-Directive-ABC-2082.pdf and
            # https://www.nrb.org.np/contents/uploads/2026/01/MFI-Unified-Directive-2082.pdf).
            # The 51% line for insurers was not verified, so their sentence states no minimum.
            # Note: Finance and Microfinance fall under the 51% rule but this check uses 30% for them.
            if promoter_holding < min_promoter:
                warn("w_promoter_low", {"symbol": sym, "promoterPct": round(promoter_holding, 1)},
                     f"Low Promoter Shareholding: {sym} promoter holding is {promoter_holding:.1f}%, "
                     f"low for its sector. When promoters own less, they have less of their own money at stake "
                     f"in how the company is run.")
                if sector in NRB_PROMOTER_RULE_SECTORS:
                    recommend("r_promoter_low_bfi", {"symbol": sym},
                              f"Nepal Rastra Bank lets promoters of banks, finance companies and microfinance turn their shares "
                              f"into public shares only while the promoter group keeps at least 51%. Check {sym}'s notices to see "
                              f"why the promoter share is lower, and whether management has changed recently.")
                else:
                    recommend("r_promoter_low", {"symbol": sym},
                              f"Check {sym}'s notices to see whether promoters have reduced their stake, and whether management has changed recently.")
                scrip_score = max(0.0, scrip_score - 15.0)

        # 2. Liquidity check
        if avg_volume_120d is not None:
            if avg_volume_120d < 5000:
                warn("w_liquidity_low", {"symbol": sym, "avgVolume": int(avg_volume_120d)},
                     f"Low Liquidity alert: {sym} has an average 120-day volume of {int(avg_volume_120d):,} shares. "
                     f"Illiquid counters suffer from high slippage, making it hard to exit large positions quickly.")
                recommend("r_liquidity_low", {"symbol": sym, "avgVolume": int(avg_volume_120d)},
                          f"Only about {int(avg_volume_120d):,} {sym} shares trade on a normal day. Check the daily volume before a large order: "
                          f"it can take days to fill, and the price can move while it does.")
                scrip_score = max(0.0, scrip_score - 10.0)

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
        strength("s_fundamentals_strong", {"score": fundamentals_score},
                 "The portfolio is anchored by highly profitable and capital-efficient businesses.")

    # ---------------------------------------------------------
    # Pillar 3: Valuation Margin of Safety (20% weight)
    # ---------------------------------------------------------
    valuation_scores = []
    valuation_weights = []

    for h in holdings_processed:
        sym = h["symbol"]
        weight = h["weight"]
        if h["sector"] == "Mutual Fund":
            continue  # a fund has no P/E; judging it on one would only add noise
        fund = fundamentals_data.get(sym, {})

        pe = fund.get("peRatio")
        pb = fund.get("pbRatio")
        if pe == 0: pe = None  # scrapers write 0 for "not available"
        if pb == 0: pb = None

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
            if pb < 0: pb_score = 20
            elif pb < 1.2: pb_score = 100
            elif pb <= 2.2: pb_score = 80
            elif pb <= 3.5: pb_score = 60
            elif pb <= 5.0: pb_score = 40
            else: pb_score = 20
            
        # PEG Score (PE / YoY profit growth)
        # Fetch growth from quarterly
        q_path = os.path.join(db_dir, "quarterly", f"{sym}.json")
        q_data = load_json(q_path)
        latest_q = q_data["quarters"][-1] if q_data and q_data.get("quarters") else None
        growth = None
        if latest_q:
            yoy = latest_q.get("yoy", {})
            growth = yoy.get("net_profit_ttm")
            if growth is None:
                growth = yoy.get("Net Profit")

        # Unknown growth stays neutral; only a reported profit decline is penalised.
        peg_score = 60
        if growth is not None and growth <= 0:
            peg_score = 20
        elif growth is not None and pe and pe > 0:
            peg = pe / growth
            if peg < 1.0: peg_score = 100
            elif peg <= 1.5: peg_score = 80
            elif peg <= 2.5: peg_score = 50
            else: peg_score = 20

        scrip_val_score = 0.40 * pe_score + 0.30 * pb_score + 0.30 * peg_score
            
        # Relative Valuation premium check
        sect_avg = sector_averages.get(h["sector"])
        if sect_avg and pe is not None and pe > 0:
            avg_pe = sect_avg.get("pe")
            if avg_pe and pe > 1.5 * avg_pe:
                warn("w_pe_premium",
                     {"symbol": sym, "pe": round(pe, 1), "sectorPe": round(avg_pe, 1), "sector": h["sector"]},
                     f"Relative Overvaluation Warning: {sym} P/E ({pe:.1f}) is more than 50% higher than its sector median P/E ({avg_pe:.1f}). "
                     f"Paying an extreme premium relative to industry peers decreases your safety margin.")
                recommend("r_pe_premium", {"symbol": sym, "sector": h["sector"]},
                          f"Check why {sym} is priced above its peers in the {h['sector']} sector, and whether its earnings support that price.")
                scrip_val_score = max(0.0, scrip_val_score - 15.0)

        valuation_scores.append(scrip_val_score)
        valuation_weights.append(weight)

    if valuation_weights and sum(valuation_weights) > 0:
        valuation_score = round(sum(v * w for v, w in zip(valuation_scores, valuation_weights)) / sum(valuation_weights))
    else:
        valuation_score = 60

    if valuation_score >= 75:
        strength("s_valuation_reasonable", {"score": valuation_score},
                 "High Margin of Safety: Portfolio is priced reasonably relative to its earnings power.")
    elif valuation_score < 50:
        warn("w_valuation_high", {"score": valuation_score},
             "Valuation warning: Portfolio components are trading at premium multiples relative to earnings.")
        recommend("r_valuation_high", {"score": valuation_score},
                  "Some holdings are priced very high compared with their earnings and book value. Prices like that fall harder when results disappoint.")

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
                warn("w_bonus_low_roe", {"symbol": sym, "roePct": round(roe, 1)},
                     f"Compounding Drag: {sym} has low ROE ({roe:.1f}%) but issues bonus shares, causing capital dilution.")
                recommend("r_bonus_low_roe", {"symbol": sym, "roePct": round(roe, 1)},
                          f"{sym} earns {roe:.1f}% on its shareholders' money but still issues bonus shares. Bonus shares raise the share count; "
                          f"check whether profit grows fast enough to keep EPS from falling.")
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
        strength("s_high_yield", {"yieldPct": round(total_yield, 2)},
                 f"High income potential: Portfolio is yielding {total_yield:.2f}% in cash flow.")

    # ---------------------------------------------------------
    # Pillar 5: Market Risk & Volatility (20% weight)
    # ---------------------------------------------------------
    # Measured from price history (tools/portfolio_risk.py): how much the portfolio swings
    # compared with the market, and the deepest fall the current mix would have taken.
    risk_summary = None
    volatility_score = 60  # neutral when no price history is available
    try:
        risk = portfolio_risk.analyze(portfolio_data, fundamentals_data)
    except Exception as exc:  # the health score must still be produced without it
        print(f"[Health Algorithm] Risk engine unavailable: {exc}")
        risk = {"error": str(exc)}
    if "error" not in risk:
        rp = risk["portfolio"]
        ratio = rp.get("volatilityVsMarket")
        vol_score = score_between(ratio, 0.6, 1.6) if ratio is not None else 60.0
        drawdown_score = score_between(rp["maxDrawdown"], 0.10, 0.50)
        volatility_score = round(vol_score * 0.6 + drawdown_score * 0.4)
        risk_summary = {
            "volatility": rp["volatility"], "marketVolatility": risk["market"]["volatility"],
            "volatilityVsMarket": ratio, "beta": rp["beta"], "maxDrawdown": rp["maxDrawdown"],
            "weeklyVar95": rp["weeklyVar95"], "riskLevel": risk["riskLevel"],
            "measuredWeight": risk["coverage"]["measuredWeight"],
        }
        for finding in risk["findings"]:
            if finding["severity"] in ("high", "medium") and finding["code"] != "concentration":
                # The finding already carries its own code and params (portfolio_risk.py);
                # the app rebuilds it with src/lib/findingText.ts.
                warn("w_risk_finding",
                     {"finding": {"code": finding["code"], "params": finding.get("params") or {},
                                  "title": finding["title"], "detail": finding["detail"]}},
                     f"{finding['title']}. {finding['detail']}")
        if ratio is not None and ratio <= 0.9:
            strength("s_low_volatility", {"ratio": round(ratio, 2)},
                     f"The portfolio swings less than the market (about {ratio:.1f}x market volatility).")

    history = portfolio_data.get("valueHistory", [])
    if history:
        vals = [pt["value"] for pt in history if pt.get("value", 0) > 0]
        invested = [pt["invested"] for pt in history if pt.get("invested", 0) > 0]
        if vals and invested and vals[-1] < invested[-1]:
            loss_pct = (invested[-1] - vals[-1]) / invested[-1] * 100
            warn("w_below_cost", {"lossPct": round(loss_pct, 1)},
                 f"Current portfolio value is resting at {loss_pct:.1f}% below total invested cost.")

    # ---------------------------------------------------------
    # Very large single holding (margin lending limits)
    # ---------------------------------------------------------
    # Rs. 25 crore is this tool's trigger only, kept from the old per-borrower cap. Checked
    # 2026-11-15, Nepal Rastra Bank no longer sets a fixed amount per borrower:
    # - NRB Unified Directive 2082 for class A/B/C (Magh 2082), Directive 2, clause 17(ka): no
    #   per-borrower amount; total margin loans of a bank at most 40% of its core capital (17(ka)(7)),
    #   https://www.nrb.org.np/contents/uploads/2026/01/Unified-Directive-ABC-2082.pdf
    #   (the Rs. 25 crore single-borrower cap was removed by an NRB circular of 8 October 2025,
    #   reported by ShareSansar the same day; that circular itself was not opened).
    # - NRB circular ref. BFRD/Policy/Circular/19/082/83 dated 2083/03/31 (15 July 2026), amending
    #   clause 17(ka)(2): loan at most 70% of the lower of the 180-day average closing price and
    #   the market price, up to 10 points more for shares of companies the bank rates as strong,
    #   https://www.nrb.org.np/category/circulars/ (page 2, "Circular No. 19 (ka, kha, ga) 2082/83").
    # - Monetary Policy 2083/84, para 20: share-loan limits to be set by each institution's strength,
    #   https://www.nrb.org.np/category/monetary-policy/
    # The owner may want to retire this warning, since no regulatory cap now sits behind it.
    LARGE_HOLDING_NPR = 250000000.0
    for h in holdings_processed:
        if h["currentValue"] > LARGE_HOLDING_NPR:
            warn("w_margin_cap", {"symbol": h["symbol"], "value": round(h["currentValue"], 2)},
                 f"Very Large Holding: Your holding in {h['symbol']} is worth Rs. {h['currentValue']:,.2f}. "
                 f"As of November 2026, Nepal Rastra Bank sets no fixed limit on how much one person can borrow against shares (margin loan). "
                 f"A bank lends at most 70% of the shares' value (80% for shares of companies it rates as strong), and each bank sets its own limits.")
            recommend("r_margin_cap", {"symbol": h["symbol"]},
                      f"If you borrow against your {h['symbol']} shares, ask your bank how much it lends against them. "
                      f"If the price falls, the bank can ask you for more collateral or sell the shares.")

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

    # 4. Generate Text Summary: built from parts so the app can show each part in Nepali.
    summary_items = []

    def summary(code, params, text):
        summary_items.append({"code": code, "params": params, "text": text})

    summary("sum_grade", {"grade": grade, "score": overall_score},
            f"Your portfolio is graded '{grade}' with an overall health score of {overall_score}/100.")
    if overall_score >= 80:
        summary("sum_level_high", {"score": overall_score},
                "This indicates excellent balance sheet strength, strong profitability, and conservative valuations.")
    elif overall_score >= 60:
        summary("sum_level_mid", {"score": overall_score},
                "This indicates moderate health. Your portfolio is diversified but contains some elevated leverage or valuation risks that warrant closer monitoring.")
    else:
        summary("sum_level_low", {"score": overall_score},
                "This indicates high risk. Several core holdings show weak capital adequacy, poor asset quality, or extreme concentration.")

    summary("sum_structure", {"score": structure_score},
            f"The portfolio's structure scores {structure_score}/100 in diversification.")
    if max_weight > 0.25:
        summary("sum_concentrated", {"symbol": max_stock, "weightPct": round(max_weight * 100, 1)},
                f"The primary structural issue is high concentration in {max_stock} ({max_weight*100:.1f}%).")
    else:
        summary("sum_concentration_ok", {},
                "Your stock concentration is well balanced.")

    # Which fundamentals problems were found, read from the warning codes.
    codes = {w["code"] for w in warning_items}
    bank_issue = bool(codes & {"w_car_low", "w_npl_high"})
    hydro_issue = "w_de_high" in codes
    if bank_issue and hydro_issue:
        summary("sum_fund_bank_hydro", {"score": fundamentals_score},
                f"Financial fundamentals score {fundamentals_score}/100, reflecting capital adequacy (CAR) limits in your banks and high debt levels in your hydropower holdings.")
    elif bank_issue:
        summary("sum_fund_bank", {"score": fundamentals_score},
                f"Financial fundamentals score {fundamentals_score}/100, reflecting capital adequacy (CAR) or bad loan issues in your banking holdings.")
    elif hydro_issue:
        summary("sum_fund_hydro", {"score": fundamentals_score},
                f"Financial fundamentals score {fundamentals_score}/100, reflecting high debt loads in your hydropower holdings.")
    else:
        summary("sum_fund_clean", {"score": fundamentals_score},
                f"Financial fundamentals score {fundamentals_score}/100, reflecting healthy earnings and clean balance sheets across all major holdings.")
    text_summary = " ".join(s["text"] for s in summary_items)

    # Build response structure
    result = {
        "overallScore": overall_score,
        "grade": grade,
        "textSummary": text_summary,
        "pillars": {
            "structure": {
                "id": "structure",
                "name": "Diversification & Structure",
                "score": structure_score,
                "description": "Measures sector weight balance and concentration limits."
            },
            "fundamentals": {
                "id": "fundamentals",
                "name": "Financial Fundamentals",
                "score": fundamentals_score,
                "description": "Sector-aware banking metrics (CAR, CD, COF) and hydropower leverage analysis."
            },
            "valuation": {
                "id": "valuation",
                "name": "Margin of Safety",
                "score": valuation_score,
                "description": "Portfolio pricing relative to book value, earnings, and PEG growth metrics."
            },
            "dividend": {
                "id": "dividend",
                "name": "Dividend & Compounding",
                "score": dividend_score,
                "description": "Cash flow yield and ROE-to-retention alignment."
            },
            "volatility": {
                "id": "volatility",
                "name": "Market Risk & Drawdown",
                "score": volatility_score,
                "description": "Measured price swings against the market and the deepest historical fall of the current mix."
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
        "risk": risk_summary,
        # Plain English lists, unchanged in shape for older readers.
        "strengths": [s["text"] for s in strength_items],
        "warnings": [w["text"] for w in warning_items],
        "recommendations": [r["text"] for r in recommendation_items],
        # Same sentences with code and params, for the app to show in the reader's language.
        "strengthItems": strength_items,
        "warningItems": warning_items,
        "recommendationItems": recommendation_items,
        "summaryItems": summary_items,
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
