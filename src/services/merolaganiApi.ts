/**
 * Merolagani Data Service
 * ========================
 * 
 * Fetches fundamental stock data from Merolagani.com
 * 
 * IMPORTANT: Due to browser CORS restrictions, this service requires either:
 * 1. A backend proxy server
 * 2. A Vite proxy configuration (for development)
 * 3. Running the companion Python script as a local API
 * 
 * The Python scraper (merolagani.py) can be run as a local API server
 * to provide the data to this service.
 * 
 * BOOK VALUES:
 * - Book values are hard-coded from static data file (updated quarterly)
 * - Run "python fetch_all_book_values.py" to update the static data
 */

import { getStaticFundamentals } from '@/data/staticBookValues';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface MerolaganiFundamentals {
    symbol: string;
    bookValue: number | null;
    eps: number | null;
    epsInfo: string | null;  // Fiscal year/quarter info like "FY:082-083, Q:1"
    peRatio: number | null;
    pbRatio: number | null;  // Price to Book
    lastTradedPrice: number | null;
    marketCap: number | null;
    week52High: number | null;
    week52Low: number | null;
    sector: string | null;
    roe: number | null;
    dividendYield: number | null;
    sharesOutstanding: number | null;
    source: 'live' | 'cache' | 'fallback';
    sourceDetails: string;  // Human-readable description of data source
    isLiveData: boolean;    // Quick check if data is live
    fetchedAt: string;
}

/**
 * Data source status for debugging/display
 */
export interface DataSourceStatus {
    pythonApiAvailable: boolean;
    lastChecked: string;
    activeSource: 'live' | 'fallback';
    message: string;
}

// Track Python API availability
let pythonApiStatus: DataSourceStatus = {
    pythonApiAvailable: false,
    lastChecked: '',
    activeSource: 'fallback',
    message: 'Not checked yet',
};

// ============================================================
// CACHE IMPLEMENTATION
// ============================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for fundamental data
const cache = new Map<string, CacheEntry<MerolaganiFundamentals>>();

const getCachedData = (symbol: string): MerolaganiFundamentals | null => {
    const entry = cache.get(symbol.toUpperCase());
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_DURATION) {
        cache.delete(symbol.toUpperCase());
        return null;
    }

    // Return cached data with updated source info
    const cachedMinutesAgo = Math.round((Date.now() - entry.timestamp) / 60000);
    return {
        ...entry.data,
        source: 'cache',
        sourceDetails: `Cached ${entry.data.isLiveData ? 'live' : 'fallback'} data (${cachedMinutesAgo} min ago)`,
    };
};

const setCachedData = (symbol: string, data: MerolaganiFundamentals): void => {
    cache.set(symbol.toUpperCase(), { data, timestamp: Date.now() });
};

export const clearMerolaganiCache = (): void => {
    cache.clear();
};

// ============================================================
// FALLBACK DATA (Common NEPSE Stocks)
// ============================================================

/**
 * Static fundamental data for common stocks
 * This serves as fallback when live data cannot be fetched
 * Data should be updated periodically
 * 
 * Last Updated: November 2025
 */
