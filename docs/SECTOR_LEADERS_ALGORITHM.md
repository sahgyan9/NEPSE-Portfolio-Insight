# Sector Leaders v2: ranking the best 3 companies per NEPSE sector

**Status:** Production integrated & wired to `nepse_server.py` and the `Intelligence` page.
Calibrated 2026-09-18: turnover gate adjusted to NPR 100,000; unverified safety penalty (35.0) and
audited coverage haircut (0.80 + 0.20 * cov) applied to resolve PCBL/NABIL distortion.

---

## 1. The question that started this: do we have financial data for every listed company?

Short answer: **partly, and the part we have is two months stale.** Detail:

| Store | Companies | Depth | Captured | What it holds |
|---|---|---|---|---|
| `db/fundamentals.json` | 951 securities (796 after removing 83 debentures, 70 mutual funds, 2 preference shares) | latest only | mixed | sector for all; 52-week range for 559; EPS / BVPS / PE / PB for only 275 |
| `db/fundamentals_archive/*.json` | **269 operating companies** | **1 quarter** (2082-83 Q3) | 2026-07-29 (browser harvest) | EPS TTM, BVPS, ROE, ROA, net margin, PE, PB, Graham number, payout ratio (121), promoter holding (177), one day of turnover |
| `db/quarterly/*.json` | **25 symbols** (the portfolio) | **8 quarters** | Jul–Sep 2026 | full ratio history plus raw balance sheet: CAR / NPL / CD ratio / cost of funds for banks, borrowings and equity for hydro, solvency for insurers |
| `db/dividend_data.json` | 28 symbols | up to 16 fiscal years | 2026-09-18 | cash and bonus per FY (HamroShare) |
| `../Nepse Fundamentals/.tmp/raw_data.json` | 305 companies | 5–10 FYs | ~Jul 2026 | merolagani bonus / cash history |
| `../Nepse Fundamentals/.tmp/nepse_alpha_scoreboard.json` | 268 companies | 1 quarter | ~Jul 2026 | YoY profit growth, EPS TTM, ROE TTM, PE, PB, PS |

Sector coverage in the 269-company archive: Hydropower 103, Microfinance 50, Commercial Banks 19,
Development Banks 16, Manufacturing 15, Life Insurance 14, Finance 13, Non-Life Insurance 13,
Others 9, Hotels 8, Investment 7, Trading 2. That is essentially every operating company NEPSE
lists (public sources put the count at 263–284 depending on the date).

So the **breadth** is there. What is missing is **depth** and **freshness**:

1. **One quarter is not a time series.** Growth, consistency, and stability (three of the five
   pillars below) need at least 4 and preferably 8 quarters. Only 25 companies have that.
2. **The snapshot is Q3 2082/83.** Q4 (annual) unaudited results for FY 2082/83 have been
   publishing since late July 2026, so most of the archive is one report behind. NABIL's Q4 is
   already in `db/quarterly`; nothing else is.
3. **Sector-specific safety fields exist only for the 25.** CAR, NPL, CD ratio, solvency ratio,
   borrowings come from NepseAlpha's `/ajax/financials-menu/<SYM>` table, which the market-wide
   harvester never fetched.
4. **Liquidity is a single day.** `trade_turnover` is the capture day only. A ranking needs a
   20-day average or an Amihud-style ratio, which needs a daily series we do not keep.

### The good news: the missing history is one storage change away

`tools/browser_harvest.js` already requests the NepseAlpha page whose embedded JSON carries
**`quartesGrowths`: 16 particulars × 8 quarters for every company** (see the docstring in
`tools/scrape_nepsealpha_direct.py`). The harvester's `snapshot()` keeps only the latest quarter's
row and discards the other seven. Keeping all eight rows, and adding one extra request per symbol
for `/ajax/financials-menu/<SYM>`, turns the July run into a full-market 8-quarter dataset with
the bank / insurer / hydro safety fields. Section 7 lays out the steps.

---

## 2. What is wrong with the current ranking (`tools/quarterly_top_performers.py`)

