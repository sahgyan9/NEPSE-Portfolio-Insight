import subprocess
import argparse
import sys
import os

FUNDAMENTALS_PROMPT = (
    "Extract the quarterly fundamentals table that starts with '| Particular |' EXACTLY as it "
    "appears on the page into a single markdown table. Include all rows (PE Ratio, PB Ratio, "
    "PS Ratio, ROE TTM, ROA TTM, Net Margin TTM, Asset Turnover TTM, EPS TTM, BVPS, "
    "Net Profit Till Qtr, Revenue Till Qtr, Net Profit TTM, Revenue TTM) and all quarter columns."
)

def _run(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)

def scrape_symbol(symbol):
    symbol = symbol.upper()
    os.makedirs(".tmp", exist_ok=True)
    out_file1 = f".tmp/{symbol}_fundamentals.md"
    out_file2 = f".tmp/{symbol}_financials.md"

    # ── Step 1: Fundamentals table ─────────────────────────────────────────────
    # Primary URL: broker-widget (works for most stocks)
    url1_primary = f"https://nepsealpha.com/broker-widget/stock-detail?symbol={symbol}"
    # Fallback URL: main stock info page (works for banks, microfinance, dev-banks)
    url1_fallback = f"https://nepsealpha.com/stocks/{symbol}/info"

    print(f"Scraping fundamentals (primary): {url1_primary}...")
    r1 = _run(f'npx firecrawl-cli scrape "{url1_primary}" -o {out_file1}')

    # Check whether the broker-widget actually returned the table
    has_table = False
    if r1.returncode == 0 and os.path.exists(out_file1):
        with open(out_file1, "r", encoding="utf-8", errors="ignore") as f:
            has_table = "| Particular |" in f.read()

    if not has_table:
        print(f"  Broker-widget has no table for {symbol}. Trying fallback URL...")
        r1b = _run(
            f'npx firecrawl-cli scrape "{url1_fallback}" --wait-for 4000 '
            f'-Q "{FUNDAMENTALS_PROMPT}" -o {out_file1}'
        )
        if r1b.returncode != 0:
            print(f"  Fallback scrape also failed for {symbol}.")
            print(f"  stdout: {r1b.stdout[-400:] or '(empty)'}")
            print(f"  stderr: {r1b.stderr[-400:] or '(empty)'}")
            # Write empty file so downstream parser uses financials-only fallback
            with open(out_file1, "w") as f:
                f.write(f"# No fundamentals table available for {symbol}\n")
        else:
            with open(out_file1, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            if "| Particular |" in content:
                print(f"  Fallback succeeded — found table for {symbol}.")
            else:
                print(f"  Fallback returned content but no '| Particular |' table — parser will use financials-only mode.")

    # ── Step 2: Raw financials / balance sheet ────────────────────────────────
    url2 = f"https://nepsealpha.com/stocks/{symbol}/info?tab=financials-menu"
    fin_prompt = (
        "Extract the 'Unaudited Quarterly Financial Report' table EXACTLY as it appears on the "
        "page into a single markdown table. You MUST include the 'YoY Growth' column and all "
        "quarter columns. Include all rows (Paid Up Capital, Reserve and Surplus, Total Equity, etc)."
    )

    print(f"Scraping financials: {url2}...")
    r2 = _run(f'npx firecrawl-cli scrape "{url2}" --wait-for 5000 -Q "{fin_prompt}" -o {out_file2}')

    if r2.returncode != 0:
        print(f"  Financials scrape failed for {symbol} (non-fatal — will skip balance sheet).")
        with open(out_file2, "w") as f:
            f.write("# No financials data available\n")
    else:
        print(f"  Financials saved to {out_file2}")

    print(f"Successfully scraped {symbol}.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape fundamental data from Nepsealpha using Firecrawl.")
    parser.add_argument("symbol", help="Stock symbol to scrape (e.g. MEN)")
    args = parser.parse_args()
    scrape_symbol(args.symbol)
