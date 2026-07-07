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

/**
 * Fetch stock data for a single symbol
 * 
 * @param symbol - NEPSE stock symbol (e.g., "NABIL", "HBL", "CHCL")
 * @returns ShareBazaarResponse or null if fetch fails
 * 
 * @example
 * const data = await fetchStockData("NABIL");
 * console.log(data.company_name); // "Nabil Bank Limited"
 * console.log(data.ltp);          // 516
 */
export const fetchStockData = async (symbol: string): Promise<ShareBazaarResponse | null> => {
    try {
        console.log(`[ShareBazaar] Fetching ${symbol}...`);
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

        console.log(`[ShareBazaar] ${symbol} response status: ${response.status}`);
        if (!response.ok) {
            console.error(`[ShareBazaar] Failed to fetch data for ${symbol}: ${response.status}`);
            return null;
        }
        const data = await response.json();
        console.log(`[ShareBazaar] ${symbol} data:`, data);
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
 * Uses staggered requests (100ms delay between each) to avoid
 * overwhelming the API and potential rate limiting.
 * 
 * @param symbols - Array of NEPSE stock symbols
 * @returns Map of symbol -> ShareBazaarResponse
 * 
 * @example
 * const data = await fetchMultipleStockData(["NABIL", "HBL", "CHCL"]);
 * data.forEach((response, symbol) => {
 *   console.log(`${symbol}: Rs. ${response.ltp}`);
 * });
 */
export const fetchMultipleStockData = async (
    symbols: string[]
): Promise<Map<string, ShareBazaarResponse>> => {
    const results = new Map<string, ShareBazaarResponse>();

    // Fetch all symbols in parallel with a small delay to avoid rate limiting
    // Reduced delay from 100ms to 50ms for faster loading
    const fetchPromises = symbols.map(async (symbol, index) => {
        // Add a small staggered delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, index * 50));
        const data = await fetchStockData(symbol);
        if (data) {
            results.set(symbol, data);
        }
        return { symbol, data };
    });

    await Promise.all(fetchPromises);
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
