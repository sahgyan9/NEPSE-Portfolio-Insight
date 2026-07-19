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

import { useState, useEffect, useCallback, useRef } from 'react';
import { StockHolding, PortfolioSummary } from '@/data/portfolioData';
import { getCachedStockData, clearStockDataCache, ShareBazaarResponse } from '@/services/sharebazaarApi';
import { getHoldings as getDbHoldings, isServerRunning, DBHolding } from '@/services/portfolioDb';
import { calculateDividendIncome, getPaidUpValue } from '@/services/dividendApi';
import { getManualDividends, isManualDividendServerAvailable, ManualDividendEntry } from '@/services/manualDividendDb';
import { companyRegistry, fundamentalData, fallbackPrices } from '@/data/companyRegistry';

/**
 * Last-known-good price cache (localStorage).
 *
 * When the ShareBazaar API fails or returns only some symbols, we used to
 * fall back to the STATIC fallbackPrices table (stale) or 0 — which made the
 * portfolio's Current Value visibly collapse until the API recovered.
 * Instead we remember every live price we ever successfully fetched and use
 * that as the first fallback, so a flaky API just means slightly stale
 * prices rather than a wrong total.
 */
const LAST_KNOWN_PRICES_KEY = 'pi_last_known_prices';

const loadLastKnownPrices = (): Record<string, number> => {
    try {
        return JSON.parse(localStorage.getItem(LAST_KNOWN_PRICES_KEY) || '{}');
    } catch {
        return {};
    }
};

