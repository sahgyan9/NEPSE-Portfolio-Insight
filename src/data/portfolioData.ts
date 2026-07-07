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
  // Bonus share tracking
  latestBonusRatio?: string | null;  // e.g., "1:1", "7:1"
  bonusShares?: number;  // Number of bonus shares to receive
  bonusShareValue?: number;  // Value of bonus shares at current price
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

/**
 * Company Information Registry
 * 
 * IMPORTANT: This data has been verified against ShareBazaar API on 2025-11-30.
 * The live app uses the useLivePortfolio hook which fetches names from the API,
 * but this serves as a fallback and provides sector classification.
 * 
 * Data Source: https://sharebazaar.vercel.app/api?symbol={SYMBOL}
 * 
 * Note: Some stocks had incorrect names before (e.g., BHL was "Bottlers Nepal" 
 * but is actually "Balephi Hydropower Limited"). All names are now corrected.
 */
const companyInfo: Record<string, { fullName: string; sector: string }> = {
  // === HYDROPOWER SECTOR ===
  BHL: { fullName: "Balephi Hydropower Limited", sector: "Hydropower" },
  CHCL: { fullName: "Chilime Hydropower Company Limited", sector: "Hydropower" },
  SAHAS: { fullName: "Sahas Urja Limited", sector: "Hydropower" },
  SGHC: { fullName: "Swet-Ganga Hydropower & Construction Limited", sector: "Hydropower" },
  UPPER: { fullName: "Upper Tamakoshi Hydropower Ltd.", sector: "Hydropower" },

  // === COMMERCIAL BANKS ===
  HBL: { fullName: "Himalayan Bank Limited", sector: "Commercial Bank" },
  NABIL: { fullName: "Nabil Bank Limited", sector: "Commercial Bank" },
  NICA: { fullName: "NIC Asia Bank Ltd.", sector: "Commercial Bank" },
  NIMB: { fullName: "Nepal Investment Mega Bank Limited", sector: "Commercial Bank" },

  // === MICROFINANCE ===
  CBBL: { fullName: "Chhimek Laghubitta Bittiya Sanstha Limited", sector: "Microfinance" },

  // === LIFE INSURANCE ===
  CLI: { fullName: "Citizen Life Insurance Company Limited", sector: "Life Insurance" },
  SNLI: { fullName: "Sun Nepal Life Insurance Company Limited", sector: "Life Insurance" },

  // === NON-LIFE INSURANCE / REINSURANCE ===
  HRL: { fullName: "Himalayan Reinsurance Limited", sector: "Non-Life Insurance" },

  // === MANUFACTURING ===
  HDL: { fullName: "Himalayan Distillery Limited", sector: "Manufacturing" },
  GCIL: { fullName: "Ghorahi Cement Industry Limited", sector: "Manufacturing" },
  SARBTM: { fullName: "Sarbottam Cement Limited", sector: "Manufacturing" },

  // === TRADING / OIL & GAS ===
  SONA: { fullName: "Sonapur Minerals And Oil Limited", sector: "Trading" },

  // === TELECOM ===
  NTC: { fullName: "Nepal Doorsanchar Company Limited", sector: "Telecom" },

  // === MUTUAL FUNDS ===
  CSY: { fullName: "Citizens Super Yield Fund", sector: "Mutual Fund" },
  KDBY: { fullName: "Kumari Dhanabriddhi Yojana", sector: "Mutual Fund" },
  MMF1: { fullName: "Mahila Sambriddhi Kosh", sector: "Mutual Fund" },
  NBF3: { fullName: "Nabil Balanced Fund 3", sector: "Mutual Fund" },
  NIBLSF: { fullName: "NIBL Samriddhi Fund", sector: "Mutual Fund" },
  NMBSBFE: { fullName: "NMB Saral Bachat Fund - E", sector: "Mutual Fund" },
};

