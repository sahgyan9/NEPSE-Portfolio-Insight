import os
import sys
import json
import re
import subprocess
import argparse
import httpx

# Setup paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "db", "fundamentals.json")
PORTFOLIO_PATH = os.path.join(PROJECT_ROOT, "db", "portfolio.json")
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")


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
    
    # Fallback to system environment variables
    if not primary:
        primary = os.environ.get("FIRECRAWL_API_KEY")
    if not secondary:
        secondary = os.environ.get("FIRECRAWL_API_KEY_2")

    keys = []
    if primary:
        keys.append(primary)
    if secondary:
        keys.append(secondary)
    return keys


def fetch_market_data_hamroshare(symbol: str) -> dict:
    """Fetch 52w high/low, shares outstanding, and promoter/public float from HamroShare RSC (~250ms)."""
    symbol = symbol.upper().strip()
    url = f"https://hamroshare.com.np/company/{symbol}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PortfolioInsight/1.0",
        "RSC": "1"
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=8.0, follow_redirects=True)
        if resp.status_code != 200:
            return None
        text = resp.text

        def _search_num(pattern, default=None):
            m = re.search(pattern, text)
            if m:
                try:
                    return float(m.group(1))
                except (ValueError, TypeError):
                    pass
            return default

        high_52 = _search_num(r'"fiftyTwoWeekHigh":([-0-9.]+)')
        low_52 = _search_num(r'"fiftyTwoWeekLow":([-0-9.]+)')
        shares_out = _search_num(r'"stockListedShares":([-0-9.]+)') or _search_num(r'"shares":([-0-9.]+)')
        promoter_pct = _search_num(r'"promoterPercentage":([-0-9.]+)')
        public_pct = _search_num(r'"publicPercentage":([-0-9.]+)')

        data = {
            "sharesOutstanding": int(shares_out) if shares_out is not None else None,
            "promoterHolding": round(promoter_pct, 2) if promoter_pct is not None else None,
            "publicFloat": round(public_pct, 2) if public_pct is not None else None,
            "high52": high_52,
            "low52": low_52,
            "avgVolume120d": None
        }
        if any(v is not None for v in [data["high52"], data["low52"], data["sharesOutstanding"]]):
            return data
        return None
    except Exception as e:
        print(f"[HamroShare] Fetch error for {symbol}: {e}")
        return None


def scrape_market_data_firecrawl(symbol: str, api_key: str) -> dict:
    """Scrape market data for a symbol using Firecrawl CLI fallback."""
    symbol = symbol.upper()
    url = f"https://nepsealpha.com/stocks/{symbol}/info"
    out_file = os.path.join(PROJECT_ROOT, ".tmp", f"{symbol}_market_data.md")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    
    prompt = (
        "Extract the following stock information from the page: "
        "1. Shares Outstanding (or Outstanding Shares) "
        "2. Promoter Shareholding (%) (or Promoter Shares %) "
        "3. Public Shareholding (%) (or Public Shares %) "
        "4. 120 Days Average Volume "
        "5. 52 Weeks High "
        "6. 52 Weeks Low. "
        "Format the output STRICTLY as a single JSON object with these keys: "
        "sharesOutstanding, promoterHolding, publicFloat, avgVolume120d, high52, low52. "
        "Values MUST be numbers (promoterHolding and publicFloat should be percentages from 0 to 100). "
        "If a value is not found, use null."
    )
    
    env = os.environ.copy()
    env["FIRECRAWL_API_KEY"] = api_key
    cmd = f'npx firecrawl-cli scrape "{url}" -Q "{prompt}" -o "{out_file}"'
    res = subprocess.run(cmd, shell=True, env=env, capture_output=True, text=True)
    
    if res.returncode != 0 or not os.path.exists(out_file):
        return None
        
    with open(out_file, "r", encoding="utf-8") as f:
        content = f.read()
        
    json_match = re.search(r'\{.*?\}', content, re.DOTALL)
    if not json_match:
        return None
        
    try:
        return json.loads(json_match.group(0))
    except Exception:
        return None


def fetch_market_data(symbol: str, source: str = "auto") -> dict:
    """Fetch market data using selected source hierarchy."""
    symbol = symbol.upper().strip()
    
    # 1. HamroShare primary
    if source in ("auto", "hamroshare"):
        data = fetch_market_data_hamroshare(symbol)
        if data:
            return data
            
    # 2. Firecrawl fallback
    if source in ("auto", "firecrawl"):
        api_keys = get_api_keys()
        for api_key in api_keys:
            try:
                data = scrape_market_data_firecrawl(symbol, api_key)
                if data:
                    return data
            except Exception:
                pass
                
    return None


def update_fundamentals_db(symbol: str, data: dict):
    """Merge scraped data into fundamentals.json non-destructively."""
    db = {}
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                db = json.load(f)
        except Exception:
            pass
            
    symbol = symbol.upper()
    existing = db.setdefault(symbol, {})
    
    # Non-destructive merge
    for k in ["sharesOutstanding", "promoterHolding", "publicFloat", "avgVolume120d", "high52", "low52"]:
        if k in data and data[k] is not None:
            existing[k] = data[k]
            
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    print(f"Successfully saved market data for {symbol} to fundamentals.json")


def scrape_all(source: str = "auto"):
    symbols = []
    if os.path.exists(PORTFOLIO_PATH):
        try:
            with open(PORTFOLIO_PATH, "r", encoding="utf-8") as f:
                portfolio = json.load(f)
                for h in portfolio.get("holdings", []):
                    sector = h.get("sector", "")
                    if "fund" not in sector.lower() and h["symbol"] not in ["CSBY", "KDBY", "MMF1", "NBF3", "NIBLSF", "NMBSBFE"]:
                        symbols.append(h["symbol"])
        except Exception as e:
            print(f"Error loading portfolio symbols: {e}")
            
    symbols = sorted(list(set(symbols)))
    if not symbols:
        print("No active corporate symbols found in portfolio.")
        return
        
    print(f"Found {len(symbols)} corporate symbols to process (Source: {source}).")
    for symbol in symbols:
        data = fetch_market_data(symbol, source=source)
        if data:
            update_fundamentals_db(symbol, data)
        else:
            print(f"Failed to fetch market data for {symbol}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape market data for symbols")
    parser.add_argument("symbol", nargs="?", default="all", help="Stock symbol or 'all'")
    parser.add_argument("--source", choices=["auto", "hamroshare", "firecrawl"], default="auto",
                        help="Data source (default: auto)")
    args = parser.parse_args()
    
    if args.symbol.lower() == "all":
        scrape_all(source=args.source)
    else:
        data = fetch_market_data(args.symbol, source=args.source)
        if data:
            update_fundamentals_db(args.symbol, data)
        else:
            print(f"Failed to fetch {args.symbol}")
