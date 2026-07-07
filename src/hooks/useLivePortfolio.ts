/**
 * Hook for fetching live portfolio data from ShareBazaar API
 * Updates company names and current prices in real-time
 * 
 * Architecture Decision:
 * - First tries to fetch holdings from local database (portfolio_db.py)
 * - Falls back to hardcoded data if database is unavailable
 * - API provides authoritative company names and LTP (Last Traded Price)
 * - Fallback names used only when API doesn't return company_name (some mutual funds)
 * - Sector classification maintained locally as API doesn't provide sector data
 * - This separation of concerns allows for accurate data while maintaining sector analytics
 * - Dividend data fetched from Merolagani via Python API for income tracking
 * - Manual dividend entries from DividendsPage are integrated into holdings
 */

import { useState, useEffect, useCallback } from 'react';
import { StockHolding, PortfolioSummary } from '@/data/portfolioData';
import { getCachedStockData, clearStockDataCache, ShareBazaarResponse } from '@/services/sharebazaarApi';
import { getHoldings as getDbHoldings, isServerRunning, DBHolding } from '@/services/portfolioDb';
import { calculateDividendIncome, getPaidUpValue } from '@/services/dividendApi';
import { getManualDividends, isManualDividendServerAvailable, ManualDividendEntry } from '@/services/manualDividendDb';

/**
 * Manual Dividend Entry from DividendsPage
 */
interface ManualDividendRow {
    id: string;
    symbol: string;
    companyName: string;
    fiscalYear: string;
    bonusPercent: number;
    cashPercent: number;
    cashIncome: number;
}

/**
 * Get manual dividend data from file storage (primary) or localStorage (fallback)
 * Aggregates dividend entries by symbol (uses latest entry per symbol)
 */
const getManualDividendData = async (): Promise<Map<string, ManualDividendRow>> => {
    const dividendMap = new Map<string, ManualDividendRow>();
    try {
        // Try to get from file storage first
        const serverAvailable = await isManualDividendServerAvailable();
        let entries: ManualDividendRow[] = [];

        if (serverAvailable) {
            entries = await getManualDividends() as ManualDividendRow[];
        } else {
            // Fallback to localStorage
            const savedRows = localStorage.getItem('manualDividendRows');
            if (savedRows) {
                entries = JSON.parse(savedRows);
            }
        }

        // Use the first (latest) entry for each symbol
        for (const row of entries) {
            const symbol = row.symbol.toUpperCase();
            if (!dividendMap.has(symbol)) {
                dividendMap.set(symbol, row);
            }
        }
    } catch (e) {
        console.warn('Failed to load manual dividend data:', e);
        // Try localStorage as last resort
        try {
            const savedRows = localStorage.getItem('manualDividendRows');
            if (savedRows) {
                const parsed: ManualDividendRow[] = JSON.parse(savedRows);
                for (const row of parsed) {
                    const symbol = row.symbol.toUpperCase();
                    if (!dividendMap.has(symbol)) {
                        dividendMap.set(symbol, row);
                    }
                }
            }
        } catch (e2) {
            console.warn('Failed to parse manual dividend data from localStorage:', e2);
        }
    }
    return dividendMap;
};

/**
 * Raw Portfolio Holdings Data Structure
 */
interface RawPortfolioItem {
    scrip: string;
    quantity: number;
    waccRate: number;
    totalCost: number;
    lastModified: string;
}

/**
 * Fallback Portfolio Holdings Data
 * 
 * This is used when the database server is not running.
 * Structure follows the principle of separating "what you own" from "what it's worth now".
 */
