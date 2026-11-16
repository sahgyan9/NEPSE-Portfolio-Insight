/**
 * Portfolio health card (PortfolioHealthScore). Sentences are filled by src/lib/healthText.ts
 * from the `code` and `params` that tools/portfolio_health.py sends with each line.
 * Regulatory figures (CAR minimum, 90% CD ratio cap, 51% promoter rule, margin lending) were checked
 * 2026-11-15; the NRB documents are cited next to each check in tools/portfolio_health.py.
 */
export default {
  checksTitle: "Things to check",
  gradeAria: "Grade {grade}, score {score} out of 100",

  // The five pillars (server, key = pillar id)
  pillar_structure_name: "Spread of your money",
  pillar_structure_desc: "How evenly your money is spread across companies and sectors.",
  pillar_fundamentals_name: "Company finances",
  pillar_fundamentals_desc:
    "Checks that suit each sector: capital, lending and cost of funds for banks, debt for hydropower, profit for the rest.",
  pillar_valuation_name: "Price compared with earnings",
  pillar_valuation_desc: "Whether share prices look high or low against profit (P/E), book value (P/B) and profit growth.",
  pillar_dividend_name: "Dividends",
  pillar_dividend_desc:
    "How much cash dividend you get for the price, and whether companies giving bonus shares earn well on their capital.",
  pillar_volatility_name: "Price swings and falls",
  pillar_volatility_desc: "How much your mix swings compared with the market, and the deepest fall it took in the past.",

  // Pillars when the server is not reachable (worked out in the browser, key = indicator id)
  client_diversification_name: "Spread across companies",
  client_diversification_desc: "How evenly your money is spread across different companies.",
  client_valuation_name: "Price compared with value",
  client_valuation_desc: "Average valuation score of your holdings.",
  client_dividendQuality_name: "Dividends",
  client_dividendQuality_desc: "How much income your holdings pay as dividends.",
  client_concentration_name: "Not too much in one company",
  client_concentration_desc: "Risk from having a large share of your money in one company.",
  client_sectorBalance_name: "Spread across sectors",
  client_sectorBalance_desc: "How your money is spread across market sectors.",

  // Strong points
  s_concentration_ok: "No single company holds more than {limit}% of your money.",
  s_sectors_spread: "Your money is spread across {sectors} sectors.",
  s_fundamentals_strong: "Most of your money is in companies that earn well on their capital.",
  s_valuation_reasonable: "Overall, your shares are priced reasonably for the profit they make.",
  s_high_yield: "At today's prices, every Rs. 100 of your shares pays about Rs. {yield} a year in cash dividends.",
  s_low_volatility: "Your portfolio swings less than the market (about {ratio} times the market's swings).",

  // Worth a closer look
  w_concentration:
    "{symbol} is {weight}% of your portfolio, above the {limit}% this check allows. If that one company has a bad year, your whole portfolio feels it.",
  w_few_sectors:
    "Your money is in just {sectors} of the market's sectors. Bad news for one sector can hit most of your money at once.",
  w_car_low:
    "{symbol} has a capital adequacy ratio (CAR) of {car}%, below the {threshold}% minimum that Nepal Rastra Bank sets for a {sector}. A bank or microfinance below the minimum can be stopped from paying dividends.",
  w_cd_high_bank:
    "{symbol} has lent out {cd}% of its deposits (CD ratio), which is very high. As of November 2026, Nepal Rastra Bank caps this ratio at 90% for banks. A bank at or above the cap has little room for new loans, and its interest income can suffer.",
  w_cd_high_mfi:
    "{symbol} has a CD ratio of {cd}%, high for a microfinance. It lends much more than it collects in deposits and depends on loans from banks.",
  w_cof_high:
    "{symbol} pays {cof}% on the money it collects and borrows (cost of funds). That is very high and leaves less room for profit.",
  w_npl_high:
    "{npl}% of {symbol}'s loans are bad loans (NPL), above the {threshold}% this check treats as high. Bad loans need money set aside, which cuts profit and dividends.",
  w_de_high:
    "{symbol} has Rs. {de} of debt for every Rs. 1 of its own capital (debt to equity), above this check's line of {limit}. The interest is due even in the dry season, when hydropower earns less.",
  w_promoter_low:
    "Promoters own only {promoter}% of {symbol}, low for its sector. When promoters own less, they have less of their own money riding on how the company is run.",
  w_liquidity_low:
    "Over the last 120 days only about {volume} {symbol} shares traded per day. With so little trading, a large order can take long to fill and can move the price.",
  w_pe_premium:
    "{symbol} has a P/E of {pe}, more than 1.5 times the {sector} median of {sectorPe}. A high price for its profit leaves less room if results disappoint.",
  w_valuation_high: "Overall, your shares are priced high compared with their profit.",
  w_bonus_low_roe:
    "{symbol} earns only {roe}% on shareholders' money (ROE) but gives bonus shares. Bonus shares spread the same profit over more shares.",
  w_risk_finding: "{title}. {detail}",
  w_below_cost: "Your portfolio is worth {loss}% less than the total you put in.",
  w_margin_cap:
    "Your holding in {symbol} is worth {value}. As of November 2026, Nepal Rastra Bank sets no fixed limit on how much one person can borrow against shares (margin loan). A bank lends at most 70% of the shares' value (80% for shares of companies it rates as strong), and each bank sets its own limits.",

  // Things to check
  r_concentration:
    "{symbol} is about {shares} shares ({amount}) above {target}% of your portfolio. Check whether you are comfortable with that much money in one company.",
  r_few_sectors:
    "Most of your money is in few sectors. A portfolio spread across more sectors is less exposed to one sector's bad news.",
  r_car_low:
    "{symbol}'s CAR is {car}%. Check the next quarterly reports to see whether it is rising, and look for any Nepal Rastra Bank notice about {symbol}'s capital.",
  r_cd_high_bank:
    "{symbol}'s CD ratio is {cd}%. A bank that has lent out almost all its deposits has less room to grow its loans. Check how this ratio moves in the next quarterly reports.",
  r_cd_high_mfi:
    "Check {symbol}'s cost of funds (COF) in the quarterly report. Money borrowed from banks costs more, and that cost cuts into profit.",
  r_npl_high:
    "Check in {symbol}'s quarterly report how much of its bad loans is already covered by provisions (money set aside for losses).",
  r_de_high:
    "Hydropower companies with heavy debt lose more of their income to interest. Check the debt level in the latest quarterly report.",
  r_promoter_low:
    "Check {symbol}'s notices to see whether promoters have reduced their stake, and whether management has changed recently.",
  r_promoter_low_bfi:
    "Nepal Rastra Bank lets promoters of banks, finance companies and microfinance turn their shares into public shares only while the promoter group keeps at least 51%. Check {symbol}'s notices to see why the promoter share is lower, and whether management has changed recently.",
  r_liquidity_low:
    "Only about {volume} {symbol} shares trade on a normal day. Check the daily volume before a large order: it can take days to fill, and the price can move while it does.",
  r_pe_premium:
    "Check why {symbol} is priced above its peers in the {sector} sector, and whether its earnings support that price.",
  r_valuation_high:
    "Some holdings are priced very high compared with their earnings and book value. Prices like that fall harder when results disappoint.",
  r_bonus_low_roe:
    "{symbol} earns {roe}% on its shareholders' money but still gives bonus shares. Bonus shares raise the share count; check whether profit grows fast enough to keep EPS from falling.",
  r_margin_cap:
    "If you borrow against your {symbol} shares, ask your bank how much it lends against them. If the price falls, the bank can ask you for more collateral or sell the shares.",

  // Summary paragraph
  sum_grade: "Your portfolio gets grade {grade}, with a health score of {score} out of 100.",
  sum_level_high: "Overall the companies look financially strong, profitable and reasonably priced.",
  sum_level_mid:
    "Overall health is middling. Some holdings carry high debt or high prices, so they are worth watching.",
  sum_level_low:
    "Overall risk is high. Several large holdings show weak capital, bad loans or too much money in one place.",
  sum_structure: "The spread of your money scores {score} out of 100.",
  sum_concentrated: "The main issue is how much is in {symbol} ({weight}%).",
  sum_concentration_ok: "No single company takes too much of your money.",
  sum_fund_bank_hydro:
    "Company finances score {score} out of 100, pulled down by low capital (CAR) in banks and high debt in hydropower.",
  sum_fund_bank: "Company finances score {score} out of 100, pulled down by low capital (CAR) or bad loans in your banks.",
  sum_fund_hydro: "Company finances score {score} out of 100, pulled down by high debt in your hydropower companies.",
  sum_fund_clean:
    "Company finances score {score} out of 100, with healthy profit and no major balance sheet problems found.",

  // Lines worked out in the browser when the server is not reachable
  c_well_diversified: "Your money is spread across many companies, which lowers risk.",
  c_concentration_high: "A large part of your money is in a few companies.",
  c_add_stocks: "Your money sits in few companies. Check how much one company's bad news would cost you.",
  c_well_valued: "Your holdings are generally priced reasonably for their value.",
  c_overvalued: "Several holdings look expensive for their profit and book value.",
  c_review_valuation: "Check the P/E and P/B of your most expensive holdings, and whether their profit supports the price.",
  c_dividend_strong: "Your holdings pay a good cash dividend.",
  c_single_stock: "One company makes up {weight}% of your portfolio.",
  c_reduce_largest: "Check whether you are comfortable with that much money in your largest holding.",
  c_good_sectors: "Your money is spread across many sectors.",
  c_limited_sectors: "Your money is in only a few sectors.",
  c_add_sectors: "Bad news for one sector can hit most of your money at once. Check how your sectors add up.",
};
