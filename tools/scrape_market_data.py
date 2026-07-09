import os
import sys
import json
import re
import subprocess
import argparse

# Setup paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "db", "fundamentals.json")
PORTFOLIO_PATH = os.path.join(PROJECT_ROOT, "db", "portfolio.json")
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")

# Default safety-net fallback key
SAFETY_FALLBACK_KEY = "fc-56a6f95e247d4c70a9b8f70d5b135db3"

def get_api_keys():
    """Load API keys from .env and return a list of [primary, secondary]."""
    primary = None
    secondary = None
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith("FIRECRAWL_API_KEY="):
                    primary = line.strip().split("=")[1].strip().strip('"').strip("'")
                elif line.strip().startswith("FIRECRAWL_API_KEY_2="):
                    secondary = line.strip().split("=")[1].strip().strip('"').strip("'")
    
    keys = []
    if primary:
        keys.append(primary)
    if secondary:
        keys.append(secondary)
    if SAFETY_FALLBACK_KEY not in keys:
        keys.append(SAFETY_FALLBACK_KEY)
    return keys

def scrape_market_data_for_symbol(symbol, api_key):
    """Scrape market data for a symbol using a specific Firecrawl API key."""
    symbol = symbol.upper()
    url = f"https://nepsealpha.com/stocks/{symbol}/info"
    out_file = os.path.join(PROJECT_ROOT, ".tmp", f"{symbol}_market_data.md")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    
    prompt = (
        "Extract the following stock information from the page: "
        "1. Shares Outstanding (or Outstanding Shares) "
        "2. Promoter Shareholding (%) (or Promoter Shares %) "
        "3. Public Shareholding (%) (or Public Shares %) "
        "4. 120 Days Average Volume. "
        "Format the output STRICTLY as a single JSON object with these keys: "
        "sharesOutstanding, promoterHolding, publicFloat, avgVolume120d. "
        "Values MUST be numbers (promoterHolding and publicFloat should be percentages from 0 to 100). "
        "If a value is not found, use null."
    )
    
    # Run command with key in environment
    env = os.environ.copy()
    env["FIRECRAWL_API_KEY"] = api_key
    
    print(f"Scraping {symbol} via Firecrawl (Key: ...{api_key[-6:]})...")
    
    cmd = f'npx firecrawl-cli scrape "{url}" -Q "{prompt}" -o "{out_file}"'
    res = subprocess.run(cmd, shell=True, env=env, capture_output=True, text=True)
    
    if res.returncode != 0:
        print(f"Firecrawl CLI failed with exit code {res.returncode}")
        print(f"Error: {res.stderr}")
        return None
        
    if not os.path.exists(out_file):
        print(f"Output file {out_file} was not generated.")
        return None
        
    with open(out_file, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Extract JSON object from markdown output
    json_match = re.search(r'\{.*?\}', content, re.DOTALL)
    if not json_match:
        print(f"Could not locate JSON block in scraped output.")
        print(f"Content: {content[:300]}")
        return None
        
    try:
        data = json.loads(json_match.group(0))
        return data
    except Exception as e:
        print(f"Failed to parse JSON content: {e}")
        return None

def update_fundamentals_db(symbol, data):
    """Merge scraped data into fundamentals.json."""
    db = {}
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                db = json.load(f)
        except Exception:
            pass
            
    symbol = symbol.upper()
    existing = db.setdefault(symbol, {})
    
    # Merge values
    for k in ["sharesOutstanding", "promoterHolding", "publicFloat", "avgVolume120d"]:
        if k in data and data[k] is not None:
            existing[k] = data[k]
            
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    print(f"Successfully saved market data for {symbol} to fundamentals.json")

def scrape_all():
    # Load symbols from portfolio
    symbols = []
    if os.path.exists(PORTFOLIO_PATH):
        try:
            with open(PORTFOLIO_PATH, "r", encoding="utf-8") as f:
                portfolio = json.load(f)
                # Exclude Mutual Funds
                for h in portfolio.get("holdings", []):
                    sector = h.get("sector", "")
                    if "fund" not in sector.lower() and h["symbol"] not in ["CSBY", "KDBY", "MMF1", "NBF3", "NIBLSF", "NMBSBFE"]:
                        symbols.append(h["symbol"])
        except Exception as e:
            print(f"Error loading portfolio symbols: {e}")
            
    symbols = list(set(symbols))
    if not symbols:
        print("No active corporate symbols found in portfolio.")
        return
        
    api_keys = get_api_keys()
    print(f"Found {len(symbols)} corporate symbols to scrape.")
    print(f"Available Firecrawl API keys: {len(api_keys)}")
    
    for symbol in symbols:
        success = False
        for api_key in api_keys:
            try:
                data = scrape_market_data_for_symbol(symbol, api_key)
                if data:
                    update_fundamentals_db(symbol, data)
                    success = True
                    break # Success, move to next symbol
            except Exception as e:
                print(f"Error scraping {symbol} with key ...{api_key[-6:]}: {e}")
                
        if not success:
            print(f"Failed to scrape market data for {symbol} with all available keys.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("symbol", nargs="?", default="all")
    args = parser.parse_args()
    
    if args.symbol.lower() == "all":
        scrape_all()
    else:
        api_keys = get_api_keys()
        success = False
        for api_key in api_keys:
            data = scrape_market_data_for_symbol(args.symbol, api_key)
            if data:
                update_fundamentals_db(args.symbol, data)
                success = True
                break
        if not success:
            print(f"Failed to scrape {args.symbol}")
