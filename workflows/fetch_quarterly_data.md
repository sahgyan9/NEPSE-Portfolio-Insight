# Workflow: Fetch Quarterly Data via NepseAlpha

## Objective
Extract quarterly financial metrics (EPS, BVPS, ROE, etc.) for a given NEPSE stock symbol by scraping NepseAlpha's broker widget, rather than parsing raw PDF statements. This ensures consistent data aligned with market consensus and eliminates PDF parsing fragility.

## Required Inputs
- `symbol`: The stock ticker symbol (e.g., SAHAS, MEN)

## Tools
- `tools/scrape_nepsealpha.py`: Fetches both the `broker-widget` (for 8 quarters of TTM ratios) and the `financials-menu` SPA tab via Firecrawl LLM extraction (`-Q`). It outputs two files: `.tmp/<SYMBOL>_fundamentals.md` and `.tmp/<SYMBOL>_financials.md`.
- `tools/parse_nepsealpha_md.py`: Parses both markdown tables, merges the data, extracts row sort orders, and upserts everything into `db/quarterly/<SYMBOL>.json`.

## Expected Output
A structured JSON array in `db/quarterly/<SYMBOL>.json` containing up to 8 quarters of historical metrics. The data is upserted, so old data is retained and new data is appended or updated. Balance sheet data typically spans 5 quarters, while ratio data spans 8. 

## Process
1. Run `python tools/scrape_nepsealpha.py <SYMBOL>` to fetch the raw data.
2. Run `python tools/parse_nepsealpha_md.py <SYMBOL>` to parse the markdown and update the local database.

## Edge Cases & Quirks Learned
- **LLM Extraction Quirks**: When using Firecrawl's LLM extraction (`-Q`), you must explicitly request specific edge-case columns (e.g., `YoY Growth`). Otherwise, the LLM may quietly drop them from the markdown table.
- **Handling Asymmetric Quarter Data**: NepseAlpha provides 8 quarters of ratio data but only 5 quarters of balance sheet data. Do not drop the older quarters! Instead, parse all 8 quarters and let the UI dynamically filter out empty columns for the Balance Sheet view.
- **Data Pipeline & Sorting**: To preserve the original sorting order from NepseAlpha, the parsing script captures the sequence of row labels and saves it as `raw_keys_order`. Ensure that backend APIs (like Flask's `jsonify` or `get_summary()`) explicitly include this array in their payloads, otherwise the UI will fall back to reading JSON dictionary keys, which Python sorts alphabetically by default.
- **Symbol not found / 404**: NepseAlpha might return an empty or error page. The parsing script will fail gracefully with "Error: Could not find data table".
- **Rate limiting**: Ensure `.env` contains a valid `FIRECRAWL_API_KEY` to avoid IP blocks or rate limits.
- **Data missing (Delay)**: Sometimes companies publish PDFs but NepseAlpha hasn't updated their UI yet. The parsed data won't include the newest quarter until NepseAlpha updates.