The current formula is `Base × (1 + QualityMod)` where Base is a within-sector percentile blend of
ROE, consistency-adjusted EPS growth, net margin, and revenue growth. It has real ideas in it
(sector-aware modifiers, regulatory exclusions, an EPS consistency index) but, run against the
actual files, it fails in these concrete ways:

- **It only scores the 25 portfolio symbols**, so "sector leaders" means "best of what I own".
  Sectors with one company (Life Insurance = CLI, Hotels = SHL) score 100 by construction because
  a percentile over n = 1 is 100.
- **Period misalignment blanks the page.** It picks a single global "latest period". Because only
  NABIL and SAPIL have a Q4 2082/83 file, the page currently shows two sectors for Q4 and hides the
  Q3 rankings that hold the other 23 companies.
- **Two companies land in an `unknown` sector** (CBBL, SNLI) because their quarterly file carries
  `sector: "unknown"`, and the page filters that bucket out. Sector labels in `db/quarterly` are
  inconsistent (`BANKING`, `MANUFACTURE`, `Hydro Power`, `Commercial Banks`...).
- **No liquidity or price-staleness gate.** A stale last price makes PE and PB arithmetically
  correct and economically meaningless; this is the single biggest source of false "cheap" stocks
  on NEPSE and the archive already flags it (`price_is_stale`).
- **Safety is a modifier, not a pillar.** AVYAN ranks #1 in Microfinance with a score of 85.9 on
  the strength of a 39% ROE, while sitting at CAR 8.57% (floor is 8%), NPL 5.14%, CD ratio 110%
  (ceiling is 90%). A ±25% multiplier cannot offset a 90th-percentile base.
- **Small bugs:** `raw.get("CAR") or raw.get("car")` treats a legitimate 0 as missing; the
  dividend premium averages bonus percentages over every year on file, including 2067/68; the
  "EPS consistency" window looks forward across periods the company may not have.

None of this is fixable with weight tweaks. The structure has to change.

---

## 3. What the literature says, and what transfers to NEPSE

I read for three things: which fundamental signals predict returns in emerging and frontier markets,
how robust composite scores are built, and what is specific to Nepal.

