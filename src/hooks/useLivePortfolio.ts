/**
 * Hook for fetching live portfolio data from ShareBazaar API
 * Updates company names and current prices in real-time
 * 
 * Architecture Decision:
 * - Holdings come only from the local database (portfolio_db.py). There is no
 *   demo/sample fallback: if the database cannot be reached the UI says so and
 *   keeps retrying, rather than showing numbers that are not the user's.
 * - API provides authoritative company names and LTP (Last Traded Price)
 * - Fallback names used only when API doesn't return company_name (some mutual funds)
 * - Sector classification maintained locally as API doesn't provide sector data
 * - This separation of concerns allows for accurate data while maintaining sector analytics
 * - Dividend data fetched from Merolagani via Python API for income tracking
 * - Manual dividend entries from DividendsPage are integrated into holdings
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LiveStockHolding as StockHolding, LivePortfolioSummary as PortfolioSummary } from '@/types';
import { getCachedStockData, clearStockDataCache, ShareBazaarResponse } from '@/services/sharebazaarApi';
import { getPaidUpValue } from '@/services/dividendApi';
import { fetchPortfolioDividends, CompanyDividend, PortfolioDividendsResponse, DEFAULT_DIVIDEND_FY } from '@/services/receivedDividendsApi';
import { companyRegistry, fundamentalData, fallbackPrices } from '@/data/companyRegistry';
import { getHoldings as getDbHoldings, isServerRunning, DBHolding } from '@/services/portfolioDb';
import { getManualDividends, isManualDividendServerAvailable } from '@/services/manualDividendDb';
import { signalLauncherReady, markStartup } from '@/lib/launcherHandshake';

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
 * Retry schedule for the first holdings request. On a cold start the browser is
 * still downloading hundreds of dev-server modules (6 connections per host), so a
 * single short request can time out even though the database is healthy.
 */
const HOLDINGS_TIMEOUT_MS = 5000;
const HOLDINGS_RETRY_DELAYS_MS = [500, 1000, 2000, 3000];
/** While the database is unreachable, check for it again this often. */
const RECONNECT_INTERVAL_MS = 5000;

export type DbConnection = 'connecting' | 'connected' | 'unreachable';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function loadDbHoldingsWithRetry(): Promise<DBHolding[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= HOLDINGS_RETRY_DELAYS_MS.length; attempt++) {
        try {
            return (await getDbHoldings(HOLDINGS_TIMEOUT_MS)) || [];
        } catch (e) {
            lastError = e;
            if (attempt < HOLDINGS_RETRY_DELAYS_MS.length) {
                await sleep(HOLDINGS_RETRY_DELAYS_MS[attempt]);
            }
        }
    }
    throw lastError;
}

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
    /** connecting: first load in progress; unreachable: database did not answer (retrying in background). */
    dbConnection: DbConnection;
    dividendDataLoaded: boolean;
    /** True when the database is connected but holds no positions yet (new user). */
    isEmpty: boolean;
    dividendFiscalYear: string;
    setDividendFiscalYear: (fy: string) => void;
}

/**
 * Hook to fetch and manage live portfolio data
 */