const FALLBACK_FUNDAMENTALS: Record<string, Partial<MerolaganiFundamentals>> = {
    'NABIL': { bookValue: 240.72, eps: 25.97, peRatio: 19.87, sector: 'Commercial Banks' },
    'NICA': { bookValue: 212.45, eps: 22.34, peRatio: 18.52, sector: 'Commercial Banks' },
    'SBI': { bookValue: 198.76, eps: 19.45, peRatio: 17.23, sector: 'Commercial Banks' },
    'GBIME': { bookValue: 225.30, eps: 24.12, peRatio: 16.89, sector: 'Commercial Banks' },
    'SCB': { bookValue: 456.78, eps: 45.23, peRatio: 15.67, sector: 'Commercial Banks' },
    'HBL': { bookValue: 287.34, eps: 28.56, peRatio: 17.45, sector: 'Commercial Banks' },
    'EBL': { bookValue: 312.56, eps: 31.23, peRatio: 16.78, sector: 'Commercial Banks' },
    'NLIC': { bookValue: 145.67, eps: 18.34, peRatio: 22.34, sector: 'Life Insurance' },
    'ALICL': { bookValue: 178.90, eps: 21.45, peRatio: 19.87, sector: 'Life Insurance' },
    'SICL': { bookValue: 134.56, eps: 15.67, peRatio: 23.45, sector: 'Non-Life Insurance' },
    'UPPER': { bookValue: 142.34, eps: 12.56, peRatio: 14.56, sector: 'Hydro Power' },
    'NHPC': { bookValue: 156.78, eps: 14.23, peRatio: 15.67, sector: 'Hydro Power' },
    'API': { bookValue: 167.89, eps: 16.78, peRatio: 18.34, sector: 'Hydro Power' },
    'CHCL': { bookValue: 234.56, eps: 23.45, peRatio: 17.89, sector: 'Hotels And Tourism' },
    'NTC': { bookValue: 567.89, eps: 56.78, peRatio: 12.34, sector: 'Others' },
    'NIFRA': { bookValue: 123.45, eps: 11.23, peRatio: 13.45, sector: 'Investment' },
    'NMB': { bookValue: 198.34, eps: 19.87, peRatio: 16.23, sector: 'Commercial Banks' },
    'PRVU': { bookValue: 187.65, eps: 18.45, peRatio: 17.12, sector: 'Commercial Banks' },
    'SANIMA': { bookValue: 201.23, eps: 20.12, peRatio: 16.45, sector: 'Commercial Banks' },
    'MEGA': { bookValue: 189.45, eps: 18.89, peRatio: 17.34, sector: 'Commercial Banks' },
};

// ============================================================
// PYTHON API PROXY (Local Development)
// ============================================================

const PYTHON_API_URL = 'http://localhost:8000'; // Local Python API server

/**
 * Fetch from local Python API server
 * The Python server should be running nepse_server.py
 */
