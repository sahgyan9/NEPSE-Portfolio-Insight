/**
 * Market Data Service
 * ====================
 * 
 * Provides LIVE market context data for NEPSE.
 * Fetches data from the local NEPSE server (nepse_server.py).
 * 
 * Requirements:
 *   Run: python nepse_server.py
 *   This starts a Flask server on http://localhost:8000
 */

// ============================================================
// CONFIGURATION
// ============================================================

const NEPSE_SERVER_URL = import.meta.env.DEV
    ? '/api/nepse-server'
    : 'http://localhost:8000';
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface MarketSummary {
    totalTurnover: number;
    totalTradedShares: number;
    totalTransactions: number;
    totalScripsTrades: number;
}

export interface NepseIndex {
    index: number;
    change: number;
    percentChange: number;
    high: number;
    low: number;
    previousClose: number;
    timestamp?: string;
}

export interface TopStock {
    symbol: string;
    name: string;
    ltp: number;
    change: number;
    percentChange: number;
    volume?: number;
    turnover?: number;
}

export interface SubIndex {
    name: string;
    value: number;
    change: number;
    percentChange: number;
}

export interface MarketContext {
    summary: MarketSummary | null;
    nepseIndex: NepseIndex | null;
    topGainers: TopStock[];
    topLosers: TopStock[];
    subIndices: SubIndex[];
    lastUpdated: Date;
    isLiveData: boolean;
    dataSource?: 'live' | 'cache' | 'fallback';
}

// ============================================================
// CACHE
// ============================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache: {
    marketSummary?: CacheEntry<MarketContext>;
} = {};

function isCacheValid<T>(entry?: CacheEntry<T>): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

// ============================================================
// FALLBACK DATA (used when server is unavailable)
// ============================================================

const fallbackNepseIndex: NepseIndex = {
    index: 0,
    change: 0,
    percentChange: 0,
    high: 0,
    low: 0,
    previousClose: 0,
    timestamp: new Date().toISOString(),
};

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Check if the NEPSE server is running
 */
export const isServerRunning = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${NEPSE_SERVER_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000),
        });
        return response.ok;
    } catch {
        return false;
    }
};

/**
 * Fetch complete market context from NEPSE server
 */
export const fetchMarketContext = async (): Promise<MarketContext> => {
    // Check cache first
    if (isCacheValid(cache.marketSummary)) {
        console.log('[MarketData] Using cached data');
        return {
            ...cache.marketSummary!.data,
            dataSource: 'cache',
        };
    }

    try {
        const response = await fetch(`${NEPSE_SERVER_URL}/api/market-summary`, {
            method: 'GET',
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        // Transform server response to our format
        const nepseIndex: NepseIndex | null = data.nepse_index ? {
            index: data.nepse_index.value || 0,
            change: data.nepse_index.change || 0,
            percentChange: data.nepse_index.change_pct || 0,
            high: data.nepse_index.high || 0,
            low: data.nepse_index.low || 0,
            previousClose: data.nepse_index.previous_close || 0,
            timestamp: data.timestamp || new Date().toISOString(),
        } : null;

        const topGainers: TopStock[] = (data.top_gainers || []).map((stock: any) => ({
            symbol: stock.symbol || '',
            name: stock.symbol || '', // Name not available from API
            ltp: stock.ltp || 0,
            change: stock.change || 0,
            percentChange: stock.change_pct || 0,
        }));

        const topLosers: TopStock[] = (data.top_losers || []).map((stock: any) => ({
            symbol: stock.symbol || '',
            name: stock.symbol || '', // Name not available from API
            ltp: stock.ltp || 0,
            change: stock.change || 0,
            percentChange: stock.change_pct || 0,
        }));

        const subIndices: SubIndex[] = (data.sub_indices || []).map((idx: any) => ({
            name: idx.name || 'Unknown',
            value: idx.value || 0,
            change: idx.change || 0,
            percentChange: idx.change_pct || 0,
        }));

        const result: MarketContext = {
            summary: null, // Summary details not available from this endpoint
            nepseIndex,
            topGainers,
            topLosers,
            subIndices,
            lastUpdated: new Date(),
            isLiveData: true,
            dataSource: 'live',
        };

        // Update cache
        cache.marketSummary = {
            data: result,
            timestamp: Date.now(),
        };

        console.log('[MarketData] Fetched live data from NEPSE server');
        return result;

    } catch (error) {
        console.error('[MarketData] Error fetching from server:', error);

        // Return cached data if available (even if expired)
        if (cache.marketSummary) {
            console.log('[MarketData] Using expired cache as fallback');
            return {
                ...cache.marketSummary.data,
                dataSource: 'cache',
            };
        }

        // Return fallback data (nepseIndex null so UI shows "unavailable" not "NEPSE 0")
        console.log('[MarketData] Using fallback data - server unavailable');
        return {
            summary: null,
            nepseIndex: null,
            topGainers: [],
            topLosers: [],
            subIndices: [],
            lastUpdated: new Date(),
            isLiveData: false,
            dataSource: 'fallback',
        };
    }
};

/**
 * Fetch just the NEPSE index (lighter request)
 */
export const fetchNepseIndex = async (): Promise<NepseIndex | null> => {
    try {
        const response = await fetch(`${NEPSE_SERVER_URL}/api/index`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        return {
            index: data.value || 0,
            change: data.change || 0,
            percentChange: data.change_pct || 0,
            high: data.high || 0,
            low: data.low || 0,
            previousClose: data.previous_close || 0,
            timestamp: data.timestamp || new Date().toISOString(),
        };
    } catch (error) {
        console.error('[MarketData] Error fetching NEPSE index:', error);
        return null;
    }
};

/**
 * Fetch market status (open/closed)
 */
export const fetchMarketStatus = async (): Promise<{ isOpen: boolean; status: string } | null> => {
    try {
        const response = await fetch(`${NEPSE_SERVER_URL}/api/market-status`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        return {
            isOpen: data.is_open || false,
            status: data.status || 'UNKNOWN',
        };
    } catch (error) {
        console.error('[MarketData] Error fetching market status:', error);
        return null;
    }
};

/**
 * Clear market data cache
 */
export const clearMarketDataCache = (): void => {
    delete cache.marketSummary;
    console.log('[MarketData] Cache cleared');
};
