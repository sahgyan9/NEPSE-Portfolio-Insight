import os
import sys
import re
import json
import argparse
from datetime import datetime

# Add the parent directory to sys.path so we can import quarterly_db
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import quarterly_db

def _clean_number(val_str):
    if not val_str or val_str.strip() == "-" or val_str.strip() == "":
        return None
    val_str = val_str.replace(",", "").replace("%", "").replace("Cr.", "").strip()
    try:
        return float(val_str)
    except ValueError:
        return None

def parse_financials_md(md_path):
    """Parses the LLM extracted financials table into a dict keyed by FY-Q"""
    if not os.path.exists(md_path):
        return {}, [], {}  # fixed: was returning bare {} which broke 3-tuple unpack
        
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.splitlines()
    table_lines = [l for l in lines if l.startswith('|')]
    if len(table_lines) < 2:
        return {}, [], {}

    # Parse header
    headers = [col.strip() for col in table_lines[0].split('|')[1:-1]]
    
    # Map column index to FY-Q key
    col_to_key = {}
    for i, h in enumerate(headers):
        m = re.match(r'.*?(\d{3})-(\d{3})Q(\d).*?', h)
        if m:
            fy = f"20{m.group(1)[1:]}-{m.group(2)[1:]}"
            q = int(m.group(3))
            col_to_key[i] = f"{fy}-Q{q}"

    if not col_to_key:
        return {}, [], {}

    financials_data = {key: {} for key in col_to_key.values()}
    ordered_keys = []
    bs_yoy = {}
    
    yoy_col_idx = -1
    for i, h in enumerate(headers):
        if "yoy" in h.lower():
            yoy_col_idx = i
            break

    for line in table_lines[2:]:
        cols = [col.strip() for col in line.split('|')[1:-1]]
        if not cols:
            continue
            
        row_label = cols[0]
        schema_key = row_label
        
        if schema_key not in ordered_keys:
            ordered_keys.append(schema_key)
            
        if yoy_col_idx != -1 and yoy_col_idx < len(cols):
            yoy_val = _clean_number(cols[yoy_col_idx])
            if yoy_val is not None:
                bs_yoy[schema_key] = yoy_val

        for i, val_col in enumerate(cols):
            if i in col_to_key:
                key = col_to_key[i]
                val = _clean_number(val_col)
                if val is not None:
                    lower_key = schema_key.lower()
                    if "%" in val_col or "eps" in lower_key or "book value" in lower_key or "shares" in lower_key or "npl" in lower_key or "rate" in lower_key or "ratio" in lower_key or "car" in lower_key or "spread" in lower_key or "yield" in lower_key:
                        financials_data[key][schema_key] = val
                    else:
                        # Values in this table are typically in "000'" (thousands)
                        # We need to convert them to raw NRs (multiply by 1000)
                        financials_data[key][schema_key] = val * 1000

    return financials_data, ordered_keys, bs_yoy


def _parse_from_financials_only(fundamentals_md_path, symbol):
    """
    Fallback for stocks where the broker-widget page doesn't render a quarterly
    table (e.g. microfinance, development banks like CBBL).

    All the data we need — EPS, BVPS, ROE, Net Profit, Revenue — is already
    present in the LLM-extracted _financials.md. We map those rows directly
    to the 'computed' schema instead of needing the broker-widget table.
    """
    fin_path = fundamentals_md_path.replace("_fundamentals.md", "_financials.md")
    financials_data, ordered_keys, bs_yoy = parse_financials_md(fin_path)

    if not financials_data:
        print(f"Error: No financials data found for {symbol} in fallback either.")
        return []

    # Map from financials row labels -> computed schema keys
    # These rows appear in the financials LLM table for banks/microfinance
    raw_to_computed = {
        "EPS Reported":       "eps_ttm",
        "Book Value Reported": "bvps",
        "ROE Reported":       "roe_ttm",
        "Net Profit":         "net_profit_ttm",
        "Interest Income":    "revenue_ttm",
        "Total Operating Income": "revenue_ttm",  # manufacturing fallback
    }

    # Rebuild quarter metadata from the keys (format: "2082-83-Q3")
    quarter_meta = {}
    for key in financials_data:
        parts = key.rsplit('-Q', 1)
        if len(parts) == 2:
            fy = parts[0]          # e.g. "2082-83"
            q  = int(parts[1])     # e.g. 3
            short_fy = fy[2:]      # e.g. "82-83"
            quarter_meta[key] = {
                "fy": fy,
                "quarter": q,
                "quarter_label": f"Q{q} {short_fy}",
            }

    # Extract computed values from the raw financials rows
    computed_by_key = {k: {} for k in financials_data}
    for raw_row, computed_key in raw_to_computed.items():
        for fq_key, row_dict in financials_data.items():
            if raw_row in row_dict:
                val = row_dict[raw_row]
                # revenue_ttm should only come from Interest Income if not already set
                if computed_key not in computed_by_key[fq_key]:
                    computed_by_key[fq_key][computed_key] = val

    # Build final list sorted by FY and quarter
    final_data = []
    for key in sorted(financials_data.keys(), key=lambda k: (quarter_meta.get(k, {}).get('fy',''), quarter_meta.get(k, {}).get('quarter', 0))):
        meta = quarter_meta.get(key, {})
        if not meta:
            continue
        final_data.append({
            "symbol":        symbol.upper(),
            "sector":        "unknown",   # overridden by upsert_quarterly_data via company_symbol_map
            "fy":            meta["fy"],
            "quarter":       meta["quarter"],
            "quarter_label": meta["quarter_label"],
            "parsed_at":     datetime.now().isoformat(),
            "computed":      computed_by_key.get(key, {}),
            "raw":           financials_data.get(key, {}),
            "raw_keys_order": ordered_keys,
            "yoy":           bs_yoy,
        })

    print(f"[fallback] Extracted {len(final_data)} quarters from financials table for {symbol}.")
    return final_data