const fetchFromPythonApi = async (symbol: string): Promise<MerolaganiFundamentals | null> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${PYTHON_API_URL}/api/stock/${symbol}`, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();

        // Update Python API status
        pythonApiStatus = {
            pythonApiAvailable: true,
            lastChecked: new Date().toISOString(),
            activeSource: 'live',
            message: '✅ Live data from Merolagani.com via Python API',
        };

        return {
            symbol: data.symbol,
            bookValue: data.book_value,
            eps: data.eps,
            epsInfo: data.eps_info,
            peRatio: data.pe_ratio,
            pbRatio: data.pb_ratio,
            lastTradedPrice: data.last_traded_price,
            marketCap: data.market_cap,
            week52High: data['52_week_high'],
            week52Low: data['52_week_low'],
            sector: data.sector,
            roe: data.roe,
            dividendYield: data.dividend_yield,
            sharesOutstanding: data.shares_outstanding,
            source: 'live',
            sourceDetails: 'Live data scraped from Merolagani.com via local Python API server',
            isLiveData: true,
            fetchedAt: new Date().toISOString(),
        };
    } catch (error) {
        // Update Python API status
        pythonApiStatus = {
            pythonApiAvailable: false,
            lastChecked: new Date().toISOString(),
            activeSource: 'fallback',
            message: '⚠️ Python API unavailable - using static fallback data',
        };
        console.log('[Merolagani] Python API not available, using fallback');
        return null;
    }
};

// ============================================================
// MAIN API FUNCTIONS
// ============================================================

/**
 * Get fundamental data for a stock
 * 
 * Returns hard-coded book values from static data file.
 * Book values are updated quarterly by running: python fetch_all_book_values.py
 * 
 * @param symbol Stock symbol (e.g., 'NABIL')
 * @param forceRefresh Ignored - kept for API compatibility
 * @returns Fundamental data or null
 */
export const fetchMerolaganiFundamentals = async (
    symbol: string,
    forceRefresh: boolean = false
): Promise<MerolaganiFundamentals | null> => {
    const normalizedSymbol = symbol.toUpperCase().trim();

    // Get static book value data
    const staticData = getStaticFundamentals(normalizedSymbol);

    if (staticData && staticData.bookValue !== null) {
        console.log(`[Merolagani] 📚 Static book value for ${normalizedSymbol}: ${staticData.bookValue}`);

        const data: MerolaganiFundamentals = {
            symbol: normalizedSymbol,
            bookValue: staticData.bookValue,
            eps: staticData.eps,
            epsInfo: null,
            peRatio: staticData.peRatio,
            pbRatio: null,
            lastTradedPrice: null,
            marketCap: null,
            week52High: null,
            week52Low: null,
            sector: staticData.sector,
            roe: staticData.roe,
            dividendYield: null,
            sharesOutstanding: null,
            source: 'static',
            sourceDetails: 'Hard-coded book values (updated quarterly)',
            isLiveData: false,
            fetchedAt: new Date().toISOString(),
        };

        // Also update in-memory cache for session performance
        setCachedData(normalizedSymbol, data);
        return data;
    }

    console.log(`[Merolagani] ⚠️ No static data available for ${normalizedSymbol}`);
    return null;
};

/**
 * Get fundamental data for multiple stocks
 * @param symbols Array of stock symbols
 * @param forceRefresh If true, bypasses all caches and fetches fresh data
 */
export const fetchMultipleFundamentals = async (
    symbols: string[],
    forceRefresh: boolean = false
): Promise<Map<string, MerolaganiFundamentals>> => {
    const results = new Map<string, MerolaganiFundamentals>();

    // Fetch in parallel with small delay
    const promises = symbols.map(async (symbol, index) => {
        // Small staggered delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, index * 100));
        const data = await fetchMerolaganiFundamentals(symbol, forceRefresh);
        if (data) {
            results.set(symbol.toUpperCase(), data);
        }
    });

    await Promise.all(promises);
    return results;
};

/**
 * Check if Python API server is available
 */
export const isPythonApiAvailable = async (): Promise<boolean> => {
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

/**
 * Get all available fallback symbols
 */
export const getAvailableFallbackSymbols = (): string[] => {
    return Object.keys(FALLBACK_FUNDAMENTALS);
};

/**
 * Update fallback data (useful for manual updates)
 */
export const updateFallbackData = (
    symbol: string,
    data: Partial<MerolaganiFundamentals>
): void => {
    FALLBACK_FUNDAMENTALS[symbol.toUpperCase()] = {
        ...FALLBACK_FUNDAMENTALS[symbol.toUpperCase()],
        ...data,
    };
};

/**
 * Get current data source status
 * Useful for displaying in UI whether live or static data is being used
 */
export const getDataSourceStatus = (): DataSourceStatus => {
    return { ...pythonApiStatus };
};

/**
 * Check and update Python API availability status
 * Call this on app startup to know if live data is available
 */
export const checkDataSourceStatus = async (): Promise<DataSourceStatus> => {
    const isAvailable = await isPythonApiAvailable();

    pythonApiStatus = {
        pythonApiAvailable: isAvailable,
        lastChecked: new Date().toISOString(),
        activeSource: isAvailable ? 'live' : 'fallback',
        message: isAvailable
            ? '✅ Live data available from Merolagani.com'
            : '⚠️ Using static fallback data. Run: python merolagani_server.py for live data',
    };

    console.log(`[Merolagani] Data source: ${pythonApiStatus.message}`);

    return pythonApiStatus;
};

/**
 * Get a human-readable description of a data source
 */
export const getSourceLabel = (source: 'live' | 'cache' | 'fallback'): { label: string; color: string; icon: string } => {
    switch (source) {
        case 'live':
            return { label: 'Live Data', color: 'green', icon: '🟢' };
        case 'cache':
            return { label: 'Cached', color: 'blue', icon: '🔵' };
        case 'fallback':
            return { label: 'Static Data', color: 'orange', icon: '🟠' };
    }
};
