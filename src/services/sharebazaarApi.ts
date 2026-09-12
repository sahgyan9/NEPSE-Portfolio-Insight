/**
 * ShareBazaar API Service
 * ========================
 * 
 * Fetches real-time stock data from Nepal Stock Exchange (NEPSE).
 * 
 * API Documentation:
 * - Base URL: https://sharebazaar.vercel.app/api
 * - Endpoint: /api?symbol={StockSymbol}
 * - Method: GET
 * - No authentication required
 * - CORS enabled
 * 
 * Example Request:
 *   GET https://sharebazaar.vercel.app/api?symbol=NABIL
 * 
 * Example Response:
 *   {
 *     "id": "NABIL",
 *     "symbol": "NABIL",
 *     "company_name": "Nabil Bank Limited",
 *     "ltp": 516,
 *     "last_updated": "2025-11-30T05:40:06.150Z"
 *   }
 * 
 * Notes:
 * - Some mutual funds may not return company_name (returns empty string)
 * - LTP = Last Traded Price in NPR
 * - Data availability depends on NEPSE market hours
 * 
 * @see https://github.com/AarjavJain101/sharebazaar for API source
 */

/**
 * Response structure from ShareBazaar API
 * 
 * @property id - Stock symbol (same as symbol)
 * @property symbol - NEPSE stock symbol (e.g., "NABIL", "HBL")
 * @property company_name - Full company name (may be empty for some mutual funds)
 * @property ltp - Last Traded Price in NPR
 * @property last_updated - ISO timestamp of last update
 */
export interface ShareBazaarResponse {
    id: string;
    symbol: string;
    company_name: string;
    ltp: number;
    last_updated: string;
    // Optional fields that may be present in future API versions
    change?: number;
    changePercent?: number;
    previousClose?: number;
    volume?: number;
}

// Use Vite proxy in development to avoid CORS issues
// In production, you may need to set up your own backend proxy
const API_BASE_URL = import.meta.env.DEV
    ? '/api/sharebazaar'  // Proxied through Vite dev server
    : 'https://sharebazaar.vercel.app/api';  // Direct in production

const NEPSE_SERVER_URL = import.meta.env.DEV
    ? '/api/nepse-server'
    : 'http://localhost:8000';

/**
 * Fast in-memory cache of the full live market snapshot (all 345+ stocks).
 * Refreshed every 15 seconds to minimize backend network calls.
 */
let liveMarketSnapshotCache: Map<string, ShareBazaarResponse> | null = null;
let liveMarketSnapshotTimestamp = 0;
const LIVE_MARKET_SNAPSHOT_TTL = 15 * 1000; // 15 seconds

/**
 * Fetch all live stock prices in a single call from nepse_server (HamroShare CDN stream).
 * Returns Map of symbol -> ShareBazaarResponse or null if nepse_server is unavailable.
 */
