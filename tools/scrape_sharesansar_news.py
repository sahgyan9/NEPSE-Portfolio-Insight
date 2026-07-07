import subprocess
import argparse
import sys
import os
import json
import re

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "news.json")

def scrape_news(symbol):
    symbol = symbol.upper()
    url = f"https://www.sharesansar.com/category/latest?company={symbol}"
    out_file = f".tmp/{symbol}_news.md"
    
    from datetime import datetime, timedelta

    # We ask the LLM to output a clean JSON array of news items
    prompt = f"Extract all news headlines from the list of articles that are SPECIFICALLY about the company with the exact symbol '{symbol}'. IMPORTANT: If '{symbol}' is a substring of another company's symbol (e.g., pulling 'NHDL' news when asked for 'HDL'), you MUST completely ignore the news about the other company. Format the output STRICTLY as a JSON array of objects, where each object has 'headline', 'date' (converted to YYYY-MM-DD format), and 'link' keys. Do not include any other text besides the JSON."
    
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
            new_items = json.loads(json_match.group(0))
        else:
            print(f"Warning: Could not parse JSON from the LLM output for {symbol}. Falling back to empty array.")
            print(f"Raw output: {content[:200]}...")
            new_items = []
            
        # Update db/news.json
        try:
            with open(DB_PATH, 'r', encoding='utf-8') as f:
                db = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            db = {}
            
        existing_items = db.get(symbol, [])
        combined = existing_items + new_items
        
        # Deduplicate by link and headline
        merged_dict = {}
        for item in combined:
            link = item.get('link', '')
            headline = item.get('headline', '')
            key = link if link else headline
            if key and key not in merged_dict:
                merged_dict[key] = item
                
        # Filter by 90 days and sort
        cutoff_date = datetime.now() - timedelta(days=90)
        final_news = []
        
        for item in merged_dict.values():
            date_str = item.get('date', '')
            try:
                # Assuming LLM converted to YYYY-MM-DD
                dt = datetime.strptime(date_str[:10], '%Y-%m-%d')
                if dt >= cutoff_date:
                    final_news.append((dt, item))
            except ValueError:
                # If date parsing fails, keep it but treat it as today for sorting
                final_news.append((datetime.now(), item))
                
        # Sort descending by date
        final_news.sort(key=lambda x: x[0], reverse=True)
        
        db[symbol] = [x[1] for x in final_news]
        
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