const fallbackPortfolioData: RawPortfolioItem[] = [
    { scrip: "BHL", quantity: 20, waccRate: 100.0, totalCost: 2000.0, lastModified: "2025-05-13" },
    { scrip: "CBBL", quantity: 20, waccRate: 847.61, totalCost: 16952.15, lastModified: "2025-03-30" },
    { scrip: "CHCL", quantity: 10, waccRate: 494.24, totalCost: 4942.37, lastModified: "2025-03-27" },
    { scrip: "CLI", quantity: 13, waccRate: 210.77, totalCost: 2740.0, lastModified: "2025-06-01" },
    { scrip: "CSY", quantity: 100, waccRate: 10.0, totalCost: 1000.0, lastModified: "2025-11-09" },
    { scrip: "GCIL", quantity: 11, waccRate: 404.55, totalCost: 4450.0, lastModified: "2024-09-22" },
    { scrip: "HBL", quantity: 110, waccRate: 191.53, totalCost: 21067.83, lastModified: "2025-11-29" },
    { scrip: "HDL", quantity: 23, waccRate: 1183.93, totalCost: 27230.43, lastModified: "2025-03-04" },
    { scrip: "HRL", quantity: 21, waccRate: 200.95, totalCost: 4220.0, lastModified: "2025-10-27" },
    { scrip: "KDBY", quantity: 100, waccRate: 10.0, totalCost: 1000.0, lastModified: "2024-09-22" },
    { scrip: "MMF1", quantity: 120, waccRate: 10.0, totalCost: 1200.0, lastModified: "2024-09-22" },
    { scrip: "NABIL", quantity: 70, waccRate: 528.53, totalCost: 36996.75, lastModified: "2025-11-13" },
    { scrip: "NBF3", quantity: 100, waccRate: 10.0, totalCost: 1000.0, lastModified: "2024-09-22" },
    { scrip: "NIBLSF", quantity: 3671, waccRate: 10.0, totalCost: 36710.0, lastModified: "2025-05-13" },
    { scrip: "NICA", quantity: 20, waccRate: 433.16, totalCost: 8663.18, lastModified: "2024-12-13" },
    { scrip: "NIMB", quantity: 75, waccRate: 215.48, totalCost: 16161.36, lastModified: "2025-11-13" },
    { scrip: "NMBSBFE", quantity: 100, waccRate: 10.0, totalCost: 1000.0, lastModified: "2024-09-22" },
    { scrip: "NTC", quantity: 40, waccRate: 873.76, totalCost: 34950.2, lastModified: "2025-11-13" },
    { scrip: "SAHAS", quantity: 50, waccRate: 611.46, totalCost: 30573.03, lastModified: "2025-11-29" },
    { scrip: "SARBTM", quantity: 10, waccRate: 808.51, totalCost: 8085.11, lastModified: "2024-09-22" },
    { scrip: "SGHC", quantity: 10, waccRate: 100.0, totalCost: 1000.0, lastModified: "2024-08-26" },
    { scrip: "SNLI", quantity: 16, waccRate: 186.88, totalCost: 2990.0, lastModified: "2025-07-16" },
    { scrip: "SONA", quantity: 10, waccRate: 237.58, totalCost: 2375.8, lastModified: "2024-09-22" },
    { scrip: "UPPER", quantity: 20, waccRate: 215.05, totalCost: 4300.98, lastModified: "2024-09-22" },
];

/**
 * Convert database holdings to raw portfolio format
 */
function dbHoldingsToRaw(dbHoldings: DBHolding[]): RawPortfolioItem[] {
    return dbHoldings.map(h => ({
        scrip: h.symbol,
        quantity: h.quantity,
        waccRate: h.avgCost,
        totalCost: h.quantity * h.avgCost,
        lastModified: h.dateAdded,
    }));
}

/**
 * Company Information Registry
 * 
 * This serves two purposes:
 * 1. Fallback names when API doesn't return company_name (common for mutual funds)
 * 2. Sector classification (API doesn't provide sector data)
 * 
 * Data verified against ShareBazaar API responses on 2025-11-30.
 * Names match official NEPSE listings.
 * 
 * Sector Categories on NEPSE:
 * - Commercial Bank, Development Bank, Finance, Microfinance
 * - Life Insurance, Non-Life Insurance
 * - Hydropower, Manufacturing, Trading, Hotels
 * - Mutual Fund, Investment
 * - Telecom, Others
 */
