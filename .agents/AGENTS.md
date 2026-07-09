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
