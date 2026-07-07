import subprocess
import argparse
import sys
import os

def scrape_symbol(symbol):
    # Ensure the symbol is uppercase
    symbol = symbol.upper()
    url1 = f"https://nepsealpha.com/broker-widget/stock-detail?symbol={symbol}"
    out_file1 = f".tmp/{symbol}_fundamentals.md"
    
    url2 = f"https://nepsealpha.com/stocks/{symbol}/info?tab=financials-menu"
    out_file2 = f".tmp/{symbol}_financials.md"
    prompt = "Extract the 'Unaudited Quarterly Financial Report' table EXACTLY as it appears on the page into a single markdown table. You MUST include the 'YoY Growth' column and all quarter columns. Include all rows (Paid Up Capital, Reserve and Surplus, Total Equity, etc)."
    
    print(f"Scraping 1/2: {url1}...")
    try:
        subprocess.run(
            f'npx firecrawl-cli scrape "{url1}" -o {out_file1}',
            check=True,
            shell=True
        )
        print(f"Scraping 2/2: {url2} with LLM extraction (this might take ~10 seconds)...")
        subprocess.run(
            f'npx firecrawl-cli scrape "{url2}" --wait-for 5000 -Q "{prompt}" -o {out_file2}',
            check=True,
            shell=True
        )
        print(f"Successfully scraped {symbol}. Data saved to {out_file1} and {out_file2}")
        
    except subprocess.CalledProcessError as e:
        print(f"Error scraping {symbol}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape fundamental data from Nepsealpha using Firecrawl.")
    parser.add_argument("symbol", help="Stock symbol to scrape (e.g. MEN)")
    args = parser.parse_args()
    
    scrape_symbol(args.symbol)
