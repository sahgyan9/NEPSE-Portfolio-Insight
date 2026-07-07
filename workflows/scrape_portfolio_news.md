# Workflow: Fetch Targeted Portfolio News

## Objective
Extract the latest news headlines and links from Sharesansar for specific symbols in the user's Portfolio or Watchlist. This avoids wasting Firecrawl monthly token limits by doing a targeted fetch rather than a bulk market scrape.

## Required Inputs
- `symbol`: The stock ticker symbol (e.g., NICA, SAHAS)

## Tools
- `tools/scrape_sharesansar_news.py`: Navigates to the company's Sharesansar page and uses Firecrawl LLM extraction (`-Q`) to parse the latest news headlines into a clean JSON array. 

## Expected Output
The script appends or updates the news array for the given symbol in `db/news.json`.
Format:
```json
{
  "NICA": [
    {
      "headline": "NICA reports 20% profit growth...",
      "date": "2024-05-10",
      "link": "https://www.sharesansar.com/news/..."
    }
  ]
}
```

## Process
1. Read `db/portfolio.json` and `db/watchlist.json` to identify active symbols.
2. Run `python tools/scrape_sharesansar_news.py <SYMBOL>` for any symbol the user explicitly requests or on a scheduled cadence (e.g. twice a week).

## Edge Cases
- **Firecrawl Limits**: Firecrawl provides 1,000 monthly credits. Never run this tool in a blind loop across all 200+ NEPSE symbols.
- **LLM Output Format**: The script uses regex `\[\s*\{.*?\}\s*\]` to guarantee it extracts the JSON array even if the LLM wraps it in markdown blocks (e.g. ` ```json `).
- **Symbol Not Found**: The script will gracefully return an empty array if the symbol page does not exist or has no news section.