// Fundamental data - P/B ratio is calculated dynamically from LTP/bookValue
const fundamentalData: Record<string, { peRatio: number | null; eps: number | null; bookValue: number; dividendYield: number }> = {
  BHL: { peRatio: 15.2, eps: 12.0, bookValue: 86.8, dividendYield: 3.5 },
  CBBL: { peRatio: 12.5, eps: 83.0, bookValue: 576.5, dividendYield: 2.8 },
  CHCL: { peRatio: 18.7, eps: 27.0, bookValue: 158.0, dividendYield: 4.2 },
  CLI: { peRatio: 10.8, eps: 45.9, bookValue: 330.7, dividendYield: 2.5 },
  CSY: { peRatio: null, eps: null, bookValue: 10.53, dividendYield: 0 },
  GCIL: { peRatio: 22.1, eps: 20.6, bookValue: 189.3, dividendYield: 1.8 },
  HBL: { peRatio: 8.2, eps: 24.3, bookValue: 234.0, dividendYield: 5.2 },
  HDL: { peRatio: 25.3, eps: 47.8, bookValue: 115.33, dividendYield: 3.0 },
  HRL: { peRatio: 14.5, eps: 60.0, bookValue: 310.7, dividendYield: 2.2 },
  KDBY: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
  MMF1: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
  NABIL: { peRatio: 9.5, eps: 54.2, bookValue: 429.1, dividendYield: 4.8 },
  NBF3: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
  NIBLSF: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
  NICA: { peRatio: 7.8, eps: 42.9, bookValue: 372.1, dividendYield: 4.5 },
  NIMB: { peRatio: 6.5, eps: 31.1, bookValue: 269.3, dividendYield: 5.0 },
  NMBSBFE: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
  NTC: { peRatio: 12.0, eps: 72.2, bookValue: 481.1, dividendYield: 6.5 },
  SAHAS: { peRatio: 16.8, eps: 33.7, bookValue: 226.2, dividendYield: 3.8 },
  SARBTM: { peRatio: null, eps: null, bookValue: 198, dividendYield: 0 },
  SGHC: { peRatio: 19.2, eps: 22.6, bookValue: 149.7, dividendYield: 2.8 },
  SNLI: { peRatio: 11.2, eps: 46.0, bookValue: 321.8, dividendYield: 2.0 },
  SONA: { peRatio: 20.5, eps: 21.3, bookValue: 140.9, dividendYield: 2.5 },
  UPPER: { peRatio: 8.5, eps: 21.5, bookValue: 166.4, dividendYield: 7.2 },
};

// Portfolio data from CSV (WACC/Cost) and PDF (Current Values)
const rawPortfolioData = [
  { scrip: "BHL", quantity: 20, waccRate: 100.0, totalCost: 2000.0, currentPrice: 182.3, currentValue: 3646.0, lastModified: "2025-05-13" },
  { scrip: "CBBL", quantity: 20, waccRate: 847.61, totalCost: 16952.15, currentPrice: 1037.7, currentValue: 20754.0, lastModified: "2025-03-30" },
  { scrip: "CHCL", quantity: 10, waccRate: 494.24, totalCost: 4942.37, currentPrice: 505.5, currentValue: 5055.0, lastModified: "2025-03-27" },
  { scrip: "CLI", quantity: 13, waccRate: 210.77, totalCost: 2740.0, currentPrice: 496.0, currentValue: 6448.0, lastModified: "2025-06-01" },
  { scrip: "CSY", quantity: 100, waccRate: 10.0, totalCost: 1000.0, currentPrice: 10.0, currentValue: 1000.0, lastModified: "2025-11-09" },
  { scrip: "GCIL", quantity: 11, waccRate: 404.55, totalCost: 4450.0, currentPrice: 454.3, currentValue: 4997.3, lastModified: "2024-09-22" },
  { scrip: "HBL", quantity: 110, waccRate: 191.53, totalCost: 21067.83, currentPrice: 198.9, currentValue: 21879.0, lastModified: "2025-11-29" },
  { scrip: "HDL", quantity: 23, waccRate: 1183.93, totalCost: 27230.43, currentPrice: 1210.0, currentValue: 27830.0, lastModified: "2025-03-04" },
  { scrip: "HRL", quantity: 21, waccRate: 200.95, totalCost: 4220.0, currentPrice: 870.0, currentValue: 18270.0, lastModified: "2025-10-27" },
  { scrip: "KDBY", quantity: 100, waccRate: 10.0, totalCost: 1000.0, currentPrice: 9.3, currentValue: 930.0, lastModified: "2024-09-22" },
  { scrip: "MMF1", quantity: 120, waccRate: 10.0, totalCost: 1200.0, currentPrice: 8.5, currentValue: 1020.0, lastModified: "2024-09-22" },
  { scrip: "NABIL", quantity: 70, waccRate: 528.53, totalCost: 36996.75, currentPrice: 514.9, currentValue: 36043.0, lastModified: "2025-11-13" },
  { scrip: "NBF3", quantity: 100, waccRate: 10.0, totalCost: 1000.0, currentPrice: 9.0, currentValue: 900.0, lastModified: "2024-09-22" },
  { scrip: "NIBLSF", quantity: 3671, waccRate: 10.0, totalCost: 36710.0, currentPrice: 10.5, currentValue: 38545.5, lastModified: "2025-05-13" },
  { scrip: "NICA", quantity: 20, waccRate: 433.16, totalCost: 8663.18, currentPrice: 334.9, currentValue: 6698.0, lastModified: "2024-12-13" },
  { scrip: "NIMB", quantity: 75, waccRate: 215.48, totalCost: 16161.36, currentPrice: 202.0, currentValue: 15150.0, lastModified: "2025-11-13" },
  { scrip: "NMBSBFE", quantity: 100, waccRate: 10.0, totalCost: 1000.0, currentPrice: 10.42, currentValue: 1042.0, lastModified: "2024-09-22" },
  { scrip: "NTC", quantity: 40, waccRate: 873.76, totalCost: 34950.2, currentPrice: 866.0, currentValue: 34640.0, lastModified: "2025-11-13" },
  { scrip: "SAHAS", quantity: 50, waccRate: 611.46, totalCost: 30573.03, currentPrice: 565.5, currentValue: 28275.0, lastModified: "2025-11-29" },
  { scrip: "SARBTM", quantity: 10, waccRate: 808.51, totalCost: 8085.11, currentPrice: 913.9, currentValue: 9139.0, lastModified: "2024-09-22" },
  { scrip: "SGHC", quantity: 10, waccRate: 100.0, totalCost: 1000.0, currentPrice: 434.0, currentValue: 4340.0, lastModified: "2024-08-26" },
  { scrip: "SNLI", quantity: 16, waccRate: 186.88, totalCost: 2990.0, currentPrice: 514.8, currentValue: 8236.79, lastModified: "2025-07-16" },
  { scrip: "SONA", quantity: 10, waccRate: 237.58, totalCost: 2375.8, currentPrice: 437.0, currentValue: 4370.0, lastModified: "2024-09-22" },
  { scrip: "UPPER", quantity: 20, waccRate: 215.05, totalCost: 4300.98, currentPrice: 183.0, currentValue: 3660.0, lastModified: "2024-09-22" },
];

