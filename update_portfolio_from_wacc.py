import csv
import json
import os
import re
from datetime import datetime

# Paths
base_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(base_dir, "My Wacc Report.csv")
db_path = os.path.join(base_dir, "db", "portfolio.json")
stock_data_path = os.path.join(base_dir, "stock_data.json")

# Load existing database
if os.path.exists(db_path):
    with open(db_path, "r", encoding="utf-8-sig") as f:
        db = json.load(f)
else:
    db = {"holdings": [], "transactions": [], "valueHistory": []}

# Load stock data for company names if available
stock_names = {}
if os.path.exists(stock_data_path):
    try:
        with open(stock_data_path, "r", encoding="utf-8") as f:
            stock_data = json.load(f)
            # Typically stock_data is a list of dicts or a dict mapping symbol to details
            if isinstance(stock_data, list):
                for item in stock_data:
                    symbol = item.get("symbol") or item.get("scrip")
                    name = item.get("companyName") or item.get("name")
                    if symbol and name:
                        stock_names[symbol.upper()] = name
            elif isinstance(stock_data, dict):
                for k, v in stock_data.items():
                    if isinstance(v, dict):
                        name = v.get("companyName") or v.get("name")
                        if name:
                            stock_names[k.upper()] = name
    except Exception as e:
        print(f"Warning: Could not parse stock_data.json: {e}")

# Parse CSV
holdings_from_csv = []
with open(csv_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Standardize keys
        symbol = row.get("Scrip Name", "").upper().strip()
        if not symbol:
            continue
        
        quantity_str = row.get("WACC Calculated Quantity", "0")
        avg_cost_str = row.get("WACC Rate", "0")
        mod_date_str = row.get("Last Modification Date", "")
        
        try:
            quantity = float(quantity_str)
            # Convert to int if whole number
            if quantity.is_integer():
                quantity = int(quantity)
        except ValueError:
            quantity = 0
            
        try:
            avg_cost = float(avg_cost_str)
        except ValueError:
            avg_cost = 0.0
            
        # Parse date: e.g. "5/13/2025 14:46"
        date_added = ""
        if mod_date_str:
            try:
                # Try common formats
                for fmt in ("%m/%d/%Y %H:%M", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                    try:
                        dt = datetime.strptime(mod_date_str.strip(), fmt)
                        date_added = dt.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue
            except:
                pass
        
        if not date_added:
            date_added = datetime.now().strftime("%Y-%m-%d")
            
        holdings_from_csv.append({
            "symbol": symbol,
            "quantity": quantity,
            "avgCost": avg_cost,
            "dateAdded": date_added
        })

# Map old/different symbols (e.g. CSY -> CSBY)
symbol_mapping = {
    "CSY": "CSBY"
}

# Update holdings in DB
updated_holdings = []
db_holdings_dict = {h["symbol"].upper(): h for h in db.get("holdings", [])}

# Rename CSY to CSBY in db if exists
if "CSY" in db_holdings_dict and "CSBY" not in db_holdings_dict:
    csy_holding = db_holdings_dict.pop("CSY")
    csy_holding["symbol"] = "CSBY"
    db_holdings_dict["CSBY"] = csy_holding

for csv_h in holdings_from_csv:
    symbol = csv_h["symbol"]
    # Check mapping
    for old_sym, new_sym in symbol_mapping.items():
        if symbol == old_sym:
            symbol = new_sym
            
    existing = db_holdings_dict.get(symbol)
    
    if existing:
        # Update existing
        existing["quantity"] = csv_h["quantity"]
        existing["avgCost"] = round(csv_h["avgCost"], 4)
        existing["dateAdded"] = csv_h["dateAdded"]
        updated_holdings.append(existing)
        # Remove from dict so we know it has been processed
        db_holdings_dict.pop(symbol)
    else:
        # Create new holding
        company_name = stock_names.get(symbol, symbol)
        new_holding = {
            "symbol": symbol,
            "company": company_name,
            "quantity": csv_h["quantity"],
            "avgCost": round(csv_h["avgCost"], 4),
            "dateAdded": csv_h["dateAdded"]
        }
        updated_holdings.append(new_holding)

# If there are any holdings left in db_holdings_dict that were NOT in CSV, we keep them?
# Usually, a WACC report represents the full portfolio holdings from the demat account.
# Let's see if there are any remaining holdings in the DB.
for remaining_symbol, remaining_holding in db_holdings_dict.items():
    print(f"Holding in DB but not in CSV: {remaining_symbol}. Keeping it.")
    updated_holdings.append(remaining_holding)

# Recalculate total invested cost
total_invested = sum(h["quantity"] * h["avgCost"] for h in updated_holdings)

# Sort holdings alphabetically by symbol
updated_holdings.sort(key=lambda x: x["symbol"])

# Update DB holdings
db["holdings"] = updated_holdings

# Append new value history point
timestamp = datetime.now().isoformat()
db.setdefault("valueHistory", []).append({
    "date": timestamp,
    "invested": round(total_invested, 2),
    "value": round(total_invested * 1.05, 2) # set value to 1.05 * invested as initial estimate
})

# Save updated DB
with open(db_path, "w", encoding="utf-8") as f:
    json.dump(db, f, indent=2, ensure_ascii=False)

print(f"Successfully updated portfolio.json with {len(updated_holdings)} holdings from My Wacc Report.csv.")
print(f"Total Invested: Rs. {total_invested:.2f}")
