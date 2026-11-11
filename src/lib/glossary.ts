/** Plain-language definitions shown by the Explain popover. */
export const GLOSSARY = {
  volatility: {
    title: "Volatility",
    text: "How much the value typically swings in a year. 16% means a typical year ends within about 16% above or below the average.",
  },
  volatilityVsMarket: {
    title: "Volatility versus the market",
    text: "Your yearly swings divided by the NEPSE index's swings. 1.2x means your portfolio moves about 20% more than the market does.",
  },
  maxDrawdown: {
    title: "Worst historical drop",
    text: "The biggest fall from a high point to the next low point over the period measured. It shows how bad a bad stretch has been, not the worst that can happen.",
  },
  var95: {
    title: "A bad week (1 in 20)",
    text: "In about 1 week out of every 20, the portfolio lost at least this much, judged by past weekly moves. Worse weeks are possible.",
  },
  cvar95: {
    title: "Average of the bad weeks",
    text: "Take the worst 1 in 20 weeks and average their losses. It tells you how bad the bad weeks are, not just where they start.",
  },
  beta: {
    title: "Beta",
    text: "How strongly you move with the NEPSE index. 1.0 moves with the market, above 1.0 moves more, below 1.0 moves less.",
  },
  riskShare: {
    title: "Share of risk",
    text: "How much of your portfolio's ups and downs come from this holding or sector. If it is much bigger than its share of your money, it adds more risk than its size suggests.",
  },
  weight: {
    title: "Share of money",
    text: "The percentage of your portfolio's current value held in this stock or sector.",
  },
  correlation: {
    title: "Correlation",
    text: "Whether two holdings tend to rise and fall together. Close to 1 means they move together and protect you little. Near 0 means unrelated. Below 0 means they tend to move in opposite directions.",
  },
  diversificationRatio: {
    title: "Diversification ratio",
    text: "How much calmer the whole portfolio is than its parts taken one by one. 1.0 means no benefit from holding several stocks; higher is better.",
  },
  effectiveHoldings: {
    title: "Effective holdings",
    text: "The number of equally sized, unrelated stocks that would give the same spread of risk. If you own 20 stocks but this is 5, a few of them dominate.",
  },
  xirr: {
    title: "Money-weighted return",
    text: "Your yearly return given when you actually put money in. Money added later counts for less time than money added early. This is the fairest single number for a portfolio built over time.",
  },
  benchmarkXirr: {
    title: "Same deposits in the index",
    text: "What the same amounts, on the same dates, would have earned if put into the NEPSE index instead of these stocks.",
  },
  return1y: {
    title: "One-year return",
    text: "The price change over the last 52 weeks. It does not include dividends or bonus shares.",
  },
  pe: {
    title: "P/E ratio",
    text: "Price divided by yearly earnings per share. A P/E of 20 means you pay Rs. 20 for each Rs. 1 the company earns in a year. Compare it with similar companies, not with a fixed number.",
  },
  sectorMedianPe: {
    title: "Sector median P/E",
    text: "The middle P/E among companies in the same sector. A stock far above it is priced richer than its peers.",
  },
  pb: {
    title: "P/B ratio",
    text: "Price divided by the company's net worth per share (book value). Below 1 means the market values it at less than its accounts say.",
  },
  roe: {
    title: "Return on equity",
    text: "Profit as a percentage of shareholders' money. Higher means the company earns more from what owners have put in.",
  },
  eps: {
    title: "Earnings per share",
    text: "The company's profit divided by its number of shares.",
  },
  dividendYield: {
    title: "Dividend yield",
    text: "Cash dividend per year divided by the current price. Bonus shares are not counted here.",
  },
  healthScore: {
    title: "Health score",
    text: "A 0 to 100 summary of five checks: structure, company fundamentals, valuation, dividends and volatility. It summarises current and past numbers; it does not predict anything.",
  },
  sectorLeaders: {
    title: "Quality screen",
    text: "Companies are ranked within their sector on profitability, growth, safety, payout and valuation. A backtest found no evidence that the ranking beats its sector's average return, so treat it as a list to research, not a list to buy.",
  },
  growthOf100: {
    title: "Growth of 100",
    text: "Shows what 100 rupees would have become if today's mix of holdings had been held through the period. It is a what-if from past prices, not your actual record.",
  },
  proxied: {
    title: "Estimated holdings",
    text: "Some holdings, mostly mutual funds, do not have enough price history. Their risk is estimated from similar holdings and they are drawn hollow where shown.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