async function fetchFromNepseServer(): Promise<Map<string, ShareBazaarResponse> | null> {
    const now = Date.now();
    if (liveMarketSnapshotCache && (now - liveMarketSnapshotTimestamp) < LIVE_MARKET_SNAPSHOT_TTL) {
        return liveMarketSnapshotCache;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s strict timeout

        const response = await fetch(`${NEPSE_SERVER_URL}/api/live-market`, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();
        const stocks = data?.stocks;
        if (!stocks || typeof stocks !== 'object') return null;

        const results = new Map<string, ShareBazaarResponse>();
        for (const [sym, s] of Object.entries<any>(stocks)) {
            const symUpper = sym.toUpperCase().trim();
            results.set(symUpper, {
                id: symUpper,
                symbol: symUpper,
                company_name: s.name || symUpper,
                ltp: Number(s.ltp) || 0,
                last_updated: s.updated_at || new Date().toISOString(),
                change: Number(s.change) || 0,
                changePercent: Number(s.change_pct) || 0,
                previousClose: Number(s.previous_close) || 0,
                volume: Number(s.volume) || 0,
            });
        }

        liveMarketSnapshotCache = results;
        liveMarketSnapshotTimestamp = now;
        return results;
    } catch (e) {
        return null;
    }
}

/**
 * Fetch stock data for a single symbol
 * 
 * Priority:
 * 1. Local NEPSE Server (HamroShare live market stream, ~5ms)
 * 2. ShareBazaar Vercel API fallback
 * 
 * @param symbol - NEPSE stock symbol (e.g., "NABIL", "HBL", "CHCL")
 * @returns ShareBazaarResponse or null if fetch fails
 */
export const fetchStockData = async (symbol: string): Promise<ShareBazaarResponse | null> => {
    const symUpper = symbol.trim().toUpperCase();

    // 1. Try primary high-speed local server first
    try {
        const localMarket = await fetchFromNepseServer();
        if (localMarket && localMarket.has(symUpper)) {
            const stock = localMarket.get(symUpper)!;
            if (stock.ltp > 0) {
                return stock;
            }
        }
    } catch (err) {
        // Fall back to ShareBazaar
    }

    // 2. Fallback: ShareBazaar Vercel API
    try {
        if (import.meta.env.DEV) {
            console.log(`[ShareBazaar] Fetching ${symbol}...`);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${API_BASE_URL}?symbol=${symbol}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[ShareBazaar] Failed to fetch data for ${symbol}: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error(`[ShareBazaar] Request timeout for ${symbol}`);
        } else {
            console.error(`[ShareBazaar] Error fetching data for ${symbol}:`, error);
        }
        return null;
    }
};

/**
 * Fetch stock data for multiple symbols in parallel
 * 
 * Priority:
 * 1. Resolves all available symbols from local NEPSE Server (HamroShare) in ONE call (<5ms)
 * 2. Only fetches missing/unresolved symbols from ShareBazaar Vercel in batches of 5
 * 
 * @param symbols - Array of NEPSE stock symbols
 * @returns Map of symbol -> ShareBazaarResponse
 */
export const fetchMultipleStockData = async (
    symbols: string[]
): Promise<Map<string, ShareBazaarResponse>> => {
    const results = new Map<string, ShareBazaarResponse>();
    const normalizedSymbols = symbols.map(s => s.trim().toUpperCase());

    // 1. Primary: High-speed local NEPSE Server (backed by HamroShare RSC stream)
    const localLiveMarket = await fetchFromNepseServer();
    const remainingToFetch: string[] = [];

    if (localLiveMarket && localLiveMarket.size > 0) {
        for (const sym of normalizedSymbols) {
            const found = localLiveMarket.get(sym);
            if (found && found.ltp > 0) {
                results.set(sym, found);
            } else {
                remainingToFetch.push(sym);
            }
        }

        // If all symbols were resolved, return immediately without hitting external web!
        if (remainingToFetch.length === 0) {
            return results;
        }
    } else {
        remainingToFetch.push(...normalizedSymbols);
    }

    // 2. Secondary Fallback: ShareBazaar Vercel API in chunks of 5 for missing symbols
    const batchSize = 5;
    for (let i = 0; i < remainingToFetch.length; i += batchSize) {
        const batch = remainingToFetch.slice(i, i + batchSize);
        const promises = batch.map(async (symbol) => {
            const data = await fetchStockData(symbol);
            if (data) {
                results.set(symbol.toUpperCase(), data);
            }
        });
        await Promise.allSettled(promises);
    }

    return results;
};

/**
 * In-Memory Cache Implementation
 * 
 * Caches API responses to reduce network calls and improve performance.
 * Cache invalidates after CACHE_DURATION (5 minutes by default).
 * 
 * Why 5 minutes?
 * - NEPSE updates prices during market hours
 * - Balances freshness with API efficiency
 * - User can force refresh with refetch()
 */
let stockDataCache: Map<string, ShareBazaarResponse> = new Map();
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached stock data or fetch fresh data
 * 
 * Implements a simple time-based cache strategy:
 * 1. If cache is valid (< 5 min old) and has all symbols, return cached
 * 2. Otherwise, fetch fresh data and update cache
 * 
 * @param symbols - Array of NEPSE stock symbols to fetch
 * @returns Map of symbol -> ShareBazaarResponse
 */
export const getCachedStockData = async (
    symbols: string[]
): Promise<Map<string, ShareBazaarResponse>> => {
    const now = Date.now();

    // Check if cache is still valid
    if (now - cacheTimestamp < CACHE_DURATION && stockDataCache.size > 0) {
        // Return cached data for requested symbols
        const cachedResults = new Map<string, ShareBazaarResponse>();
        symbols.forEach(symbol => {
            const cached = stockDataCache.get(symbol);
            if (cached) {
                cachedResults.set(symbol, cached);
            }
        });

        // If we have all symbols cached, return them
        if (cachedResults.size === symbols.length) {
            return cachedResults;
        }
    }

    // Fetch fresh data
    const freshData = await fetchMultipleStockData(symbols);

    // Update cache
    freshData.forEach((value, key) => {
        stockDataCache.set(key, value);
    });
    cacheTimestamp = now;

    return freshData;
};

/**
 * Clear the stock data cache
 */
export const clearStockDataCache = () => {
    stockDataCache.clear();
    cacheTimestamp = 0;
};
