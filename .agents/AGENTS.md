# Portfolio Insight Custom Project Rules

This document outlines workspace-specific rules and constraints that the AI agent must always adhere to.

## 🔑 External API & Scraper Fallbacks
- **Multi-Key Fallback:** When writing or editing scraping scripts that require external services with credit limits (such as Firecrawl), always check the local `.env` file for secondary key entries (e.g., `FIRECRAWL_API_KEY_2`). 
- **Sequential Key Rotation:** Implement a sequential fallback loop at the execution block/runner level so that the script automatically retries with the next available key if the primary key returns a process error or credit exhaustion error.

## 💾 Database Data Merging (No Overwrites)
- **Field Merging:** Scraping scripts that update JSON databases (e.g., `db/fundamentals.json`) must merge newly scraped fields into the existing record rather than doing a full dictionary overwrite (`db[symbol] = scraped_data`). Wiping out the existing dictionary causes data loss for keys scraped by other scripts (such as promoter holdings, volume, or quarterly values).

## 📊 Financial Valuation & Scoring Constraints
- **Negative Valuation Multiples:** Negative P/E or P/B ratios signify a loss-making or insolvent company. They must always be evaluated as `critical` (or scored low) and never categorized under "lower is better" rules that award them an "excellent" rating.
- **Mutual Fund Exemption:** Mutual funds have different financial structures and do not report standard corporate EPS/Book Value. Always exempt holdings in the `Mutual Fund` sector from standard corporate fundamental valuation metrics, returning a "Mutual Fund (Not Rated)" status and recommending Net Asset Value (NAV) analysis instead.

## 🎨 Dashboard Design & Educational UX
- **Dynamic Sector-Specific Filtering:** When displaying metric tables or comparisons, always dynamically hide or filter out rows that are not applicable to the company's active sector (e.g., hide banking NIM or efficiency ratios for Hydropower/Manufacturing stocks, and hide underwriting ratios for general firms). This keeps dashboards clean and prevents empty placeholder entries.
- **Structured Tooltips:** Educational tooltips on financial metrics should use a structured layout:
  1. **Definition:** Core meaning of the ratio.
  2. **Ranges & Benchmarks:** Explicit values showing what constitutes a "Good Range" vs. a "Warning Threshold".
  3. **Trend & Growth Guide:** Clear advice on how to evaluate the direction of growth or change (e.g., whether growth is positive or indicates warning signs).
