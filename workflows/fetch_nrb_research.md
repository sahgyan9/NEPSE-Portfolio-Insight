# Workflow: Fetch NRB & Macro Policy Research

**Goal**: Keep the user informed about macro-economic shifts (liquidity, interest rates, regulations) that could affect the NEPSE market by querying academic databases.

**When to use this**:
- When the user asks for macro insights, NRB policy updates, or economic research.
- Before suggesting a major portfolio rebalancing between sectors (e.g., banking vs hydro).

**How it works**:
1. Run `python tools/fetch_relevant_research.py`
2. This script queries the OpenAlex academic API (100% free, 0 Firecrawl tokens) for research papers related to Nepal's monetary policy, NRB liquidity, and NEPSE efficiency.
3. The script outputs a list of the most relevant, highly-cited papers and saves them to `db/macro_research.json`.
4. Read `db/macro_research.json` and summarize the key findings or paper titles for the user.

**Important Notes**:
- OpenAlex rate-limits anonymous queries if the cluster is busy. The script handles this gracefully.
- Emphasize to the user how these macro signals (e.g., tightening liquidity) historically precede market movements.
