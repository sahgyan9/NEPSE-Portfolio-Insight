/**
 * Glossary text. Each term has <key>_title, <key>_text and, where useful, <key>_example.
 * Keys must match GLOSSARY_KEYS in src/lib/glossary.ts and the Nepali file.
 *
 * Sources for the numbers stated below (checked 2026-11-15):
 * - Broker commission slabs and SEBON fee 0.015%: Stock Broker and Dealer Regulations 2064, Schedules 14-15
 *   https://www.sebon.gov.np/uploads/2025/07/20/OJ8tAh1eKQ3NIzumdQNFIuEqt3tl6JZhmN2voBKd.pdf
 * - DP charge Rs. 25 per transfer, on buy and sell: CDS Byelaws 2068, Schedule 14
 *   https://cdsc.com.np/downloads_files/2023_11_20_14_15_51_धितोपत्र केन्द्रिय निक्षेप सेवा विनियमावली ,२०६८ (छैठौ संशोधन सहित).pdf
 * - T+2 settlement: CDSC Clearing and Settlement Byelaws 2069, Rule 13(1)
 *   https://cdsc.com.np/downloads_files/2022_09_01_11_44_58_धितोपत्र कारोवार राफसाफ तथा फछ्र्यौट विनियमावली, २०६९ (पाँचौं संशोधन सहित ).pdf
 * - Promoter lock-in 3 years, no lock-in on ordinary IPO shares: Securities Registration and Issue Regulations 2073, Rule 38(1)
 *   https://www.sebon.gov.np/uploads/2023/09/24/4J6mY5hhWf86mzkHVzIcr83TG8g8YYLpz5miKJrt.pdf
 * - EDIS definition: CDSC Mode of operation for EDIS directive
 *   https://cdsc.com.np/downloads_files/2018_10_04_08_33_07_mode_of_operation_for_edis_directive.pdf
 * - CAR minimum 11% for commercial banks: NRB Unified Directive 2082, Directive 1
 *   https://www.nrb.org.np/contents/uploads/2026/01/Unified-Directive-ABC-2082.pdf
 *   (Capital Adequacy Framework: "Minimum Total Capital Ratio plus Capital Conservation Buffer 11.0";
 *   10% total capital fund for class B and C, 11% for national-level class B, as in src/data/researchGuide.ts)
 * - Microfinance CAR minimum 8% (core capital 4%): NRB Unified Directive 2082 for class D, Directive 1(1)
 *   https://www.nrb.org.np/contents/uploads/2026/01/MFI-Unified-Directive-2082.pdf
 * - Promoter group keeps at least 51% when promoter shares are turned into public shares (banks,
 *   finance companies, microfinance): NRB Unified Directive 2082, Directive 9 (class A/B/C) and the
 *   class D directive, under Banks and Financial Institutions Act 2073, section 11(4). Same PDFs as above.
 * - Daily price limit 15% from the pre-open price, index halts 5% (first two hours, 15 minutes) and
 *   8% (closed for the day): NEPSE Securities Trading Operation (Fourth Amendment) Regulations 2082,
 *   rules 12 and 17, in force from 2083/01/07 (20 April 2026) by NEPSE notice ref. 082/83 no. 1637
 *   dated 2083/01/04. Both documents are attached to the notices at https://www.nepalstock.com/notices
 *   (file https://www.nepalstock.com/api/nots/news/notice/fetchFiles/5dd1a5756a83e72ba11df84b1a5bc75c.pdf).
 * - Trading Monday to Friday: NEPSE notice ref. 082/83 no. 1569 dated 2082/12/25, same notices page
 *   (file https://www.nepalstock.com/api/nots/news/notice/fetchFiles/7bb1f07da6d4c27511e1cbbfdb984895.pdf).
 * - Face value Rs. 100 (NABIL) and Rs. 10 per mutual fund unit, from NEPSE company pages
 *   https://www.nepalstock.com/company/detail/131  https://www.nepalstock.com/company/detail/2770
 * Capital gains tax rates changed in 2026 and could not be confirmed from an official text,
 * so the capital gains entry gives no rate.
 */
