import subprocess
import argparse
import sys
import os
import json
import re

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "fundamentals.json")

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
SAFETY_FALLBACK_KEY = "fc-56a6f95e247d4c70a9b8f70d5b135db3"

def get_api_keys():
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

def scrape_fundamental(symbol):
    symbol = symbol.upper()
    url = f"https://nepsealpha.com/broker-widget/stock-detail?symbol={symbol}"
    out_file = f".tmp/{symbol}_fundamentals_llm.md"
    
    prompt = "Extract EPS, Book Value (or BV), P/E ratio, and P/B ratio. Format the output STRICTLY as a JSON object with keys: eps, bookValue, peRatio, pbRatio. Ensure the values are numbers. If a value is missing or N/A, use null."
    
    print(f"Scraping fundamentals for {symbol} from {url}...")
    api_keys = get_api_keys()
    success = False
    
    for api_key in api_keys:
        try:
            os.makedirs(".tmp", exist_ok=True)
            env = os.environ.copy()
            env["FIRECRAWL_API_KEY"] = api_key
            
            subprocess.run(
                f'npx firecrawl-cli scrape "{url}" -Q "{prompt}" -o "{out_file}"',
                check=True,
                shell=True,
                env=env
            )
            success = True
            break
        except subprocess.CalledProcessError as e:
            print(f"Error running Firecrawl for {symbol} with key ...{api_key[-6:]}: {e}")
            
    if not success:
        return False
    try:
        # Read the generated markdown file
        with open(out_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Try to find JSON object in the markdown
        json_match = re.search(r'\{.*?\}', content, re.DOTALL)
        
        if json_match:
            fundamental_data = json.loads(json_match.group(0))
        else:
            print(f"Warning: Could not parse JSON from the LLM output for {symbol}.")
            print(f"Raw output: {content[:200]}...")
            return False
            
        # Update db/fundamentals.json
        try:
            with open(DB_PATH, 'r', encoding='utf-8') as f:
                db = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            db = {}
        existing = db.setdefault(symbol, {})
        for k in ["eps", "bookValue", "peRatio", "pbRatio"]:
            if k in fundamental_data and fundamental_data[k] is not None:
                existing[k] = fundamental_data[k]
        
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(db, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully saved fundamentals for {symbol} to {DB_PATH}")
        print(json.dumps(fundamental_data, indent=2))
        return True
        
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON for {symbol}: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape fundamental data using Firecrawl.")
    parser.add_argument("symbol", help="Stock symbol to scrape (e.g. SHIVM, NICA), or 'all' to scrape a list", nargs="?", default="")
    args = parser.parse_args()
    
    if args.symbol.lower() == 'all':
        # Example list: user's typical watchlist + portfolio
        # In a real app, you might read this from db/holdings.json and db/watchlist.json
        symbols = []
        try:
            with open(os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "portfolio.json"), 'r') as f:
                portfolio = json.load(f)
                symbols.extend([h["symbol"] for h in portfolio.get("holdings", [])])
                symbols.extend([w["symbol"] for w in portfolio.get("watchlist", [])])
        except Exception:
            pass
            
        symbols = list(set(symbols)) # deduplicate
        if not symbols:
            print("No symbols found in portfolio/watchlist.")
            sys.exit(0)
            
        print(f"Scraping fundamentals for {len(symbols)} symbols: {', '.join(symbols)}")
        for sym in symbols:
            scrape_fundamental(sym)
    elif args.symbol:
        scrape_fundamental(args.symbol)
    else:
        print("Please provide a symbol or 'all'")