const companyRegistry: Record<string, { fullName: string; sector: string }> = {
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

    // === MICROFINANCE / DEVELOPMENT BANK ===
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
    // Note: Most mutual funds don't return names from ShareBazaar API
    CSY: { fullName: "Citizens Super Yield Fund", sector: "Mutual Fund" },
    KDBY: { fullName: "Kumari Dhanabriddhi Yojana", sector: "Mutual Fund" },
    MMF1: { fullName: "Mahila Sambriddhi Kosh", sector: "Mutual Fund" },
    NBF3: { fullName: "Nabil Balanced Fund 3", sector: "Mutual Fund" },
    NIBLSF: { fullName: "NIBL Samriddhi Fund", sector: "Mutual Fund" },
    NMBSBFE: { fullName: "NMB Saral Bachat Fund - E", sector: "Mutual Fund" },
};

// Legacy alias for backward compatibility
const fallbackCompanyInfo = companyRegistry;

// Sector mapping based on common NEPSE sector classifications
const sectorMapping: Record<string, string> = {
    "Commercial Bank": "Commercial Bank",
    "Development Bank": "Development Bank",
    "Hydropower": "Hydropower",
    "Life Insurance": "Life Insurance",
    "Non-Life Insurance": "Non-Life Insurance",
    "Manufacturing": "Manufacturing",
    "Mutual Fund": "Mutual Fund",
    "Investment": "Investment",
    "Telecom": "Telecom",
    "Microfinance": "Microfinance",
    "Finance": "Finance",
    "Hotels": "Hotels",
    "Trading": "Trading",
    "Others": "Others",
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

// Fallback prices (used when API is unavailable)
const fallbackPrices: Record<string, number> = {
    BHL: 182.3, CBBL: 1037.7, CHCL: 505.5, CLI: 496.0, CSY: 10.0,
    GCIL: 454.3, HBL: 198.9, HDL: 1210.0, HRL: 870.0, KDBY: 9.3,
    MMF1: 8.5, NABIL: 514.9, NBF3: 9.0, NIBLSF: 10.5, NICA: 334.9,
    NIMB: 202.0, NMBSBFE: 10.42, NTC: 866.0, SAHAS: 565.5, SARBTM: 913.9,
    SGHC: 434.0, SNLI: 514.8, SONA: 437.0, UPPER: 183.0,
};

export interface LivePortfolioData {
    holdings: StockHolding[];
    summary: PortfolioSummary;
    isLoading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    refetch: () => Promise<void>;
    isDbConnected: boolean;
    dividendDataLoaded: boolean;
}

/**
 * Hook to fetch and manage live portfolio data
 */
export const useLivePortfolio = (): LivePortfolioData => {
    const [holdings, setHoldings] = useState<StockHolding[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isDbConnected, setIsDbConnected] = useState(false);
    const [dividendDataLoaded, setDividendDataLoaded] = useState(false);

    /**
     * Build holdings array from raw data + API response + dividend data
     * 
     * Priority for company name:
     * 1. API company_name (if non-empty) - most authoritative source
     * 2. companyRegistry fallback - for mutual funds that don't have names in API
     * 
     * Priority for price:
     * 1. API ltp (Last Traded Price) - real-time from NEPSE
     * 2. fallbackPrices - cached prices for when API is unavailable
     */

    // Helper function to parse bonus ratio and calculate shares
    const parseBonusRatio = (ratioStr: string): { bonusShares: number; forEvery: number } | null => {
        const parts = ratioStr.split(':');
        if (parts.length !== 2) return null;

        const first = parseFloat(parts[0].trim());
        const second = parseFloat(parts[1].trim());

        if (isNaN(first) || isNaN(second) || second === 0) return null;
        return { bonusShares: first, forEvery: second };
    };

    const calculateBonusShares = (quantity: number, ratioStr: string): number => {
        const ratio = parseBonusRatio(ratioStr);
        if (!ratio) return 0;
        return Math.floor((quantity / ratio.forEvery) * ratio.bonusShares);
    };

    const buildHoldings = useCallback((
        portfolioData: RawPortfolioItem[],
        stockData: Map<string, ShareBazaarResponse>,
        dividendData?: Map<string, unknown>,
        manualDividends?: Map<string, ManualDividendRow>,
        dynamicFundamentals?: Record<string, any>
    ): StockHolding[] => {
        // Use passed manual dividend data (fetched asynchronously)
        const dividendMap = manualDividends || new Map<string, ManualDividendRow>();
        const funds = dynamicFundamentals || {};

        return portfolioData.map((item, index) => {
            const apiData = stockData.get(item.scrip);
            const registryInfo = companyRegistry[item.scrip] || { fullName: item.scrip, sector: "Others" };
            const manualDividend = dividendMap.get(item.scrip.toUpperCase());

            // Use API company_name if available and non-empty, otherwise use registry
            // Note: Some mutual funds return empty string from API
            const fullName = (apiData?.company_name && apiData.company_name.trim() !== '')
                ? apiData.company_name
                : registryInfo.fullName;

            // Use API ltp if available, otherwise fallback to cached prices
            const currentPrice = apiData?.ltp || fallbackPrices[item.scrip] || 0;

            // Sector always comes from our registry (API doesn't provide sector)
            const sector = registryInfo.sector;

            const currentValue = currentPrice * item.quantity;
            const gainLoss = currentValue - item.totalCost;
            const gainLossPercent = ((currentValue - item.totalCost) / item.totalCost) * 100;

            const fundamentals = funds[item.scrip] || fundamentalData[item.scrip];

            // Calculate P/B ratio dynamically: LTP / Book Value
            const bookValue = fundamentals?.bookValue || null;
            const pbRatio = (bookValue && bookValue > 0 && currentPrice > 0)
                ? currentPrice / bookValue
                : null;

            // Use manual dividend entry if available
            const latestDividendPercent = manualDividend?.cashPercent || 0;
            const paidUpValue = getPaidUpValue(item.scrip);
            // Use manual cash income if provided, otherwise calculate from percentage
            const dividendIncome = manualDividend?.cashIncome ||
                (latestDividendPercent > 0 ? (latestDividendPercent / 100) * paidUpValue * item.quantity : 0);

            // Use manual bonus data if available - show as percentage (e.g., "12.5%")
            const latestBonusRatio = manualDividend?.bonusPercent && manualDividend.bonusPercent > 0
                ? `${manualDividend.bonusPercent}%`
                : null;
            const bonusShares = manualDividend?.bonusPercent
                ? Math.floor(item.quantity * (manualDividend.bonusPercent / 100))
                : 0;
            const bonusShareValue = bonusShares * currentPrice;

            return {
                sn: index + 1,
                scrip: item.scrip,
                fullName,
                sector,
                quantity: item.quantity,
                waccRate: item.waccRate,
                totalCost: item.totalCost,
                currentPrice,
                currentValue,
                gainLoss,
                gainLossPercent,
                pbRatio,
                peRatio: fundamentals?.peRatio || null,
                eps: fundamentals?.eps || null,
                bookValue,
                dividendYield: fundamentals?.dividendYield || null,
                lastModified: item.lastModified,
                latestDividendPercent: latestDividendPercent > 0 ? latestDividendPercent : null,
                dividendIncome,
                totalDividendReceived: dividendIncome, // For now, using latest as total
                latestBonusRatio,
                bonusShares,
                bonusShareValue,
            };
        });
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setDividendDataLoaded(false);

        try {
            // First, try to fetch holdings from the local database
            let portfolioData: RawPortfolioItem[] = fallbackPortfolioData;

            const dbConnected = await isServerRunning();
            setIsDbConnected(dbConnected);

            if (dbConnected) {
                try {
                    const dbHoldings = await getDbHoldings();
                    if (dbHoldings && dbHoldings.length > 0) {
                        portfolioData = dbHoldingsToRaw(dbHoldings);
                        console.log('[useLivePortfolio] Loaded', portfolioData.length, 'holdings from database');
                    }
                } catch (dbError) {
                    console.log('[useLivePortfolio] Database fetch failed, using fallback data');
                }
            } else {
                console.log('[useLivePortfolio] Database not connected, using fallback data');
            }

            // Now fetch live prices from ShareBazaar API
            const symbols = portfolioData.map(item => item.scrip);
            console.log('[useLivePortfolio] Fetching prices for', symbols.length, 'symbols');
            const stockData = await getCachedStockData(symbols);
            console.log('[useLivePortfolio] Received data for', stockData.size, 'symbols');

            // Fetch manual dividend data from file storage (or localStorage fallback)
            const manualDividends = await getManualDividendData();
            console.log('[useLivePortfolio] Loaded manual dividends for', manualDividends.size, 'symbols');

            // Fetch dynamic fundamentals
            let dynamicFundamentals = {};
            try {
                const fundRes = await fetch("http://localhost:5001/api/fundamentals");
                if (fundRes.ok) {
                    const fundData = await fundRes.json();
                    dynamicFundamentals = fundData.fundamentals || {};
                }
            } catch (e) {
                console.error('[useLivePortfolio] Failed to fetch dynamic fundamentals', e);
            }

            // No dividend API calls; manual entry only
            const dividendData: Map<string, unknown> = new Map();
            setDividendDataLoaded(manualDividends.size > 0);

            const newHoldings = buildHoldings(portfolioData, stockData, dividendData, manualDividends, dynamicFundamentals);
            setHoldings(newHoldings);
            setLastUpdated(new Date());

            if (stockData.size === 0) {
                setError('Could not fetch live data. Using cached prices. Check console for details.');
            } else if (stockData.size < symbols.length) {
                setError(`Fetched ${stockData.size}/${symbols.length} stocks. Some using cached prices.`);
            }
        } catch (err) {
            setError('Failed to fetch stock data. Using cached prices.');
            // Use fallback data
            const fallbackDividends = await getManualDividendData();
            const newHoldings = buildHoldings(fallbackPortfolioData, new Map(), undefined, fallbackDividends);
            setHoldings(newHoldings);
        } finally {
            setIsLoading(false);
        }
    }, [buildHoldings]);

    const refetch = useCallback(async () => {
        clearStockDataCache();
        await fetchData();
    }, [fetchData]);

    // Calculate summary from holdings (including dividend income and bonus value)
    const totalInvested = holdings.reduce((sum, h) => sum + h.totalCost, 0);
    const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalGainLoss = holdings.reduce((sum, h) => sum + h.gainLoss, 0);
    const totalDividendIncome = holdings.reduce((sum, h) => sum + (h.dividendIncome || 0), 0);
    const totalBonusValue = holdings.reduce((sum, h) => sum + (h.bonusShareValue || 0), 0);
    // Net Growth = Capital Gain + Cash Dividends only (bonus shares already reflected in portfolio value)
    const netGrowth = totalGainLoss + totalDividendIncome;

    const summary: PortfolioSummary = {
        totalInvested,
        currentValue,
        totalGainLoss,
        totalGainLossPercent: holdings.length > 0 && totalInvested > 0
            ? ((currentValue - totalInvested) / totalInvested) * 100
            : 0,
        totalHoldings: holdings.length,
        profitableHoldings: holdings.filter(h => h.gainLoss > 0).length,
        unprofitableHoldings: holdings.filter(h => h.gainLoss < 0).length,
        // Dividend and bonus tracking
        totalDividendIncome,
        totalBonusValue,
        netGrowth,
        netGrowthPercent: holdings.length > 0 && totalInvested > 0
            ? (netGrowth / totalInvested) * 100
            : 0,
    };

    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        holdings,
        summary,
        isLoading,
        error,
        lastUpdated,
        refetch,
        isDbConnected,
        dividendDataLoaded,
    };
};

/**
 * Get symbols from current portfolio data
 * Note: This now returns fallback symbols, for dynamic symbols use the hook
 */
export const getPortfolioSymbols = (): string[] => {
    return fallbackPortfolioData.map(item => item.scrip);
};
