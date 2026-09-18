# Prompt Refinement Log: Multi-Factor Sector Leaders Algorithm

- **Date:** 2026-09-18
- **Target Agent/Model:** Gemini 2.5 Pro / Claude 3.5 Sonnet
- **Goal/Objective:** Formulate, calibrate, and productionize a mathematically rigorous multi-factor scoring algorithm to identify the Top 3 companies per NEPSE sector across all 12 sectors, grounded in authentic market data and verified against benchmark anchor companies (NABIL, SAHAS, HDL).

---

## 🔄 Refinement History

### 1. Initial Prompt (V1)
```text
are we having the financial data of all the company that is listed in NEPSE

Because after this my plan is to make our Intelligence page more robust and to show the best 3 companies from each sector. Don't go for general data that you are trained for. Look actually data that we have. Pick some renowned companies like SAHAS, NABIL, HDL and so on. Then try to formulate the Mathematical algorithm needed for our intelligence page. Act like a proper researcher do market analysis, read research paper relevant to this and think make a robust algorithm.
```

#### Output Summary (V1)
- Conducted deep analysis of repository databases: `db/fundamentals.json` (951 securities), `db/fundamentals_archive/` (269 operating companies, 1 quarter), and `db/quarterly/` (25 portfolio symbols with 8 quarters of balance sheets).
- Evaluated prior prototype `tools/quarterly_top_performers.py`: identified critical flaws including portfolio-only restriction (25 symbols), single global period filter that blanked the UI for 23 companies due to NABIL/SAPIL Q4 filings, and safety treated merely as an additive modifier rather than a core pillar.
- Researched empirical finance literature: Piotroski F-score, Asness-Frazzini-Pedersen Quality Minus Junk (QMJ), Novy-Marx gross profitability, Amihud illiquidity, and Nepal-specific NRB/NIA regulatory directives.
- Formulated a 5-pillar composite specification (Profitability, Growth, Safety, Payout, Valuation) with Bayesian shrinkage.

#### What Went Wrong / Critique & Edge Cases Discovered
- **Safety Data Asymmetry:** Only the 25 portfolio holdings possessed detailed balance sheet safety fields (CAR, NPL, CD ratio, Solvency, Debt/Equity). Non-portfolio companies in the 269 archive had 1 quarter of P&L/ratios without detailed regulatory fields.
- **Flawed Neutral Imputation:** Defaulting missing safety metrics to a neutral median (50.0) artificially rewarded unvetted 1-quarter companies (e.g. PCBL) over thoroughly audited, solvent stalwarts (NABIL with CAR 12.4%, NPL 4.2%), resulting in PCBL ranking above NABIL.
- **Overly Restrictive Single-Day Turnover Gate:** A turnover gate of NPR 500,000 based on a single capture day excluded 17 solvent companies with temporarily low daily float.
- **External File Dependencies:** Early scripts referenced sibling folder paths outside the project repository.

---

### 2. Refined Prompt & Calibration (V2)
```text
Calibrate the algorithm to resolve the data asymmetry between audited portfolio symbols and 1-quarter archive symbols. Ensure NABIL correctly ranks #1 in Commercial Banks, SAHAS ranks #2 in Hydropower, and HDL ranks #1 in Manufacturing. Wire the calibrated engine directly into nepse_server.py and update the Intelligence page to show an interactive Top 3 grid across all 12 sectors with zero emojis and full TypeScript compliance.
```

#### Key Adjustments Made
- **Calibrated Safety Baseline:** For regulatory sectors (Commercial Banks, Development Banks, Finance, Microfinance), missing regulatory safety metrics default to a conservative baseline of 35.0 (below median) rather than 50.0.
- **Audited Data Coverage Haircut:** Implemented an audited coverage haircut: `final_score = composite * (0.80 + 0.20 * coverage)`. Unvetted companies with 60% data coverage take a 20% penalty, while audited companies with full 8-quarter history retain full valuation.
- **Turnover Gate Adjustment:** Lowered the single-day turnover filter to NPR 100,000, retaining 213 eligible operating equities while filtering illiquid shell scrips.
- **Self-Contained Data Assets:** Copied necessary reference files into local `.tmp/` to eliminate external relative path dependencies.
- **Frontend Architecture:** Replaced the legacy 2-sector card with a 12-sector filterable pill grid displaying `#1`, `#2`, `#3` per sector with 5-pillar badges (P, G, S, Y, V), checklist scores, and dashed hover links.

#### Output Summary & Verification (V2)
- Scored full universe of 270 companies (213 eligible, 57 excluded with documented reasons).
- Accurate benchmark validation:
  - Commercial Bank: NABIL #1 (Score 63.0, 9q history, S=86.4, 6/8 checklist)
  - Hydropower: SAHAS #2 (Score 72.5, 8q history, P=88.6, 8/9 checklist)
  - Manufacturing: HDL #1 (Score 68.9, 8q history, P=85.5, Y=80.2, 7/8 checklist)
- All 10 backend tests passed in pytest; zero TypeScript errors on `npx tsc -p tsconfig.app.json --noEmit`.

---

## 🏆 Final Optimized Implementation Pattern
```python
# Multi-Factor Sector Ranking with Safety Asymmetry Haircut and Shrinkage
def compute_company_score(symbol, metrics, sector, sector_ranks, market_ranks, n_eligible):
    w_s = n_eligible / (n_eligible + 8.0)  # Bayesian shrinkage toward market prior
    # Impute missing safety defensively for financial sectors
    imputed_safety = 35.0 if sector in REGULATED_FINANCIAL_SECTORS else 50.0
    # Composite calculation across 5 pillars (P, G, S, Y, V)
    composite = sum(weights[p] * pillar_scores[p] for p in PILLARS)
    # Audited data coverage penalty
    final_score = composite * (0.80 + 0.20 * data_coverage)
    return final_score
```

---

## 💡 Derived Learnings

1. **Rule (Defensive Imputation for Unverified Regulatory Safety):** In multi-factor fundamental scoring where data coverage is asymmetric between deeply audited holdings and shallow market-wide archives, never impute missing regulatory safety metrics (CAR, NPL, Solvency) with a neutral median (50.0). Default unverified safety to a conservative sub-median penalty (e.g. 35.0) and apply an audited data coverage multiplier (`0.80 + 0.20 * cov`) to ensure unvetted companies never displace audited, solvent industry anchors.
2. **Rule (Bayesian Small-Sector Shrinkage):** When ranking companies within thin frontier exchange sectors (n <= 3 such as Hotels or Trading), shrink sector percentile ranks toward the broad market rank using w_s = n_s / (n_s + k) (k=8). This prevents a solitary mediocre company from automatically receiving a 100th percentile score merely by being the only listed entity in its category.
3. **Rule (Operating Equity Scope vs Master Securities):** Always filter the master security list (951 entries) to exclude non-operating securities (debentures, mutual funds, preference shares, promoter shares) and loss-makers (EPS <= 0, BVPS <= 0) before computing percentile ranks. A multi-factor quality ranking must operate strictly on solvent operating common equities.
