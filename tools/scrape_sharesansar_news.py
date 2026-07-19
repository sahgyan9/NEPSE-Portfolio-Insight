"""
ShareSansar Company News Scraper (direct HTTP, no Firecrawl)
============================================================
Fetches company-filtered news from ShareSansar's server-rendered listing page
and merges it into db/news.json. Replaces the previous Firecrawl+LLM version:

- ShareSansar's own `?company=<SYMBOL>` filter does the relevance matching
  server-side, so no LLM extraction is needed (and the old HDL-vs-NHDL
  substring problem disappears — the site tags articles per company).
- Article dates are embedded in the URL slug (e.g. `...-2026-06-23`), so
  parsing is a regex, not layout-dependent scraping.

Usage:
    python tools/scrape_sharesansar_news.py NICA
    python tools/scrape_sharesansar_news.py NICA --pages 2
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta

import httpx
from bs4 import BeautifulSoup

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "news.json")

BASE_URL = "https://www.sharesansar.com/category/latest"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PortfolioInsight/1.0",
    "Accept": "text/html,application/xhtml+xml",
}
SLUG_DATE_RE = re.compile(r"-(\d{4}-\d{2}-\d{2})/?$")
KEEP_DAYS = 90


def parse_news_page(html: str) -> list:
    """Extract news items from a ShareSansar category listing page.
    Layout-independent: keyed on /newsdetail/ links whose slug ends in a date
    (static menu links to newsdetail pages have no date suffix, so they drop out).
    """
    soup = BeautifulSoup(html, "html.parser")
    items, seen = [], set()

    for a in soup.find_all("a", href=True):
        href = a["href"].split("?")[0]
        if "/newsdetail/" not in href or href in seen:
            continue
        m = SLUG_DATE_RE.search(href)
        if not m:
            continue  # nav/menu link, not a dated article
        headline = (a.get("title") or a.get_text(" ", strip=True) or "").strip()
        if not headline:
            continue  # image-wrapping anchor; the text anchor for same href follows
        seen.add(href)
        items.append({"headline": headline, "date": m.group(1), "link": href})

    return items


def fetch_company_news(symbol: str, pages: int = 1) -> list:
    """Fetch up to `pages` listing pages for a company. Returns news items."""
    items = []
    url = f"{BASE_URL}?company={symbol}"

    with httpx.Client(headers=HEADERS, timeout=20, follow_redirects=True) as client:
        for _ in range(max(pages, 1)):
            resp = client.get(url)
            resp.raise_for_status()
            page_items = parse_news_page(resp.text)
            items.extend(page_items)

            # Follow "Next »" cursor pagination if more pages requested
            soup = BeautifulSoup(resp.text, "html.parser")
            next_link = next(
                (a["href"] for a in soup.find_all("a", href=True)
                 if "cursor=" in a["href"] and "company=" in a["href"]),
                None,
            )
            if not next_link or not page_items:
                break
            url = next_link

    return items


def scrape_news(symbol: str, pages: int = 1):
    symbol = symbol.upper()
    print(f"Fetching news for {symbol} from ShareSansar...")

    try:
        new_items = fetch_company_news(symbol, pages)
        print(f"  Parsed {len(new_items)} articles from listing")
    except Exception as e:
        print(f"Error fetching news for {symbol}: {e}")
        sys.exit(1)

    # Update db/news.json (same merge/dedupe/cutoff behavior as before)
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            db = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        db = {}

    existing_items = db.get(symbol, [])
    combined = existing_items + new_items

    # Deduplicate by link (fallback: headline)
    merged_dict = {}
    for item in combined:
        key = item.get("link", "") or item.get("headline", "")
        if key and key not in merged_dict:
            merged_dict[key] = item

    # Keep last 90 days, sort newest first
    cutoff_date = datetime.now() - timedelta(days=KEEP_DAYS)
    final_news = []
    for item in merged_dict.values():
        date_str = item.get("date", "")
        try:
            dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
            if dt >= cutoff_date:
                final_news.append((dt, item))
        except ValueError:
            final_news.append((datetime.now(), item))

    final_news.sort(key=lambda x: x[0], reverse=True)
    db[symbol] = [x[1] for x in final_news]

    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)

    print(f"Successfully saved {len(db[symbol])} news items for {symbol} to {DB_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape company news from ShareSansar (direct HTTP).")
    parser.add_argument("symbol", help="Stock symbol to scrape (e.g. NICA)")
    parser.add_argument("--pages", type=int, default=1, help="Listing pages to fetch (default 1 = ~10 articles)")
    args = parser.parse_args()

    scrape_news(args.symbol, args.pages)
