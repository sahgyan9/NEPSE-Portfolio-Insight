/**
 * Dividend API Service
 * =====================
 * 
 * Fetches dividend history data from Merolagani via local Python API server
 * 
 * API Endpoints:
 *   GET /api/dividend/<symbol> - Get dividend history for a single stock
 *   GET /api/dividends?symbols=X,Y,Z - Get dividend history for multiple stocks
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface DividendEntry {
    fiscal_year: string;
    fiscal_year_clean?: string;
    value_raw: string;
    value: number | string;
    type: 'percentage' | 'ratio' | 'unknown';
}

export interface DividendHistory {
    symbol: string;
    cash_dividends: DividendEntry[];
    bonus_dividends: DividendEntry[];
    right_shares: DividendEntry[];
    latest_cash_dividend: DividendEntry | null;
    latest_bonus_dividend: DividendEntry | null;
    latest_total_dividend: number;
    source: 'live' | 'cache' | 'error';
    timestamp: string;
    error?: string;
}

// ============================================================
// CACHE IMPLEMENTATION
// ============================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour for dividend data (doesn't change often)
const cache = new Map<string, CacheEntry<DividendHistory>>();

const getCachedData = (symbol: string): DividendHistory | null => {
    const entry = cache.get(symbol.toUpperCase());
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_DURATION) {
        cache.delete(symbol.toUpperCase());
        return null;
    }

    return entry.data;
};

const setCachedData = (symbol: string, data: DividendHistory): void => {
    cache.set(symbol.toUpperCase(), { data, timestamp: Date.now() });
};

export const clearDividendCache = (): void => {
    cache.clear();
};

// ============================================================
// API FUNCTIONS
// ============================================================

const PYTHON_API_URL = import.meta.env.DEV
    ? '/api/nepse-server'
    : 'http://localhost:8000';

/**
 * Fetch dividend history for a single stock
 */
export const fetchDividendHistory = async (symbol: string): Promise<DividendHistory | null> => {
    // Check cache first
    const cached = getCachedData(symbol);
    if (cached) {
        console.log(`[Dividend] Using cached data for ${symbol}`);
        return cached;
    }

    try {
        console.log(`[Dividend] Fetching dividend history for ${symbol}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${PYTHON_API_URL}/api/dividend/${symbol}`, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[Dividend] Failed to fetch for ${symbol}: ${response.status}`);
            return null;
        }

        const data: DividendHistory = await response.json();
        console.log(`[Dividend] ${symbol} latest dividend: ${data.latest_total_dividend}%`);

        setCachedData(symbol, data);
        return data;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error(`[Dividend] Request timeout for ${symbol}`);
        } else {
            console.error(`[Dividend] Error fetching data for ${symbol}:`, error);
        }
        return null;
    }
};

/**
 * Fetch dividend history for multiple stocks
 */
export const fetchDividendsForSymbols = async (symbols: string[]): Promise<Map<string, DividendHistory>> => {
    const results = new Map<string, DividendHistory>();

    if (symbols.length === 0) return results;

    // Check which symbols are cached
    const uncachedSymbols: string[] = [];
    for (const symbol of symbols) {
        const cached = getCachedData(symbol);
        if (cached) {
            results.set(symbol.toUpperCase(), cached);
        } else {
            uncachedSymbols.push(symbol);
        }
    }

    if (uncachedSymbols.length === 0) {
        console.log('[Dividend] All symbols found in cache');
        return results;
    }

    console.log(`[Dividend] Fetching ${uncachedSymbols.length} symbols, ${results.size} from cache`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(
            `${PYTHON_API_URL}/api/dividends?symbols=${uncachedSymbols.join(',')}`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[Dividend] Failed to fetch dividends: ${response.status}`);
            return results;
        }

        const data = await response.json();
        const dividends: DividendHistory[] = data.dividends || [];

        for (const dividend of dividends) {
            if (dividend.symbol && !dividend.error) {
                results.set(dividend.symbol.toUpperCase(), dividend);
                setCachedData(dividend.symbol, dividend);
            }
        }

        console.log(`[Dividend] Fetched ${dividends.length} dividend histories`);
    } catch (error) {
        console.error('[Dividend] Error fetching dividends:', error);
    }

    return results;
};

/**
 * Calculate dividend income received based on holdings
 * 
 * @param symbol Stock symbol
 * @param quantity Number of shares owned
 * @param paidUpValue Paid-up value per share (typically Rs. 100 for most NEPSE stocks)
 * @param dividendPercent Dividend percentage (e.g., 12.5 for 12.5%)
 * @returns Dividend income in rupees
 */
export const calculateDividendIncome = (
    quantity: number,
    paidUpValue: number,
    dividendPercent: number
): number => {
    // Dividend income = (Quantity × Paid-up Value × Dividend%) / 100
    return (quantity * paidUpValue * dividendPercent) / 100;
};

/**
 * Default paid-up value for NEPSE stocks
 * Most stocks have Rs. 100 paid-up value, mutual funds have Rs. 10
 */
export const getPaidUpValue = (symbol: string): number => {
    // Mutual funds typically have Rs. 10 paid-up value
    const mutualFundSymbols = ['CSY', 'KDBY', 'MMF1', 'NBF3', 'NIBLSF', 'NMBSBFE'];
    if (mutualFundSymbols.includes(symbol.toUpperCase())) {
        return 10;
    }
    // Most other stocks have Rs. 100 paid-up value
    return 100;
};

/**
 * Check if Python API server is running (for dividend endpoint)
 */
export const isDividendApiAvailable = async (): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${PYTHON_API_URL}/health`, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        return response.ok;
    } catch {
        return false;
    }
};
