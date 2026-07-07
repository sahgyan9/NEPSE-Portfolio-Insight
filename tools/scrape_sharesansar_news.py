import subprocess
import argparse
import sys
import os
import json
import re

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "news.json")

def scrape_news(symbol):
    symbol = symbol.upper()
    url = f"https://www.sharesansar.com/company/{symbol}"
    out_file = f".tmp/{symbol}_news.md"
    
    # We ask the LLM to output a clean JSON array of news items
    prompt = "Extract all the news headlines from the 'Recent News' or 'Company News' section. Format the output STRICTLY as a JSON array of objects, where each object has 'headline', 'date', and 'link' keys. Do not include any other text besides the JSON."
    
    print(f"Scraping news for {symbol} from {url}...")
    try:
        os.makedirs(".tmp", exist_ok=True)
        subprocess.run(
            f'npx firecrawl-cli scrape "{url}" -Q "{prompt}" -o {out_file}',
            check=True,
            shell=True
        )
        
        # Read the generated markdown file
        with open(out_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Try to find JSON array in the markdown
        json_match = re.search(r'\[\s*\{.*?\}\s*\]', content, re.DOTALL)
        
        if json_match:
            news_items = json.loads(json_match.group(0))
        else:
            print(f"Warning: Could not parse JSON from the LLM output for {symbol}. Falling back to empty array.")
            print(f"Raw output: {content[:200]}...")
            news_items = []
            
        # Update db/news.json
        try:
            with open(DB_PATH, 'r', encoding='utf-8') as f:
                db = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            db = {}
            
        db[symbol] = news_items
        
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(db, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully saved {len(news_items)} news items for {symbol} to {DB_PATH}")
        
    except subprocess.CalledProcessError as e:
        print(f"Error running Firecrawl for {symbol}: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON for {symbol}: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape news from Sharesansar using Firecrawl.")
    parser.add_argument("symbol", help="Stock symbol to scrape (e.g. NICA)")
    args = parser.parse_args()
    
    scrape_news(args.symbol)