export default {
  ui_whatIs: "What does {term} mean?",
  ui_whatIsThis: "What does this mean?",
  ui_example: "Example",
  // ---- Risk and portfolio measures (existing terms) ----
  volatility_title: "Volatility (how much the price swings)",
  volatility_text: "How much the value typically swings in a year. 16% means a typical year ends within about 16% above or below the average.",
  volatility_example: "With Rs. 1,00,000 invested and 16% volatility, ending a normal year anywhere between about Rs. 84,000 and Rs. 1,16,000 would not be unusual.",
  volatilityVsMarket_title: "Volatility versus the market",
  volatilityVsMarket_text: "Your yearly swings divided by the NEPSE index's swings. 1.2x means your portfolio moves about 20% more than the market does.",
  volatilityVsMarket_example: "If NEPSE falls 10% in a month, a portfolio at 1.2x would typically fall about 12%: Rs. 12,000 on every Rs. 1,00,000.",
  maxDrawdown_title: "Worst historical drop",
  maxDrawdown_text: "The biggest fall from a high point to the next low point over the period measured. It shows how bad a bad stretch has been, not the worst that can happen.",
  maxDrawdown_example: "If your holdings were worth Rs. 2,00,000 at their peak and later fell to Rs. 1,40,000 before recovering, the worst drop was 30%.",
  var95_title: "A bad week (1 in 20)",
  var95_text: "In about 1 week out of every 20, the portfolio lost at least this much, judged by past weekly moves. Worse weeks are possible.",
  var95_example: "A figure of Rs. 8,000 means that roughly one week in twenty, the portfolio lost Rs. 8,000 or more.",
  cvar95_title: "Average of the bad weeks",
  cvar95_text: "Take the worst 1 in 20 weeks and average their losses. It tells you how bad the bad weeks are, not just where they start.",
  beta_title: "Beta (how closely you follow NEPSE)",
  beta_text: "How strongly you move with the NEPSE index. 1.0 moves with the market, above 1.0 moves more, below 1.0 moves less.",
  beta_example: "With a beta of 0.8, a 5% fall in NEPSE has typically meant about a 4% fall for you.",
  riskShare_title: "Share of risk",
  riskShare_text: "How much of your portfolio's ups and downs come from this holding or sector. If it is much bigger than its share of your money, it adds more risk than its size suggests.",
  weight_title: "Share of money",
  weight_text: "The percentage of your portfolio's current value held in this stock or sector.",
  weight_example: "Rs. 25,000 in one stock out of a Rs. 1,00,000 portfolio is a 25% share.",
  correlation_title: "Correlation (moving together)",
  correlation_text: "Whether two holdings tend to rise and fall together. Close to 1 means they move together and protect you little. Near 0 means unrelated. Below 0 means they tend to move in opposite directions.",
  correlation_example: "Two commercial banks often have a high correlation: when one falls on an NRB policy change, the other usually falls too.",
  diversificationRatio_title: "Diversification ratio",
  diversificationRatio_text: "How much calmer the whole portfolio is than its parts taken one by one. 1.0 means no benefit from holding several stocks; higher is better.",
  effectiveHoldings_title: "Effective holdings",
  effectiveHoldings_text: "The number of equally sized, unrelated stocks that would give the same spread of risk. If you own 20 stocks but this is 5, a few of them dominate.",
  xirr_title: "Money-weighted return (XIRR)",
  xirr_text: "Your yearly return given when you actually put money in. Money added later counts for less time than money added early. This is the fairest single number for a portfolio built over time.",
  xirr_example: "Rs. 50,000 invested two years ago and Rs. 50,000 last month are not treated the same: the first had two years to grow, the second only one month.",
  benchmarkXirr_title: "Same deposits in the index",
  benchmarkXirr_text: "What the same amounts, on the same dates, would have earned if put into the NEPSE index instead of these stocks.",
  return1y_title: "One-year return",
  return1y_text: "The price change over the last 52 weeks. It does not include dividends or bonus shares.",
  return1y_example: "A share that was Rs. 400 a year ago and is Rs. 440 today shows a 10% one-year return.",
  pe_title: "P/E ratio (price to earnings)",
  pe_text: "Price divided by yearly earnings per share. A P/E of 20 means you pay Rs. 20 for each Rs. 1 the company earns in a year. Compare it with similar companies, not with a fixed number.",
  pe_example: "Share price Rs. 500, EPS Rs. 25: P/E is 500 / 25 = 20.",
  sectorMedianPe_title: "Sector median P/E",
  sectorMedianPe_text: "The middle P/E among companies in the same sector. A stock far above it is priced richer than its peers.",
  sectorMedianPe_example: "If most commercial banks trade at a P/E near 15 and one trades at 30, buyers are paying twice as much for each rupee of its profit.",
  pb_title: "P/B or PBV ratio (price to book value)",
  pb_text: "Price divided by the company's net worth per share (book value). Below 1 means the market values it at less than its accounts say. Above 1 means buyers pay more than the accounts show.",
  pb_example: "Share price Rs. 450, book value per share Rs. 225: PBV is 450 / 225 = 2.",
  roe_title: "ROE (return on equity)",
  roe_text: "Profit as a percentage of shareholders' money. Higher means the company earns more from what owners have put in.",
  roe_example: "A bank with Rs. 1,000 crore of shareholders' money that earns Rs. 120 crore profit in a year has an ROE of 12%.",
  eps_title: "EPS (earnings per share)",
  eps_text: "The company's yearly profit divided by its number of shares. It shows how much profit belongs to each share.",
  eps_example: "Profit Rs. 50 crore, 2 crore shares: EPS is Rs. 25. If you own 100 kitta, Rs. 2,500 of that year's profit is your share, even if it is not paid to you.",
  ttmEps_title: "EPS for the last 12 months (TTM)",
  ttmEps_text: "Profit over the most recent 12 months divided by the number of shares. It is built from the last full year plus this year's quarters minus the same quarters a year ago, so it always covers a full year.",
  annualizedEps_title: "Annualized EPS",
  annualizedEps_text: "The year-to-date profit scaled up to a full year, the figure NEPSE sites show. After the first quarter it multiplies three months by four, so it overstates seasonal firms such as hydropower (the monsoon quarter earns the most) and understates a weak start. Prefer the 12-month figure.",
  annualizedEps_example: "A hydropower company earns Rs. 8 per share in the rainy first quarter. Annualized EPS shows Rs. 32, but the dry quarters may bring the real year to Rs. 18.",
  peAtCost_title: "P/E at your cost",
  peAtCost_text: "The price you paid per share divided by the last 12 months' EPS. It tells you how many years of today's profit it took to earn back what you paid. A lower number means you paid less for each rupee of profit.",
  peAtCost_example: "You paid Rs. 300 a share and EPS is Rs. 20: P/E at your cost is 15.",
  yieldOnCost_title: "Earnings yield on your cost",
  yieldOnCost_text: "The last 12 months' EPS divided by the price you paid. 5% means each rupee you put in earns 5 paisa of company profit a year. It is profit, not cash paid to you; dividends are usually a part of it.",
  yieldOnCost_example: "You paid Rs. 400 a share and EPS is Rs. 20: the earnings yield on your cost is 5%.",
  shareOfProfit_title: "Your share of yearly profit",
  shareOfProfit_text: "Your number of shares times the last 12 months' EPS. It is your slice of what the company earned, not money paid out to you.",
  shareOfProfit_example: "200 kitta with an EPS of Rs. 15 is Rs. 3,000 of company profit that belongs to you on paper.",
  dividendYield_title: "Dividend yield",
  dividendYield_text: "Cash dividend per year divided by the current price. Bonus shares are not counted here.",
  dividendYield_example: "A 10% cash dividend on a Rs. 100 face value is Rs. 10 a share. At a price of Rs. 500, the yield is 10 / 500 = 2%.",
  healthScore_title: "Health score",
  healthScore_text: "A 0 to 100 summary of five checks: structure, company fundamentals, valuation, dividends and volatility. It summarises current and past numbers; it does not predict anything.",
  sectorLeaders_title: "Quality screen",
  sectorLeaders_text: "Companies are ranked within their sector on profitability, growth, safety, payout and valuation. A backtest found no evidence that the ranking beats its sector's average return, so treat it as a list to research, not a list to buy.",
  growthOf100_title: "Growth of 100",
  growthOf100_text: "Shows what 100 rupees would have become if today's mix of holdings had been held through the period. It is a what-if from past prices, not your actual record.",
  growthOf100_example: "A line ending at 130 means Rs. 100 would have become Rs. 130.",
  proxied_title: "Estimated holdings",
  proxied_text: "Some holdings, mostly mutual funds, do not have enough price history. Their risk is estimated from similar holdings and they are drawn hollow where shown.",

  // ---- Basics ----
  shareKitta_title: "Share and kitta",
  shareKitta_text: "A share is a small piece of ownership in a company. In Nepal the number of shares is counted in kitta: 1 kitta is 1 share. Owning shares makes you a part-owner, with a claim on profit and a vote at the general meeting.",
  shareKitta_example: "If a company has 1 crore shares and you own 100 kitta, you own one part in 1,00,000 of the company.",
  faceValue_title: "Face value",
  faceValue_text: "The fixed value printed on each share when it is issued. Most NEPSE company shares have a face value of Rs. 100 and mutual fund units usually Rs. 10. Dividends are declared as a percentage of face value, not of the market price.",
  faceValue_example: "A 15% cash dividend on a Rs. 100 face value share is Rs. 15 a share, whether the share trades at Rs. 200 or Rs. 1,000.",
  ipo_title: "IPO (initial public offering)",
  ipo_text: "The first time a company sells its shares to the public. You apply through Meroshare and, if more people apply than there are shares, the shares are shared out by lottery. Shares you are allotted can be traded once the company is listed on NEPSE.",
  ipo_example: "You apply for 10 kitta at Rs. 100 each, so Rs. 1,000 is blocked in your bank account. If you are allotted, the Rs. 1,000 is used; if not, it is released.",
  fpo_title: "FPO (further public offering)",
  fpo_text: "A company that is already listed sells new shares to the public again. It raises more money, and the total number of shares goes up.",
  fpo_example: "A listed company with 1 crore shares sells 20 lakh more through an FPO. It now has 1.2 crore shares, so each old share is a slightly smaller piece of the company.",
  ltp_title: "LTP (last traded price)",
  ltp_text: "The price at which the most recent trade of a share happened. It is what most apps show as the current price. During trading hours it changes with every trade.",
  ltp_example: "If the last trade of NABIL was at Rs. 520, the LTP is Rs. 520, even if the next buyer is only willing to pay Rs. 518.",
  wacc_title: "WACC (your average cost per share)",
  wacc_text: "The average price you paid per share, counting every purchase, bonus shares and right shares. Meroshare calculates it, and your profit or loss is measured against it. It is recalculated when bonus or right shares arrive.",
  wacc_example: "You bought 10 kitta at Rs. 500 and 10 kitta at Rs. 300: your average cost is Rs. 8,000 / 20 = Rs. 400 a share.",
  marketCap_title: "Market capitalisation",
  marketCap_text: "The total market value of a company: share price times the number of shares. It shows how big the company is in the market's eyes, not how much money it has.",
  marketCap_example: "2 crore shares at Rs. 500 each give a market capitalisation of Rs. 1,000 crore.",
  paidUpCapital_title: "Paid-up capital",
  paidUpCapital_text: "The money shareholders have put into the company at face value: number of shares times face value. Bonus and right shares increase it. Regulators set minimum paid-up capital for banks and insurers.",
  paidUpCapital_example: "1 crore shares at Rs. 100 face value is Rs. 100 crore of paid-up capital. After a 10% bonus, it becomes Rs. 110 crore.",
  promoterShare_title: "Promoter share and public share",
  promoterShare_text: "Promoter shares belong to the founders and early investors; public (ordinary) shares are the ones sold to the public and traded every day. Promoter shares are traded separately from public shares, often at a lower price. When large amounts of promoter shares become sellable, extra supply can reach the market. For banks, finance companies and microfinance, Nepal Rastra Bank lets promoters turn their shares into public shares only while the promoter group keeps at least 51%.",
  promoterShare_example: "A bank may be 51% promoter and 49% public. As a retail investor you buy and sell the public shares.",
  lockIn_title: "Lock-in period",
  lockIn_text: "A period during which certain shares cannot be sold. Promoter shares cannot be sold for 3 years after the IPO allotment. Ordinary shares you receive in an IPO have no lock-in.",
  lockIn_example: "A company's IPO was allotted in Baisakh 2081. Its promoter shares could not be sold until about Baisakh 2084. Check the prospectus for exact dates.",
  settlementT2_title: "T+2 settlement",
  settlementT2_text: "After a trade, shares and money change hands two working days later. T is the trading day. Shares you buy reach your account on T+2, and money from a sale is settled on T+2, before your broker pays you.",
  settlementT2_example: "You buy on Monday (T). The shares reach your Meroshare account by Wednesday (T+2), if there is no holiday in between.",
  edis_title: "EDIS (transfer after selling)",
  edis_text: "EDIS is the electronic instruction you give in Meroshare after you sell, telling your depository to hand the sold shares to the buyer's side. Without it the shares stay in your account and the sale may not settle on time. Your broker tells you the deadline.",
  edis_example: "You sell 50 kitta of NICA through TMS. You then log in to Meroshare, open My EDIS, and confirm the transfer of those 50 kitta.",
  collateral_title: "Collateral (TMS trading limit)",
  collateral_text: "Money you deposit with your broker so that you can place buy orders in TMS. Your buying limit in TMS is set from it. It is not an investment by itself; it is a deposit that pays for your purchases.",
  collateral_example: "You load Rs. 50,000 as collateral. TMS lets you buy shares worth about that amount; after buying Rs. 30,000 of shares, about Rs. 20,000 of limit remains.",
  nepseIndex_title: "NEPSE index",
  nepseIndex_text: "One number that tracks the prices of all ordinary shares listed on NEPSE, weighted by company size. When people say the market went up, they usually mean this index rose. Large companies, such as big banks, move it most.",
  nepseIndex_example: "If the index moves from 2,600 to 2,652, it has risen 2%. Your own shares may have done better or worse.",
  sectorIndex_title: "Sector index",
  sectorIndex_text: "Like the NEPSE index, but for one group of companies, such as banking, hydropower or life insurance. It shows whether a whole sector is rising or falling.",
  sectorIndex_example: "If the hydropower index is down 8% this month and your hydropower stock is down 8% too, the fall is about the sector, not only your company.",
  nav_title: "NAV (mutual fund net asset value)",
  nav_text: "What one unit of a mutual fund is worth based on what the fund owns, after its costs. Fund managers publish it regularly. A closed-end fund listed on NEPSE can trade above or below its NAV.",
  nav_example: "A fund unit has a NAV of Rs. 11.50 but trades on NEPSE at Rs. 9.80. Buyers are paying less than the fund's holdings are worth per unit.",
  unrealisedGain_title: "Unrealised and realised gain",
  unrealisedGain_text: "Unrealised gain is profit on paper on shares you still hold; it can change or disappear tomorrow. Realised gain is profit you have locked in by selling. Tax applies only when you sell.",
  unrealisedGain_example: "You bought at Rs. 300 and the price is Rs. 360: Rs. 60 a share is unrealised. If you sell at Rs. 360, it becomes realised, before costs and tax.",

  // ---- Dividends and corporate actions ----
  cashDividend_title: "Cash dividend",
  cashDividend_text: "Part of the profit that the company pays to shareholders in money. It is declared as a percentage of face value. Tax is deducted before it reaches your bank account.",
  cashDividend_example: "A 12% cash dividend on Rs. 100 face value is Rs. 12 a share. With 200 kitta you are due Rs. 2,400 before tax.",
  bonusShare_title: "Bonus share",
  bonusShare_text: "Free extra shares a company gives to existing shareholders instead of cash. You get more kitta, but the company's value does not grow because of it, so the price is adjusted down. Part of a declared cash dividend often goes to pay the tax on the bonus shares.",
  bonusShare_example: "A 20% bonus on 100 kitta gives you 20 more kitta, so you hold 120 kitta.",
  rightShare_title: "Right share (हकप्रद सेयर)",
  rightShare_text: "New shares offered only to existing shareholders, in proportion to what they hold, usually at Rs. 100 each. You must apply and pay through Meroshare before the deadline. If you do not, you keep your old shares, but after the price adjustment they are worth less.",
  rightShare_example: "A 1:1 right on 100 kitta lets you buy 100 more kitta at Rs. 100 each, paying Rs. 10,000.",
  bookClosure_title: "Book closure",
  bookClosure_text: "The date on which the company fixes its list of shareholders for a dividend, bonus, right share or general meeting. To be on the list, the shares must be settled in your account by then. Shares take two working days to settle, so the last day to buy is a few days earlier; your broker can confirm it.",
  bookClosure_example: "A company announces a 10% bonus with book closure on 15 Poush. Shares bought one day before that will not have settled in time and will not get the bonus.",
  priceAdjustment_title: "Price adjustment after book closure",
  priceAdjustment_text: "After book closure for a bonus or right share, NEPSE lowers the share price by a formula so that the total value of your holding stays about the same. You have more kitta at a lower price. It is not a loss, even though the price on screen drops.",
  priceAdjustment_example: "Price Rs. 600 before a 20% bonus. Adjusted price: 600 / 1.2 = Rs. 500. 100 kitta at Rs. 600 = Rs. 60,000; 120 kitta at Rs. 500 = Rs. 60,000.",

  // ---- Company numbers ----
  bookValue_title: "Book value (net worth per share)",
  bookValue_text: "What each share would be worth if the company's assets were used to pay all its debts and the rest were shared out, using the values in its accounts. It is also called net worth per share. Compare it with the price to see how much the market pays above or below the accounts.",
  bookValue_example: "Net worth Rs. 300 crore and 1.5 crore shares: book value is Rs. 200 a share.",
  npl_title: "NPL (non-performing loans, bad loans)",
  npl_text: "The share of a bank's loans where borrowers have stopped paying on time. Higher NPL means more loans may never be repaid, which eats into profit and dividends. Banks report it every quarter.",
  npl_example: "A bank has lent Rs. 1,000 crore and Rs. 40 crore is not being repaid on time: NPL is 4%.",
  car_title: "CAR (capital adequacy ratio)",
  car_text: "How much of its own capital a bank holds against the risk in its loans. Nepal Rastra Bank sets a minimum: 11% for commercial banks, 10% for development banks and finance companies (11% for national-level development banks), and 8% for microfinance. A bank close to the minimum may have to hold back cash dividends or slow its lending.",
  car_example: "A commercial bank with a CAR of 11.3% has only 0.3 points of room above the 11% minimum.",

  // ---- Costs and tax ----
  brokerCommission_title: "Broker commission",
  brokerCommission_text: "A fee you pay your broker on every buy and every sale. It is a percentage of the trade value, lower for bigger trades: 0.36% up to Rs. 50,000, then 0.33%, 0.31%, 0.27% and 0.24% for trades above Rs. 1 crore, with a minimum of Rs. 10. A SEBON fee of 0.015% is added to each trade.",
  brokerCommission_example: "Buying Rs. 40,000 of shares: commission Rs. 144 (0.36%), SEBON fee Rs. 6, and a DP charge of Rs. 25. You pay about Rs. 40,175.",
  dpCharge_title: "DP charge",
  dpCharge_text: "A fee of Rs. 25 that your depository participant (the one that runs your Meroshare account) charges when shares move into or out of your account after a buy or a sale. It is the same for a small trade as for a big one, so it weighs more on small trades.",
  dpCharge_example: "On a Rs. 2,000 trade, Rs. 25 is over 1% of the value. On a Rs. 2,00,000 trade it is barely noticeable.",
  capitalGainsTax_title: "Capital gains tax",
  capitalGainsTax_text: "Tax on the profit you make when you sell shares for more than you paid. It is deducted at the time of sale, through your broker, and the rate depends on how long you held the shares. The rates have changed in recent years; check the current rate with your broker or the Inland Revenue Department.",
  capitalGainsTax_example: "You bought 100 kitta at Rs. 300 and sell at Rs. 400. Before costs, the gain is Rs. 10,000, and the tax is a percentage of that Rs. 10,000, not of the whole Rs. 40,000.",

  // ---- Risk ----
  circuitBreaker_title: "Circuit breaker (trading halt)",
  circuitBreaker_text: "Automatic limits that stop prices moving too far in one day. Since April 2026, a share's price can move at most 15% up or down from its opening price that day. If the NEPSE index moves 5% within the first two hours of trading, the whole market stops for 15 minutes. If it moves 8% at any time, trading stops for the rest of the day.",
  circuitBreaker_example: "A share that opens at Rs. 400 can trade only between Rs. 340 and Rs. 460 that day. A share hitting its upper limit can show many buy orders and no sellers. That shows heavy demand on that day, not that the company has become more valuable.",
  diversification_title: "Diversification (spreading risk)",
  diversification_text: "Spreading your money over different companies and sectors so that one bad event does not hit everything. Ten banks are less diversified than banks, hydropower, insurance and a mutual fund together, because banks tend to move together.",
  diversification_example: "With Rs. 1,00,000 in one hydropower company, a flood at its plant hurts all of it. Spread over five sectors, the same event would touch about Rs. 20,000.",
  operatorActivity_title: "Operator activity and pump-and-dump",
  operatorActivity_text: "A group buys a thinly traded share among themselves to push the price and volume up, attracts new buyers with rumours, and then sells to them at the top. The price usually falls back fast and late buyers are left with the loss. Small companies with few public shares are the easiest to move this way.",
  operatorActivity_example: "A small company's price rises from Rs. 300 to Rs. 900 in a few weeks with no new report or news. Then it falls back to Rs. 400. People who bought at Rs. 850 lose about half.",
  socialTip_title: "Tips from social media",
  socialTip_text: "Messages on Facebook, TikTok, Telegram or Viber saying a share will go up. The sender may already own the share and want buyers. Before acting, check the company's latest quarterly report and any official notice on NEPSE or the company's website.",
  socialTip_example: "A post says a company will announce a 40% bonus next week. Check NEPSE's notices: if no board decision has been published, it is only a rumour.",
};