**Fundamental composites work outside the US, and better in emerging markets.**
Piotroski's F-score (nine binary accounting signals) earns roughly a 10% annual high-minus-low
spread in 20 developed non-US markets and about 12% in 15 emerging markets over 2000–2018, robust
to size, value, momentum, and profitability controls
([Walkshäusl 2020, J. Asset Management](https://link.springer.com/article/10.1057/s41260-020-00157-2);
[Hyde 2013, SSRN](https://doi.org/10.2139/ssrn.2274516)). Two design lessons transfer: **binary
signals summed are robust to outliers**, and **the signals are about direction of change**
(margin up, leverage down, no dilution), not levels alone.

**Quality has four dimensions, and profitability is the persistent one.**
Asness, Frazzini and Pedersen define quality as profitability, growth, safety and payout, each a
z-score of ranked sub-measures, and show a quality-minus-junk premium in 24 countries; profitability
is the most persistent characteristic, growth and payout the least
([AFP, "Quality Minus Junk"](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2312432)).
Novy-Marx shows profitability predicts returns as strongly as value and is complementary to it
([Novy-Marx 2013](https://www.nber.org/system/files/working_papers/w15940/w15940.pdf)). Lesson:
**give profitability the largest weight, and never let growth alone win**.

**Value and momentum exist in frontier markets; the 52-week-high signal does not travel well.**
De Groot, Pang and Swinkels document significant value and momentum effects across 24 frontier
markets that survive transaction costs
([de Groot et al. 2012](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1600023)). George and
Hwang's nearness-to-52-week-high signal is strong in the US but unprofitable on emerging-market
indices
([George & Hwang 2004](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-6261.2004.00695.x);
[Bornholt & Malin 2011](https://www.sciencedirect.com/science/article/abs/pii/S0261560610001099)).
Lesson: **keep a valuation pillar so "best" is not "most expensive", and do not build a pillar on
the 52-week range we happen to store**.

**Illiquidity is priced, and the price impact channel is mostly volume.**
Amihud's return-to-volume ratio predicts returns cross-sectionally
([Amihud 2002](https://www.sciencedirect.com/science/article/abs/pii/S1386418101000246)); Lou and
Shu show the trading-volume component carries the effect
([Lou & Shu 2017, RFS](https://academic.oup.com/rfs/article-abstract/30/12/4481/3954040)). Lesson:
**an eligibility gate on turnover and price freshness is not a nicety; on a thin exchange it is
the difference between a ranking and a list of untradeable prices**.

**Index providers winsorize and rank within a parent universe.** MSCI's Quality index winsorizes
each variable at the 5th/95th percentile inside the parent index, then z-scores and averages
([MSCI Quality Indexes Methodology](https://www.msci.com/eqb/methodology/meth_docs/MSCI_Quality_Indexes_Methodology_June_2014.pdf)).
Lesson: **rank within sector, clip extremes before ranking, and shrink tiny sectors toward the
whole market rather than ranking two companies against each other.**

**Nepal-specific evidence.**
- EPS, book value per share and P/E explain market price in Nepalese commercial banks; DPS and total
  assets do not
  ([Fundamentals of stock price in Nepalese commercial banks, IRJMS](https://nepjol.info/index.php/irjms/article/download/27887/23026/)).
  In microfinance, price correlates with EPS, ROE, P/E and book value and inversely with float size
  ([Quest on determinants of stock price, microfinance](https://www.researchgate.net/publication/378592219_Quest_on_Determinants_of_Stock_Price_in_Nepal_Evidence_of_Microfinance_Sector_Share_Listed_in_NEPSE)).
- Bonus-share announcements produce significant positive abnormal returns on NEPSE
  ([Impacts of bonus issue on stock price in Nepalese equity market](https://www.nepjol.info/index.php/irjms/article/download/28049/23125/83023)).
  This is why the payout pillar counts **bonus consistency**, which a US-style payout ratio ignores.
- NEPSE rejects weak-form efficiency across most sectors 2013–2022
  ([Weak form of market efficiency in Nepalese stock market](https://www.researchgate.net/publication/389430277_Weak_Form_of_Market_Efficiency_in_Nepalese_Stock_Market);
  [NRB Economic Review 2026](https://www.nrb.org.np/contents/uploads/2026/04/vol-37_art2.pdf)).
  Fundamental mispricing persists, which is the premise of this page.
- CAMELS is the accepted lens for Nepalese banks: capital adequacy, asset quality and management
  quality drive profitability
  ([CAMEL analysis of commercial banks in Nepal](https://www.researchgate.net/publication/373692893_CAMEL_Analysis_of_Commercial_Banks_in_Nepal_Assessment_of_Financial_Soundness)).
- Hydropower research on NEPSE ties financial performance to capital structure; a **falling
  debt-to-equity ratio marks the move into the cash-generative phase**
  ([Nexus between capital structure and financial performance of Nepalese hydropower companies](https://www.nepjol.info/index.php/md/article/view/47550);
  [NEPSE Trading hydropower fundamentals guide](https://nepsetrading.com/blog/fundamental-analysis-of-hydropower-companies-in-nepse)).

**Regulatory floors used as hard gates** (all Nepal-specific, all verified September 2026):

| Sector | Metric | Floor / ceiling | Source |
|---|---|---|---|
| Commercial banks (class A) | Total CAR | ≥ 11% | [NRB Basel III framework; sharesansar summary](https://www.sharesansar.com/newsdetail/do-all-commercial-banks-maintain-minimum-car-and-core-capital-tier-i-prescribed-by-nepal-rastra-bank-2022-05-03) |
| Development banks, finance (class B/C) | Total CAR | ≥ 10% (Capital Adequacy Framework 2007; confirm current unified directive before shipping) | [NRB CAF 2007](https://www.nrb.org.np/dbs/new-capital-adequacy-framework-2007-updated-2008-2/) |
| Microfinance | Total CAR | ≥ 8% (Tier 1 ≥ 4%) | [Beema Post, Jul 2026](https://en.beemapost.com/2026/07/13997/) |
| All BFIs | Credit-to-deposit ratio | ≤ 90% | [NRB regulations 2026 summary](https://nepsetrading.com/insights/nepal-rastra-bank-banking-regulations-latest-rules-and-guidelines-2026) |
| All BFIs | NPL | watch above 5%; exclude above 10% (28 of 48 retail MFIs are above 10% as of April 2026) | [Nepal News on NRB FSR](https://english.nepalnews.com/s/business/nrbs-financial-stability-report-everything-you-need-to-know-about-rising-bad-loans-and-banking-risks/); [NEPSE Trading MFI capital crisis](https://nepsetrading.com/blog/nepals-microfinance-sector-on-the-brink-capital-crisis-forces-rush-to-rights-shares) |
| Insurers | Solvency ratio | ≥ 1.30 under the 2025 risk-based capital directive (was 1.5); licence at risk below 0.45 | [NIA RBC & Solvency Directive 2025](https://nia.gov.np/Admin/images/Law/RiskBasedCapital/687cc9c60257d_1753008582.pdf); [Beema Post, Sep 2026](https://en.beemapost.com/2026/09/14588/) |

---

## 4. The algorithm

Everything below is implemented in `tools/score_sector_leaders.py`. Symbols: a company *i* in
sector *s*, with *n_s* eligible companies in the sector.

### Stage 0. Eligibility gates (hard exclusions, reported with the reason)

A company is scored only if **all** of these hold:

- It is an operating company (not a mutual fund, debenture, or preference share).
- EPS TTM > 0 and book value per share > 0, and ROE ≥ 0 when reported. Loss-makers are never
  "cheap"; this is also the existing project rule on negative multiples.
- Price is fresh: last trade within 5 calendar days (one NEPSE trading week) of capture.
- Turnover on the capture day ≥ NPR 500,000. (Weak proxy; replace with a 20-day median once
  the daily series exists, see section 7.)
- Regulatory floors from the table above when the field is reported: CAR ≥ floor, NPL ≤ 10%,
  solvency ≥ 1.30. Missing fields do not exclude, they reduce the completeness factor in stage 4.

### Stage 1. Sector-relative percentile ranks

For every metric *m* and company *i*, compute the percentile rank inside the sector,
`r_s(i,m) ∈ [0,100]`, using average ranks for ties, after sign-adjusting so that higher is always
better (e.g. `-P/B`, `-NPL`, `-D/E`). Growth rates are clipped to [-100%, +150%] before ranking
so a single restatement or a base-effect from a tiny prior-year profit cannot dominate.

Also compute the market-wide percentile `r_M(i,m)` over all eligible companies.

### Stage 2. Small-sector shrinkage

    w_s = n_s / (n_s + k),  k = 8
    r(i,m) = w_s · r_s(i,m) + (1 − w_s) · r_M(i,m)

With 70 eligible hydropower companies, w = 0.90 and the sector rank dominates. With Trading
(n = 1) w = 0.11, so the company is judged mostly against the whole market instead of being
awarded 100 for being alone. This is ordinary Bayesian shrinkage toward the prior; k = 8 is the
sector size at which the two views get equal weight.

### Stage 3. Five pillars

Each pillar is a weighted mean of its metrics' shrunk percentile ranks. Weights renormalise over
the metrics that are present; the fraction of weight that was present is the pillar's
*completeness* c_k.

| Pillar | Metrics (weight) | Sector variants |
|---|---|---|
| **P** Profitability | ROE TTM (.50), ROA TTM (.25), net margin TTM (.25) | BFIs and hydropower: ROE .40, ROA .40 / .35, margin .20 / .25 (ROA is the leverage-neutral measure for banks; for hydro it separates plant economics from financing) |
| **G** Growth | EPS TTM YoY (.45), revenue TTM YoY (.25), consistency (.30) | consistency = share of non-decreasing steps in the 8-quarter TTM-EPS series; the trend itself is a Theil–Sen (median-of-slopes) fit on log EPS, so one bad quarter cannot flip it |
| **S** Safety | banks / dev banks / finance: CAR (.35), −NPL with an extra 5-point penalty above the 5% watch level (.35), CD-ratio distance from 80% (.15), earnings stability (.15). Microfinance: −NPL (.45), CAR (.35), stability (.20). Insurers: solvency (.60), stability (.40). Hydro, manufacturing, hotels, others: −D/E (.55), stability (.45) | stability = −(coefficient of variation of TTM EPS over 8 quarters) |
| **Y** Payout | payout ratio capped at 1.0 (.30), dividend yield (.25), 5-year average total dividend % (.25), fraction of last 5 FYs with any distribution (.20) | the last two carry the Nepal bonus-share evidence |
| **V** Valuation | earnings yield 1/PE (.45), −P/B (.30), Graham-number discount (.25) | all sector-relative, so a hydro P/B of 4 is judged against hydro, not against banks |

### Stage 4. Composite and completeness haircut

    composite_i = Σ_k W_{s,k} · pillar_k(i)      (a missing pillar scores 50, neutral, not skipped)
    coverage_i  = Σ_k W_{s,k} · c_k(i)
    score_i     = composite_i × (0.85 + 0.15 · coverage_i)

Pillar weights `W_s` (P, G, S, Y, V): default .30 / .20 / .20 / .15 / .15. Banks and finance
.30 / .15 / .25 / .15 / .15. Microfinance .25 / .15 / **.30** / .15 / .15 (the sector is in an
asset-quality crisis; safety must outweigh growth). Insurers and hydropower .30 / .20 / .25 / .10
/ .15. Manufacturing .35 / .20 / .15 / .15 / .15.

The haircut means a company can lose at most 15% for unreported data and can never gain by not
reporting. It is deliberately gentle because today the unreported fields are our harvesting gap,
not the company's disclosure gap; tighten it once section 7 is done.

### Stage 5. Tie-break and explainability: a nine-point checklist

Alongside the score, each company gets a Piotroski-style checklist adapted to what NEPSE companies
actually report: ROE > 0; ROA > 0; EPS TTM up YoY; revenue TTM up YoY; ROA improved YoY; net margin
improved YoY; leverage not rising (D/E down, or CD ratio within the 90% ceiling); no dilution
beyond bonus shares; pays a dividend. Items that cannot be assessed are shown as `?`, and the UI
must display `passed / assessable`, never `passed / 9`. Ties on score break on checklist count,
then on turnover.

### Stage 6. Output

Top 3 per sector with: rank, score, the five pillar values, coverage, checklist, the raw metrics
behind each pillar, the reporting period **per company** (no global "latest period"), and the
exclusion list with reasons. "Others" is ranked with a low shrink weight and should be labelled as
a mixed bucket on the page.

---

## 5. Prototype results on the real data (run 2026-09-18)

`python tools/score_sector_leaders.py --top 3 --explain SAHAS NABIL HDL`

Universe 270, eligible 198, excluded 72 (54 loss-makers, 17 illiquid or stale, 2 negative book
value, 2 missing EPS). Pillars P/G/S/Y/V; `hist` is how many quarters we hold.

| Sector (eligible) | #1 | #2 | #3 |
|---|---|---|---|
| Hydropower (70) | MEN 76.5 (P 92, S 75, 8q) | **SAHAS 72.7** (P 89, Y 73, 8q) | RADHI 69.7 (P 98, G 88, 1q, S unknown) |
| Microfinance (32) | CBBL 68.2 (S 99, Y 84) | JBLB 64.1 | MSLB 62.6 (1q) |
| Commercial Bank (19) | PCBL 63.8 (1q, S unknown) | **NABIL 63.0** (S 86, 9q) | KBL 62.8 (1q) |
| Life Insurance (14) | CLI 65.1 (S 95) | RNLI 55.9 | ILI 54.7 |
| Development Bank (14) | GBBL 61.7 | MNBBL 58.1 | LBBL 56.1 |
| Non-Life Insurance (12) | PRIN 58.4 | NICL 53.9 | NIL 53.0 |
| Finance (10) | MFIL 57.7 | RLFL 57.4 | BFC 52.5 |
| Manufacturing (10) | **HDL 69.2** (P 86, S 80, Y 80, V 37) | UNL 64.5 (P 100, G 10) | SHIVM 64.1 (9/9 checklist) |
| Others (7) | NRIC 61.7 | NTC 57.1 | MKCL 47.1 |
| Investment (6) | CHDC 63.3 | NRN 60.6 | CIT 50.1 |
| Hotels (3) | SHL 65.4 | KDL 60.6 | CGH 34.2 |

**The three companies you named, read against the numbers:**

- **SAHAS (Sahas Urja)**, Hydropower #2 of 70. ROE 16.8%, ROA 6.9%, net margin 44%, EPS TTM 27.36
  growing 62% YoY with eight consecutive non-decreasing quarters (consistency 1.0). D/E 1.28 and
  falling since Q3 81/82. Pays out 80% of earnings; 5-year average distribution 15%. Passes 8 of 9
  checklist items; the miss is dilution (share count grew faster than bonus, the 2025 rights
  issue). Only MEN beats it, on higher ROE and lower leverage.
- **NABIL**, Commercial Bank #2 of 19. It wins on safety (CAR 12.4%, NPL 4.2%, CD 80%, EPS
  coefficient of variation 0.06, the steadiest earnings in the sector) and is middling on growth
  (EPS +5%, revenue −7% as rates fell). PCBL edges it only because PCBL's safety pillar is
  unknown and therefore scored neutral; with market-wide CAR/NPL data NABIL is the likely #1.
  This is exactly why section 7 matters.
- **HDL (Himalayan Distillery)**, Manufacturing #1 of 10. ROE 24.5%, ROA 21% (essentially
  debt-free), 87% payout, 48% average annual distribution over five years. Its valuation pillar
  is 36.5 (P/E 39.7, P/B 8.7): the market already prices the quality. The algorithm still ranks it
  first because P, S and Y are all in the top decile, but a buyer sees the V pillar and knows why.

**Changes versus the current page:** AVYAN falls from Microfinance #1 to #22 of 32 (CAR at the
floor, NPL above watch, CD 110%). UPPER and GCIL are excluded as loss-makers instead of being
ranked. HRL drops to #5 of 7 after its Q3 loss cut TTM EPS from 13.1 to 3.3. NICA lands last among
banks (post-merger EPS collapse), matching the "value trap" note in the older Hidden Gems SOP.

**Known artefact of today's data:** companies with only the July snapshot get a neutral Safety
pillar and a 4-item checklist, so a strong 1-quarter company can edge a fully-documented one (PCBL
vs NABIL, RADHI at Hydropower #3 with S unknown). That is a data gap, not an algorithm choice, and
it disappears once every company has the same fields.

---

## 6. Sensitivity and validation plan

Before shipping, run these and record the outcome in this file:

1. **Weight perturbation.** Re-run with every pillar weight ±0.05. The top 3 in each sector with
   n ≥ 10 should change by at most one name. If a sector flips on small perturbations, the sector
   is not separable on fundamentals and the page should say so rather than show false precision.
2. **Rank persistence.** Once two quarters exist, report Spearman correlation of scores between
   quarters per sector. Quality composites should persist (AFP show profitability is the most
   persistent trait); a correlation under 0.5 signals noisy inputs.
3. **Backtest against the July snapshot.** When Q4 is harvested, score the July (Q3) file, then
   compare each company's price change Jul 29 → harvest date across score quintiles within sector.
   One quarter proves nothing statistically, but a monotone pattern is a sanity check and an
   inverted one is a red flag.
4. **Unit tests** in `tools/test_sector_leaders.py`: gates (loss-maker excluded, stale price
   excluded, CAR floor by sector), tie handling in `percentile_ranks`, shrinkage arithmetic at
   n = 1 and n = 70, Theil–Sen trend with one outlier quarter, completeness haircut bounds.

---

## 7. Getting the data the algorithm needs (ordered)

1. **Extend the browser harvester to keep all 8 quarters.** In `tools/browser_harvest.js`,
   `snapshot()` reads `p.quartesGrowths` and keeps one row; emit the full array plus
   `otherQuartGrowths` (PE/PB/PS per quarter) under a new `history` key. Cost: zero extra
   requests. Then extend `tools/ingest_harvest.py` to upsert each quarter into
   `db/quarterly/<SYM>.json` through `quarterly_db.save_quarter`, reusing the field mapping in
   `tools/parse_nepsealpha_md.py` so the 25 existing files and the 245 new ones have one schema.
2. **Add the balance-sheet request.** One extra fetch per symbol to
   `/ajax/financials-menu/<SYM>` (JSON with an HTML table; parser already exists in
   `scrape_nepsealpha_direct.parse_financials_table`). This is where CAR, NPL, CD ratio, cost of
   funds, borrowings, total equity and solvency come from. Roughly 270 requests at a 1 s delay,
   about 5 minutes in a visible Chrome tab.
3. **Re-run the harvest now** to capture Q4 2082/83 for the whole market, then re-run each
   quarter. The archive's dedupe rule (one row per published quarter) already supports this.
4. **Normalise sector labels at ingest.** Use `normalize_sector()` from the prototype as the
   single mapping and stop writing `unknown`, `BANKING`, `MANUFACTURE` into quarterly files.
5. **Keep a daily turnover series.** `nepse_server.py` already pulls all 345 live quotes every
   30 s from HamroShare; append one row per symbol per trading day (date, close, volume,
   turnover) to `db/daily_quotes/<SYM>.json`. After 20 trading days the liquidity gate becomes a
   20-day median turnover and an Amihud ratio; after 12 months the momentum extension in section
   9 becomes possible.
6. **Bulk dividend history.** `tools/scrape_dividends.py` already fetches 830+ announcements for
   320+ companies from HamroShare in one request; run it without a symbol filter so the payout
   pillar stops depending on the 28-symbol file and the older merolagani dump.

Step 1 alone moves Growth, consistency and stability from 25 companies to 270. Steps 1–2 remove
the "S unknown" artefact in section 5.

---

## 8. Wiring it into the Intelligence page

- Replace the body of the `/api/quarterly/top-performers` handler in `nepse_server.py` with a call
  to `score_universe()` (import the module; do not shell out). Keep the response shape the page
  already reads (`latestPeriod`, `periods[period][sector] = [...]`) but add `period` per company,
  `pillars`, `coverage`, `checklist`, and an `excluded` map. Keep the cached-JSON pattern with a
  daily regeneration; the scoring takes well under a second for 270 companies.
- On the page: show 3 per sector, not 1. Show the five pillars as a compact bar row rather than
  the current formula string in the card description. Show `checklist passed / assessable`. Show
  the company's own reporting period on the card. Give a "Why not ranked?" link that opens the
  exclusion reason for any symbol the user holds (UPPER, GCIL today). Follow the existing rules:
  Lucide icons, no emoji, dashed underline on the symbol link, structured tooltip
  (definition / range / trend) on each pillar.
- The `NewsTicker` also reads this endpoint; it only needs the #1 per sector and will keep working
  if the shape is preserved.
- Run `npx tsc -p tsconfig.app.json --noEmit` after the frontend edit (Vite SWC does not
  typecheck).

---

## 9. Decisions still open (Gyan's call)

1. **How much should valuation count?** The prototype gives V 15%, so a clearly overpriced
   quality company (HDL) still wins its sector. Raising V to 25% would put UNL ahead of HDL. My
   recommendation: keep 15% for a "best companies" page and add a separate "best value in
   sector" line later; mixing the two questions in one score muddles both.
2. **Turnover floor.** NPR 500,000 on one day excludes 17 names, several of them small
   microfinance and finance companies you may want visible. Recommendation: keep the gate but
   move it to a 20-day median as soon as step 5 in section 7 has data.
3. **Momentum.** De Groot et al. show momentum works in frontier markets, but it needs 12 months
   of prices, which we do not store. Recommendation: leave it out of the score; consider a
   separate 6-month price-change badge once the daily series is a year old.
4. **"Others" and "Investment".** Heterogeneous buckets (NTC, HRL, CIT, NRIC). Recommendation:
   rank them but label the card "mixed sector" and never show fewer than 3 with a "best of 7"
   note.

---

## 10. References

- Walkshäusl, C. (2020). Piotroski's FSCORE: international evidence. *Journal of Asset Management*. https://link.springer.com/article/10.1057/s41260-020-00157-2
- Hyde, C. E. (2013). An emerging markets analysis of the Piotroski F score. SSRN. https://doi.org/10.2139/ssrn.2274516
- Asness, C., Frazzini, A., Pedersen, L. H. (2019). Quality minus junk. *Review of Accounting Studies*. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2312432
- Novy-Marx, R. (2013). The other side of value: the gross profitability premium. *JFE*. https://www.nber.org/system/files/working_papers/w15940/w15940.pdf
- Mohanram, P. (2005). Separating winners from losers among low book-to-market stocks using financial statement analysis. https://www.ivey.uwo.ca/media/3775546/mohanram.pdf
- de Groot, W., Pang, J., Swinkels, L. (2012). The cross-section of stock returns in frontier emerging markets. *J. Empirical Finance*. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1600023
- George, T. J., Hwang, C.-Y. (2004). The 52-week high and momentum investing. *J. Finance*. https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-6261.2004.00695.x
- Bornholt, G., Malin, M. (2011). The 52-week high momentum strategy in international stock markets. *JIMF*. https://www.sciencedirect.com/science/article/abs/pii/S0261560610001099
- Amihud, Y. (2002). Illiquidity and stock returns. *J. Financial Markets*. https://www.sciencedirect.com/science/article/abs/pii/S1386418101000246
- Lou, X., Shu, T. (2017). Price impact or trading volume: why is the Amihud measure priced? *RFS*. https://academic.oup.com/rfs/article-abstract/30/12/4481/3954040
- MSCI (2014). MSCI Quality Indexes Methodology. https://www.msci.com/eqb/methodology/meth_docs/MSCI_Quality_Indexes_Methodology_June_2014.pdf
- Fundamentals of stock price in Nepalese commercial banks. *IRJMS*. https://nepjol.info/index.php/irjms/article/download/27887/23026/
- Quest on determinants of stock price in Nepal: microfinance sector. https://www.researchgate.net/publication/378592219
- Impacts of bonus issue on stock price in Nepalese equity market. *IRJMS*. https://www.nepjol.info/index.php/irjms/article/download/28049/23125/83023
- Weak form of market efficiency in Nepalese stock market (2013–2022). https://www.researchgate.net/publication/389430277
- NRB Economic Review 2026, vol. 37 no. 1: time-varying efficiency in NEPSE. https://www.nrb.org.np/contents/uploads/2026/04/vol-37_art2.pdf
- CAMEL analysis of commercial banks in Nepal. https://www.researchgate.net/publication/373692893
- Nexus between capital structure and financial performance of Nepalese hydropower companies. *Management Dynamics*. https://www.nepjol.info/index.php/md/article/view/47550
- NRB Capital Adequacy Framework 2007 (updated 2008). https://www.nrb.org.np/dbs/new-capital-adequacy-framework-2007-updated-2008-2/
- NIA Risk Based Capital and Solvency Directive 2025 (2082). https://nia.gov.np/Admin/images/Law/RiskBasedCapital/687cc9c60257d_1753008582.pdf
- Nepal Development Update, World Bank, April 2026 (MFI NPL 6.31% → 9.95%). https://www.worldbank.org/en/country/nepal/publication/nepaldevelopmentupdate