export const useLivePortfolio = (initialFiscalYear: string = DEFAULT_DIVIDEND_FY): LivePortfolioData => {
    const [holdings, setHoldings] = useState<StockHolding[]>([]);
    const hasLoadedRef = useRef(false);
    const [dividendFiscalYear, setDividendFiscalYear] = useState<string>(initialFiscalYear);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isDbConnected, setIsDbConnected] = useState(false);
    const [dbConnection, setDbConnection] = useState<DbConnection>('connecting');
    const [dividendDataLoaded, setDividendDataLoaded] = useState(false);
    const [isEmpty, setIsEmpty] = useState(false);
    // All-time accumulated cash dividends across every FY — used only for the
    // summary card total; kept separate from the per-FY per-company table data.
    const [allTimeDividendCashNet, setAllTimeDividendCashNet] = useState<number>(0);


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
        portfolioDividends?: PortfolioDividendsResponse | null,
        dynamicFundamentals?: Record<string, any>
    ): StockHolding[] => {
        const dividendMap = new Map<string, CompanyDividend>();
        if (portfolioDividends?.companies) {
            for (const c of portfolioDividends.companies) {
                dividendMap.set(c.symbol.toUpperCase(), c);
            }
        }
        const funds = dynamicFundamentals || {};
        const lastKnown = loadLastKnownPrices();

        return portfolioData.map((item, index) => {
            const apiData = stockData.get(item.scrip);
            const registryInfo = companyRegistry[item.scrip] || { fullName: item.scrip, sector: "Others" };
            const dividendInfo = dividendMap.get(item.scrip.toUpperCase());

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

            // P/E the same way: LTP / EPS, so it always agrees with the EPS shown.
            // A loss gives a negative P/E; EPS of zero gives none.
            const eps = fundamentals?.eps ?? null;
            const peRatio = (eps && currentPrice > 0)
                ? currentPrice / eps
                : (fundamentals?.peRatio || null);

            // Extract unified dividend info from single source of truth
            const latestDividendPercent = dividendInfo && dividendInfo.cashPercent > 0
                ? dividendInfo.cashPercent
                : null;
            const dividendIncome = dividendInfo?.received?.cashGross ?? 0;
            const latestBonusRatio = dividendInfo && dividendInfo.bonusPercent > 0
                ? `${dividendInfo.bonusPercent}%`
                : null;
            const bonusShares = dividendInfo?.received?.bonusShares ?? 0;
            const bonusPercent = dividendInfo?.bonusPercent ?? null;
            const effectivePrice = currentPrice > 0
                ? currentPrice
                : (item.waccRate > 0 ? item.waccRate : (dividendInfo?.paidUpValue || 100));
            const bonusShareValue = bonusShares > 0
                ? bonusShares * effectivePrice
                : ((bonusPercent && bonusPercent > 0) ? (item.quantity * (bonusPercent / 100) * effectivePrice) : 0);
            const totalDividendValue = dividendIncome + bonusShareValue;
            const totalDividendPercent = dividendInfo?.totalPercent ?? ((latestDividendPercent || 0) + (bonusPercent || 0));
            const latestDividendFiscalYear = dividendInfo?.fiscalYear ?? null;
            const latestDividendSource = dividendInfo?.source ?? null;

            // Dividend yield: cash yield based on currentPrice, or company fundamental yield
            const paidUpValue = dividendInfo?.paidUpValue || getPaidUpValue(item.scrip);
            const calculatedCashYield = (currentPrice > 0 && dividendInfo && dividendInfo.cashPercent > 0)
                ? ((dividendInfo.cashPercent / 100 * paidUpValue) / currentPrice) * 100
                : null;
            const dividendYield = calculatedCashYield ?? (fundamentals?.dividendYield || null);

            return {
                sn: index + 1,
                scrip: item.scrip,
                fullName,
                sector,
                quantity: item.quantity,
                waccRate: item.waccRate,
                totalCost: item.totalCost,
                currentPrice,
                // Only trusted when the live feed gave both prices (currentPrice is then apiData.ltp).
                previousClose: (apiData?.ltp && apiData.ltp > 0 && apiData.previousClose && apiData.previousClose > 0)
                    ? apiData.previousClose
                    : undefined,
                currentValue,
                gainLoss,
                gainLossPercent,
                pbRatio,
                peRatio,
                eps: eps || null,
                bookValue,
                dividendYield,
                lastModified: item.lastModified,
                latestDividendPercent,
                dividendIncome,
                totalDividendReceived: dividendIncome,
                latestBonusRatio,
                bonusShares,
                bonusShareValue,
                bonusPercent,
                totalDividendPercent,
                totalDividendValue,
                latestDividendFiscalYear,
                latestDividendSource,
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
        if (!hasLoadedRef.current) {
            setIsLoading(true);
        }
        setError(null);
        let portfolioData: RawPortfolioItem[] = [];

        try {
            // Holdings come only from the local database. If it cannot be reached
            // (after retries), keep whatever real data is already on screen and
            // report the problem; never substitute sample holdings.
            try {
                markStartup('holdings-start');
                const dbHoldings = await loadDbHoldingsWithRetry();
                markStartup('holdings');
                portfolioData = dbHoldingsToRaw(dbHoldings);
                setIsDbConnected(true);
                setDbConnection('connected');
                console.log('[useLivePortfolio] Loaded', portfolioData.length, 'holdings from database');
            } catch (dbError) {
                console.warn('[useLivePortfolio] Portfolio database not reachable', dbError);
                setIsDbConnected(false);
                setDbConnection('unreachable');
                return;
            }

            const empty = portfolioData.length === 0;
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
            markStartup('prices');
            console.log('[useLivePortfolio] Received data for', stockData.size, 'symbols');

            // Remember every live price we got, so future API hiccups fall
            // back to these instead of stale static prices / zero.
            saveLastKnownPrices(stockData);

            // Fetch unified portfolio dividends from backend.
            // Two parallel requests:
            //   1. Per selected FY → drives the per-company holdings table column
            //   2. fy='all'        → drives the Home page summary card (all-time accumulated cash)
            let portfolioDividends: PortfolioDividendsResponse | null = null;
            try {
                const [perFyData, allTimeData] = await Promise.allSettled([
                    fetchPortfolioDividends(dividendFiscalYear),
                    fetchPortfolioDividends('all'),
                ]);

                if (perFyData.status === 'fulfilled') {
                    portfolioDividends = perFyData.value;
                    console.log(`[useLivePortfolio] Loaded unified dividends for FY ${dividendFiscalYear}:`, portfolioDividends?.companies?.length ?? 0, 'companies');
                } else {
                    console.error('[useLivePortfolio] Failed to fetch portfolio dividends', perFyData.reason);
                }

                if (allTimeData.status === 'fulfilled') {
                    setAllTimeDividendCashNet(allTimeData.value.totals.cashNet ?? 0);
                    console.log(`[useLivePortfolio] All-time accumulated cash net: ${allTimeData.value.totals.cashNet}`);
                } else {
                    console.error('[useLivePortfolio] Failed to fetch all-time dividends', allTimeData.reason);
                }
            } catch (e) {
                console.error('[useLivePortfolio] Failed to fetch portfolio dividends', e);
            }

            // Fetch dynamic fundamentals
            let dynamicFundamentals = {};
            try {
                markStartup('dividends');
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

            markStartup('fundamentals');
            setDividendDataLoaded(portfolioDividends ? portfolioDividends.companies.length > 0 : false);

            const newHoldings = buildHoldings(portfolioData, stockData, portfolioDividends, dynamicFundamentals);
            setHoldings(newHoldings);
            setLastUpdated(new Date());

            if (stockData.size === 0) {
                setError('Could not fetch live data. Using cached prices. Check console for details.');
            } else if (stockData.size < symbols.length) {
                setError(`Fetched ${stockData.size}/${symbols.length} stocks. Some using cached prices.`);
            }
        } catch (err) {
            console.error('[useLivePortfolio] Error in fetchData:', err);
            setError('Failed to fetch live prices. Showing last known prices.');
            // Real holdings with last-known prices; no live API data
            if (portfolioData.length > 0) {
                setHoldings(buildHoldings(portfolioData, new Map(), null));
                setLastUpdated(new Date());
            }
        } finally {
            hasLoadedRef.current = true;
            setIsLoading(false);
        }
    }, [buildHoldings, dividendFiscalYear]);

    const refetch = useCallback(async () => {
        clearStockDataCache();
        await fetchData();
    }, [fetchData]);

    // Calculate summary from holdings (including dividend income and bonus value)
    const totalInvested = holdings.reduce((sum, h) => sum + h.totalCost, 0);
    const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalGainLoss = holdings.reduce((sum, h) => sum + h.gainLoss, 0);
    const totalBonusValue = holdings.reduce((sum, h) => sum + (h.bonusShareValue || 0), 0);
    // Summary card uses all-time accumulated cash net (across all FYs), not just the
    // currently-selected FY. This gives a true lifetime income figure.
    // Net Growth = Capital Gain + All-Time Cash Dividends received.
    // Bonus shares are already reflected in Current Value / Capital Gain, so they are
    // intentionally excluded to avoid double-counting.
    const netGrowth = totalGainLoss + allTimeDividendCashNet;

    // Today's change: only holdings with a real current and previous price.
    let todayChange = 0;
    let previousValue = 0;
    let todayCount = 0;
    for (const h of holdings) {
        if (h.previousClose && h.previousClose > 0 && h.currentPrice > 0) {
            todayChange += h.quantity * (h.currentPrice - h.previousClose);
            previousValue += h.quantity * h.previousClose;
            todayCount++;
        }
    }

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
        // All-time accumulated cash dividends across every FY with payouts
        totalDividendIncome: allTimeDividendCashNet,
        totalBonusValue,
        netGrowth,
        netGrowthPercent: holdings.length > 0 && totalInvested > 0
            ? (netGrowth / totalInvested) * 100
            : 0,
        todayChange: todayCount > 0 ? todayChange : undefined,
        todayChangePercent: todayCount > 0 && previousValue > 0 ? (todayChange / previousValue) * 100 : undefined,
    };


    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Tell the launcher (if it opened this tab) that the first load has finished:
    // real data is on screen, or the page is showing the empty / unreachable state.
    useEffect(() => {
        if (dbConnection === 'unreachable' || (!isLoading && lastUpdated)) {
            signalLauncherReady();
        }
    }, [dbConnection, isLoading, lastUpdated]);

    // While the database is unreachable, check for it in the background and
    // load the real portfolio as soon as it answers.
    useEffect(() => {
        if (dbConnection !== 'unreachable') return;
        let cancelled = false;
        const timer = setInterval(async () => {
            if (!cancelled && await isServerRunning()) {
                clearInterval(timer);
                if (!cancelled) fetchData();
            }
        }, RECONNECT_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [dbConnection, fetchData]);

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
        dbConnection,
        dividendDataLoaded,
        isEmpty,
        dividendFiscalYear,
        setDividendFiscalYear,
    };
};
