export interface StockHolding {
  sn: number;
  scrip: string;
  fullName: string;
  sector: string;
  quantity: number;
  waccRate: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  pbRatio: number | null;
  peRatio: number | null;
  eps: number | null;
  bookValue: number | null;
  dividendYield: number | null;
  lastModified: string;
  // Dividend tracking
  latestDividendPercent?: number | null;
  dividendIncome?: number;  // Calculated cash dividend income in Rs.
  totalDividendReceived?: number;  // Cumulative dividends received
  latestDividendFiscalYear?: string | null;  // e.g. "082-083" or "081-082"
  latestDividendSource?: 'auto' | 'manual' | 'manual-override' | null;
  // Bonus share tracking
  latestBonusRatio?: string | null;  // e.g., "1:1", "7:1"
  bonusShares?: number;  // Number of bonus shares to receive
  bonusShareValue?: number;  // Value of bonus shares at current price
  bonusPercent?: number | null;  // Bonus share percentage (e.g. 10.0)
  totalDividendPercent?: number | null;  // Combined bonus % + cash %
  totalDividendValue?: number;  // Total dividend monetary value (Cash Rs + Bonus share value)
  // Derived metrics
  grahamNumber?: number | null;
  earningsYield?: number | null;
  pegRatio?: number | null;
  debtToEquity?: number | null;
  netInterestMargin?: number | null;
  dupontNetMargin?: number | null;
  dupontAssetTurnover?: number | null;
  dupontEquityMultiplier?: number | null;
  dupontRoe?: number | null;
  operatingProfitMargin?: number | null;
  revenuePerShare?: number | null;
  qoqProfitMomentum?: number | null;
  loanToAsset?: number | null;
  efficiencyRatio?: number | null;
  interestCoverage?: number | null;
  fixedAssetTurnover?: number | null;
  investmentYield?: number | null;
  combinedRatio?: number | null;
  high52?: number | null;
  low52?: number | null;
  promoterHolding?: number | null;
  publicFloat?: number | null;
  avgVolume120d?: number | null;
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalHoldings: number;
  profitableHoldings: number;
  unprofitableHoldings: number;
  // Dividend tracking
  totalDividendIncome?: number;  // Total cash dividend income across portfolio
  totalBonusValue?: number;  // Total value of bonus shares received (for reference only)
  netGrowth?: number;  // Total Gain/Loss + Cash Dividend Income (bonus shares already in portfolio value)
  netGrowthPercent?: number;  // Net growth as percentage of invested
}
