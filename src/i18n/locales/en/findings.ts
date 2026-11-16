/** Risk findings ("what needs your attention"). Templates are filled by src/lib/findingText.ts. */
export default {
  sevHigh: "Urgent",
  sevMedium: "Check this",
  sevLow: "Good to know",
  sevInfo: "Note",
  empty: "Nothing needs your attention right now.",
  seeDetail: "See the detail",

  fund_concentration_title: "{weight}% of your portfolio is in one fund, {symbol}",
  fund_concentration_detail:
    "A mutual fund already holds many companies, so this is not the risk of one company. It does mean a big part of your money depends on one fund manager's choices.",

  concentration_title: "{weight}% of your portfolio is in one share, {symbol}",
  concentration_detail:
    "When one share is more than {threshold}% of your money, a bad year for that one company becomes a bad year for your whole portfolio.",

  risk_heavy_title: "{symbol} has {weight}% of your money but causes {risk}% of your ups and downs",
  risk_heavy_detail:
    "It swings more than your other shares, or moves together with them, so it moves your portfolio more than its size suggests.",

  sector_risk_title: "{risk}% of your portfolio's ups and downs come from {sector}",
  sector_risk_detail:
    "This sector holds {weight}% of your money. Shares in one sector usually fall together, so owning more companies from the same sector does not lower this.",

  correlated_pair_title: "{a} and {b} rise and fall together (correlation {corr})",
  correlated_pair_detail: "Owning both spreads your risk very little. Together they behave almost like one share.",

  above_market_risk_title: "Your portfolio swings about {ratio} times as much as the market",
  above_market_risk_detail:
    "In a typical year it moves up or down by about {vol}%, against {market}% for the market. Bigger swings also mean bigger falls when the market drops.",

  few_effective_holdings_title: "Your portfolio behaves like only about {effective} equal-sized shares",
  few_effective_holdings_detail:
    "You own {holdings} shares, but most of your money sits in a few of them. Those few decide most of your profit or loss.",

  coverage_title: "Only {measured}% of your portfolio has enough price history to measure",
  coverage_detail:
    "The rest (mostly mutual funds and new listings) is estimated from the market or sector average, so read the risk numbers as rough guides.",

  vs_benchmark_title: "Your return is {xirr}% a year. The same deposits in the market index would have made {bench}%",
  vs_benchmark_detail_ahead:
    "This counts when you actually put money in, before dividends and fees. Your choice of shares, IPO allotments and timing have added to your return so far.",
  vs_benchmark_detail_behind:
    "This counts when you actually put money in, before dividends and fees. So far, a plain mix of all listed shares would have done better than your picks.",

  sector_commercialbank: "Commercial Bank",
  sector_developmentbank: "Development Bank",
  sector_microfinance: "Microfinance",
  sector_nonlifeinsurance: "Non-Life Insurance",
  sector_lifeinsurance: "Life Insurance",
  sector_hydropower: "Hydropower",
  sector_manufacturing: "Manufacturing",
  sector_hotels: "Hotels",
  sector_investment: "Investment",
  sector_trading: "Trading",
  sector_telecom: "Telecom",
  sector_mutualfund: "Mutual Fund",
  sector_finance: "Finance",
  sector_others: "Others",
};