export const portfolioHoldings: StockHolding[] = rawPortfolioData.map((item, index) => {
  const info = companyInfo[item.scrip] || { fullName: item.scrip, sector: "Other" };
  const fundamentals = fundamentalData[item.scrip];
  const gainLoss = item.currentValue - item.totalCost;
  const gainLossPercent = ((item.currentValue - item.totalCost) / item.totalCost) * 100;

  // Calculate P/B ratio dynamically: Current Price / Book Value
  const bookValue = fundamentals?.bookValue || null;
  const pbRatio = (bookValue && bookValue > 0 && item.currentPrice > 0)
    ? item.currentPrice / bookValue
    : null;

  return {
    sn: index + 1,
    scrip: item.scrip,
    fullName: info.fullName,
    sector: info.sector,
    quantity: item.quantity,
    waccRate: item.waccRate,
    totalCost: item.totalCost,
    currentPrice: item.currentPrice,
    currentValue: item.currentValue,
    gainLoss,
    gainLossPercent,
    pbRatio,
    peRatio: fundamentals?.peRatio || null,
    eps: fundamentals?.eps || null,
    bookValue,
    dividendYield: fundamentals?.dividendYield || null,
    lastModified: item.lastModified,
  };
});

export const getPortfolioSummary = (): PortfolioSummary => {
  const totalInvested = portfolioHoldings.reduce((sum, h) => sum + h.totalCost, 0);
  const currentValue = portfolioHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalGainLoss = currentValue - totalInvested;
  const totalGainLossPercent = (totalGainLoss / totalInvested) * 100;
  const profitableHoldings = portfolioHoldings.filter((h) => h.gainLoss > 0).length;
  const unprofitableHoldings = portfolioHoldings.filter((h) => h.gainLoss < 0).length;

  return {
    totalInvested,
    currentValue,
    totalGainLoss,
    totalGainLossPercent,
    totalHoldings: portfolioHoldings.length,
    profitableHoldings,
    unprofitableHoldings,
  };
};

export const getSectorAllocation = () => {
  const sectorMap: Record<string, number> = {};
  portfolioHoldings.forEach((h) => {
    sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue;
  });
  return Object.entries(sectorMap).map(([name, value]) => ({ name, value }));
};

export const getTopPerformers = (count: number = 5) => {
  return [...portfolioHoldings].sort((a, b) => b.gainLossPercent - a.gainLossPercent).slice(0, count);
};

export const getWorstPerformers = (count: number = 5) => {
  return [...portfolioHoldings].sort((a, b) => a.gainLossPercent - b.gainLossPercent).slice(0, count);
};
