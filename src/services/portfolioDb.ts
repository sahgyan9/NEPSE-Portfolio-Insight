/**
 * Portfolio Database Service
 * 
 * This service communicates with the local Python database server
 * to manage portfolio holdings and track value history over time.
 */

const API_BASE = import.meta.env.DEV
    ? '/api/portfolio-db/api'
    : 'http://localhost:5001/api';

export type TimePeriod = "1d" | "1w" | "1m" | "3m" | "6m" | "1y" | "all";

export interface DBHolding {
    symbol: string;
    company: string;
    quantity: number;
    avgCost: number;
    dateAdded: string;
}

export interface CachedFundamentals {
    symbol: string;
    bookValue: number;
    eps: number;
    pe: number;
    pbv: number;
    roe: number;
    cachedAt: string; // ISO date string
}

export interface FundamentalsCache {
    [symbol: string]: CachedFundamentals;
}

export interface DBTransaction {
    type: "BUY" | "SELL";
    symbol: string;
    quantity: number;
    price: number;
    date: string;
}

export interface ValueHistoryPoint {
    date: string;
    invested: number;
    value: number;
}

export interface ValueHistoryStats {
    min: number;
    max: number;
    avg: number;
    first: number;
    last: number;
    change: number;
    changePercent: number;
    dataPoints: number;
}

export interface PortfolioSummaryFromDB {
    totalInvested: number;
    currentValue: number;
    totalHoldings: number;
    gainLoss: number;
    gainLossPercent: number;
}

/**
 * Check if the database server is running
 */
export async function isServerRunning(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/holdings`, {
            method: "GET",
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get all holdings from the database
 */
export async function getHoldings(): Promise<DBHolding[]> {
    const response = await fetch(`${API_BASE}/holdings`);
    if (!response.ok) throw new Error("Failed to fetch holdings");
    const data = await response.json();
    return data.holdings;
}

/**
 * Get portfolio value history for charts
 * @param period - Time period filter: 1d, 1w, 1m, 3m, 6m, 1y, or all
 */
export async function getValueHistory(period: TimePeriod = "all"): Promise<ValueHistoryPoint[]> {
    const response = await fetch(`${API_BASE}/value-history?period=${period}`);
    if (!response.ok) throw new Error("Failed to fetch value history");
    const data = await response.json();
    return data.history;
}

/**
 * Get value history statistics for a period
 */
export async function getValueHistoryStats(period: TimePeriod = "all"): Promise<ValueHistoryStats> {
    const response = await fetch(`${API_BASE}/value-history/stats?period=${period}`);
    if (!response.ok) throw new Error("Failed to fetch value history stats");
    return response.json();
}

/**
 * Get transaction history
 * @param period - Time period filter: 1d, 1w, 1m, 3m, 6m, 1y, or all
 */
export async function getTransactions(period: TimePeriod = "all"): Promise<DBTransaction[]> {
    const response = await fetch(`${API_BASE}/transactions?period=${period}`);
    if (!response.ok) throw new Error("Failed to fetch transactions");
    const data = await response.json();
    return data.transactions;
}

/**
 * Get portfolio summary
 */
export async function getPortfolioSummaryFromDB(): Promise<PortfolioSummaryFromDB> {
    const response = await fetch(`${API_BASE}/summary`);
    if (!response.ok) throw new Error("Failed to fetch summary");
    return response.json();
}

/**
 * Add a new stock or add to existing position
 */
export async function addStock(
    symbol: string,
    company: string,
    quantity: number,
    avgCost: number
): Promise<{ success: boolean; action: string; holdings: DBHolding[] }> {
    const response = await fetch(`${API_BASE}/holdings/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, company, quantity, avgCost }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add stock");
    }

    return response.json();
}

/**
 * Sell stock (reduce or remove position)
 */
export async function sellStock(
    symbol: string,
    quantity: number,
    sellPrice?: number
): Promise<{ success: boolean; action: string; holdings: DBHolding[] }> {
    const response = await fetch(`${API_BASE}/holdings/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, quantity, sellPrice }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sell stock");
    }

    return response.json();
}

/**
 * Record current portfolio value (call this periodically to track history)
 */
export async function recordPortfolioValue(
    currentValue: number
): Promise<{ success: boolean; history: ValueHistoryPoint[] }> {
    const response = await fetch(`${API_BASE}/value-history/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentValue }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to record value");
    }

    return response.json();
}

/**
 * Delete a stock completely from portfolio
 */
export async function deleteStock(symbol: string): Promise<{ success: boolean; holdings: DBHolding[] }> {
    const response = await fetch(`${API_BASE}/holdings?symbol=${symbol}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete stock");
    }

    return response.json();
}

/**
 * Clean up value history (remove zeros, duplicates)
 */
export async function cleanupValueHistory(): Promise<{
    success: boolean;
    originalCount: number;
    cleanedCount: number;
    removed: number;
}> {
    const response = await fetch(`${API_BASE}/value-history/cleanup`);
    if (!response.ok) throw new Error("Failed to cleanup value history");
    return response.json();
}

/**
 * Get cached fundamentals for a symbol
 * Returns null if not cached or if cache is stale (>90 days old)
 */
export function getCachedFundamentals(symbol: string): CachedFundamentals | null {
    try {
        const cacheJson = localStorage.getItem('fundamentalsCache');
        if (!cacheJson) return null;

        const cache: FundamentalsCache = JSON.parse(cacheJson);
        const cached = cache[symbol];

        if (!cached) return null;

        // Check if cache is stale (>90 days old)
        const cachedDate = new Date(cached.cachedAt);
        const now = new Date();
        const daysDiff = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > 90) {
            return null; // Cache is stale
        }

        return cached;
    } catch {
        return null;
    }
}

/**
 * Set cached fundamentals for a symbol
 */
export function setCachedFundamentals(symbol: string, fundamentals: Omit<CachedFundamentals, 'cachedAt' | 'symbol'>): void {
    try {
        const cacheJson = localStorage.getItem('fundamentalsCache');
        const cache: FundamentalsCache = cacheJson ? JSON.parse(cacheJson) : {};

        cache[symbol] = {
            symbol,
            ...fundamentals,
            cachedAt: new Date().toISOString()
        };

        localStorage.setItem('fundamentalsCache', JSON.stringify(cache));
    } catch (error) {
        console.error('Failed to cache fundamentals:', error);
    }
}

/**
 * Get all cached fundamentals
 */
export function getAllCachedFundamentals(): FundamentalsCache {
    try {
        const cacheJson = localStorage.getItem('fundamentalsCache');
        return cacheJson ? JSON.parse(cacheJson) : {};
    } catch {
        return {};
    }
}

/**
 * Clear fundamentals cache for a specific symbol or all symbols
 */
export function clearFundamentalsCache(symbol?: string): void {
    try {
        if (!symbol) {
            // Clear all cache
            localStorage.removeItem('fundamentalsCache');
        } else {
            // Clear specific symbol
            const cacheJson = localStorage.getItem('fundamentalsCache');
            if (!cacheJson) return;

            const cache: FundamentalsCache = JSON.parse(cacheJson);
            delete cache[symbol];
            localStorage.setItem('fundamentalsCache', JSON.stringify(cache));
        }
    } catch (error) {
        console.error('Failed to clear fundamentals cache:', error);
    }
}