def parse_markdown_table(md_path, symbol):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.splitlines()
    table_lines = []
    in_table = False
    
    for line in lines:
        if line.startswith('| Particular |'):
            in_table = True
        if in_table:
            if not line.startswith('|'):
                break
            table_lines.append(line)

    if not table_lines:
        print(f"Warning: No broker-widget table in {md_path}. Trying financials-only fallback for {symbol}...")
        return _parse_from_financials_only(md_path, symbol)

    # Extract sector
    sector = "unknown"
    sector_match = re.search(r'Sector:<br>_(.*?)_', content, re.IGNORECASE)
    if sector_match:
        sector = sector_match.group(1).strip()

    # Parse header
    headers = [col.strip() for col in table_lines[0].split('|')[1:-1]]
    quarters = []
    for h in headers[1:]:
        # e.g., "080-081Q4"
        m = re.match(r'(\d{3})-(\d{3})Q(\d)', h)
        if m:
            fy = f"20{m.group(1)[1:]}-{m.group(2)[1:]}"
            short_fy = f"{m.group(1)[1:]}-{m.group(2)[1:]}"
            q = int(m.group(3))
            q_label = f"Q{q} {short_fy}"
            quarters.append({
                "key": f"{fy}-Q{q}",
                "fy": fy,
                "quarter": q,
                "quarter_label": q_label,
                "computed": {},
                "yoy": {}
            })
        else:
            print(f"Warning: Could not parse header {h}")

    key_map = {
        "PE Ratio": "pe_ratio",
        "PB Ratio": "pb_ratio",
        "PS Ratio": "ps_ratio",
        "ROE TTM": "roe_ttm",
        "ROA TTM": "roa_ttm",
        "Net Margin TTM": "net_margin",
        "Asset Turnover TTM": "asset_turnover",
        "EPS TTM": "eps_ttm",
        "BVPS": "bvps",
        "Net Profit Till Qtr": "net_profit_till_qtr",
        "Revenue Till Qtr": "revenue_till_qtr",
        "Net Profit TTM": "net_profit_ttm",
        "Revenue TTM": "revenue_ttm"
    }

    for line in table_lines[2:]:
        cols = [col.strip() for col in line.split('|')[1:-1]]
        if not cols:
            continue
            
        row_label_full = cols[0]
        row_label = row_label_full.split('<br>')[0].strip()
        
        schema_key = key_map.get(row_label)
        if not schema_key:
            continue

        is_yoy_row = "YOY" in row_label_full.upper()

        for i, val_col in enumerate(cols[1:]):
            if i >= len(quarters):
                break
                
            parts = [p.strip() for p in val_col.split('<br>')]
            val = _clean_number(parts[0])
            
            if val is not None:
                if "Cr." in parts[0]:
                    val = val * 10000000
                quarters[i]["computed"][schema_key] = val

            if is_yoy_row and len(parts) >= 3:
                yoy_val = _clean_number(parts[2])
                if yoy_val is not None:
                    quarters[i]["yoy"][schema_key] = yoy_val

    # Add metadata and merge with financials
    fin_md_path = md_path.replace("_fundamentals.md", "_financials.md")
    financials_data, ordered_keys, bs_yoy = parse_financials_md(fin_md_path)

    final_data = []
    for idx, q in enumerate(quarters):
        k = q["key"]
        
        # Raw financials data
        q["raw"] = financials_data.get(k, {})

        # Filter out quarters that don't have balance sheet data (if raw is totally empty)
        # The user requested to keep all 8 quarters even if the balance sheet is empty for the oldest 3
        # if not q["raw"]:
        #     print(f"Skipping {k} because balance sheet data is missing.")
        #     continue
            
        # Add the bs_yoy to the latest quarter (which is quarters[-1], but let's just add it everywhere for now)
        q["yoy"].update(bs_yoy)

        q_data = {
            "symbol": symbol.upper(),
            "sector": sector,
            "fy": q["fy"],
            "quarter": q["quarter"],
            "quarter_label": q["quarter_label"],
            "parsed_at": datetime.now().isoformat(),
            "computed": q["computed"],
            "raw": q["raw"],
            "raw_keys_order": ordered_keys,
            "yoy": q["yoy"]
        }
        final_data.append(q_data)

    return final_data

def upsert_quarterly_data(symbol, new_data):
    # Fetch sector and company name if we have them from db/company_symbol_map.json
    map_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db", "company_symbol_map.json")
    sector = None
    company_name = None
    if os.path.exists(map_path):
        with open(map_path, "r", encoding="utf-8") as f:
            symbol_map = json.load(f)
            if symbol.upper() in symbol_map:
                info = symbol_map[symbol.upper()]
                sector = info.get("sector")
                company_name = info.get("name")

    for item in new_data:
        if sector:
            item["sector"] = sector
        if company_name:
            item["company_name"] = company_name
        quarterly_db.save_quarter(symbol, item, allow_overwrite=True)

    return new_data

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("symbol")
    args = parser.parse_args()

    md_path = f".tmp/{args.symbol.upper()}_fundamentals.md"
    if not os.path.exists(md_path):
        print(f"Error: {md_path} not found. Run scrape_nepsealpha.py first.")
        exit(1)

    data = parse_markdown_table(md_path, args.symbol)
    if data:
        upsert_quarterly_data(args.symbol, data)
        print(f"Successfully parsed and saved {len(data)} quarters for {args.symbol}.")
    else:
        print(f"Failed to parse quarterly data for {args.symbol}. It might not be published yet.")
        exit(1)