const saveLastKnownPrices = (stockData: Map<string, ShareBazaarResponse>) => {
    try {
        const prices = loadLastKnownPrices();
        let changed = false;
        stockData.forEach((data, symbol) => {
            if (data?.ltp && data.ltp > 0) {
                prices[symbol] = data.ltp;
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem(LAST_KNOWN_PRICES_KEY, JSON.stringify(prices));
        }
    } catch {
        // best-effort cache; ignore quota/serialization errors
    }
};

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



export interface LivePortfolioData {
    holdings: StockHolding[];
    summary: PortfolioSummary;
    isLoading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    refetch: () => Promise<void>;
    isDbConnected: boolean;
    dividendDataLoaded: boolean;
    /** True when the database is connected but holds no positions yet (new user). */
    isEmpty: boolean;
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
    const [isEmpty, setIsEmpty] = useState(false);

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



    const buildHoldings = useCallback((
        portfolioData: RawPortfolioItem[],
        stockData: Map<string, ShareBazaarResponse>,
        dividendData?: Record<string, any>,
        manualDividends?: Map<string, ManualDividendRow>,
        dynamicFundamentals?: Record<string, any>
    ): StockHolding[] => {
        // Use passed manual dividend data (fetched asynchronously)
        const dividendMap = manualDividends || new Map<string, ManualDividendRow>();
        const funds = dynamicFundamentals || {};
        const lastKnown = loadLastKnownPrices();

        return portfolioData.map((item, index) => {
            const apiData = stockData.get(item.scrip);
            const registryInfo = companyRegistry[item.scrip] || { fullName: item.scrip, sector: "Others" };
            const manualDividend = dividendMap.get(item.scrip.toUpperCase());

            // Use API company_name if available and non-empty, otherwise use registry
            // Note: Some mutual funds return empty string from API
            const fullName = (apiData?.company_name && apiData.company_name.trim() !== '')
                ? apiData.company_name
                : registryInfo.fullName;

            // Price priority: live API ltp -> last successfully fetched live
            // price (localStorage) -> static fallback table -> 0
            const currentPrice = apiData?.ltp
                || lastKnown[item.scrip]
                || fallbackPrices[item.scrip]
                || 0;

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

            // Calculate automated dividend average (bonus only)
            const autoDivs = (dividendData && dividendData[item.scrip]) ? dividendData[item.scrip].dividends || [] : [];
            let avgBonus = 0;
            if (autoDivs.length > 0) {
                avgBonus = autoDivs.reduce((sum: number, d: any) => sum + (Number(d.bonusPercent) || 0), 0) / autoDivs.length;
            }

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
                dividendYield: avgBonus > 0 ? avgBonus : (fundamentals?.dividendYield || null),
                lastModified: item.lastModified,
                latestDividendPercent: latestDividendPercent > 0 ? latestDividendPercent : null,
                dividendIncome,
                totalDividendReceived: dividendIncome, // For now, using latest as total
                latestBonusRatio,
                bonusShares,
                bonusShareValue,
                grahamNumber: fundamentals?.graham_number || null,
                earningsYield: fundamentals?.earnings_yield || null,
                pegRatio: fundamentals?.peg_ratio || null,
                debtToEquity: fundamentals?.debt_to_equity || null,
                netInterestMargin: fundamentals?.net_interest_margin || null,
                dupontNetMargin: fundamentals?.dupont_net_margin || null,
                dupontAssetTurnover: fundamentals?.dupont_asset_turnover || null,
                dupontEquityMultiplier: fundamentals?.dupont_equity_multiplier || null,
                dupontRoe: fundamentals?.dupont_roe || null,
                operatingProfitMargin: fundamentals?.operating_profit_margin || null,
                revenuePerShare: fundamentals?.revenue_per_share || null,
                qoqProfitMomentum: fundamentals?.qoq_profit_momentum || null,
                loanToAsset: fundamentals?.loan_to_asset || null,
                efficiencyRatio: fundamentals?.efficiency_ratio || null,
                interestCoverage: fundamentals?.interest_coverage || null,
                fixedAssetTurnover: fundamentals?.fixed_asset_turnover || null,
                investmentYield: fundamentals?.investment_yield || null,
                combinedRatio: fundamentals?.combined_ratio || null,
                high52: fundamentals?.high52 || null,
                low52: fundamentals?.low52 || null,
                promoterHolding: fundamentals?.promoterHolding || null,
                publicFloat: fundamentals?.publicFloat || null,
                avgVolume120d: fundamentals?.avgVolume120d || null,
            };
        });
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setDividendDataLoaded(false);

        try {
            // First, try to fetch holdings from the local database.
            // When the DB is connected we trust it as the source of truth — even
            // when it's empty — so a brand-new user sees a genuine "import your
            // portfolio" empty state instead of someone else's demo holdings.
            // The hardcoded demo data is only used when the DB is unreachable.
            let portfolioData: RawPortfolioItem[] = fallbackPortfolioData;
            let empty = false;

            const dbConnected = await isServerRunning();
            setIsDbConnected(dbConnected);

            if (dbConnected) {
                try {
                    const dbHoldings = await getDbHoldings();
                    portfolioData = dbHoldingsToRaw(dbHoldings || []);
                    empty = portfolioData.length === 0;
                    console.log('[useLivePortfolio] Loaded', portfolioData.length, 'holdings from database');
                } catch (dbError) {
                    console.log('[useLivePortfolio] Database fetch failed, using fallback data');
                }
            } else {
                console.log('[useLivePortfolio] Database not connected, using fallback data');
            }

            setIsEmpty(empty);

            if (empty) {
                // Nothing to price — surface the empty state immediately.
                setHoldings([]);
                setLastUpdated(new Date());
                setIsLoading(false);
                return;
            }

            // Now fetch live prices from ShareBazaar API
            const symbols = portfolioData.map(item => item.scrip);
            console.log('[useLivePortfolio] Fetching prices for', symbols.length, 'symbols');
            const stockData = await getCachedStockData(symbols);
            console.log('[useLivePortfolio] Received data for', stockData.size, 'symbols');

            // Remember every live price we got, so future API hiccups fall
            // back to these instead of stale static prices / zero.
            saveLastKnownPrices(stockData);

            // Fetch manual dividend data from file storage (or localStorage fallback)
            const manualDividends = await getManualDividendData();
            console.log('[useLivePortfolio] Loaded manual dividends for', manualDividends.size, 'symbols');

            // Fetch dynamic fundamentals
            let dynamicFundamentals = {};
            try {
                const fundRes = await fetch(
                    import.meta.env.DEV
                        ? '/api/portfolio-db/api/fundamentals'
                        : 'http://localhost:5001/api/fundamentals'
                );
                if (fundRes.ok) {
                    const fundData = await fundRes.json();
                    dynamicFundamentals = fundData.fundamentals || {};
                }
            } catch (e) {
                console.error('[useLivePortfolio] Failed to fetch dynamic fundamentals', e);
            }

            // Fetch automated dividend data
            let automatedDividends: Record<string, any> = {};
            try {
                const divRes = await fetch(
                    import.meta.env.DEV
                        ? '/api/nepse-server/api/dividends/data'
                        : 'http://localhost:8000/api/dividends/data'
                );
                if (divRes.ok) {
                    automatedDividends = await divRes.json();
                }
            } catch (e) {
                console.error('[useLivePortfolio] Failed to fetch automated dividends', e);
            }
            
            setDividendDataLoaded(Object.keys(automatedDividends).length > 0 || manualDividends.size > 0);

            const newHoldings = buildHoldings(portfolioData, stockData, automatedDividends, manualDividends, dynamicFundamentals);
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

    // Auto-refresh when the user returns to the tab — but only if the data is
    // stale (older than 5 minutes). The staleness gate keeps prices feeling live
    // without ever hammering upstream APIs, and it deliberately does NOT trigger
    // the scraper/news fetches (those stay manual to respect their rate limits).
    const liveStateRef = useRef({ isLoading, lastUpdated, isEmpty });
    liveStateRef.current = { isLoading, lastUpdated, isEmpty };

    useEffect(() => {
        const STALE_MS = 5 * 60 * 1000;
        const onFocus = () => {
            const { isLoading: loading, lastUpdated: updated, isEmpty: empty } = liveStateRef.current;
            if (loading || empty) return;
            if (!updated || Date.now() - updated.getTime() > STALE_MS) {
                refetch();
            }
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [refetch]);

    return {
        holdings,
        summary,
        isLoading,
        error,
        lastUpdated,
        refetch,
        isDbConnected,
        dividendDataLoaded,
        isEmpty,
    };
};

/**
 * Get symbols from current portfolio data
 * Note: This now returns fallback symbols, for dynamic symbols use the hook
 */
export const getPortfolioSymbols = (): string[] => {
    return fallbackPortfolioData.map(item => item.scrip);
};
