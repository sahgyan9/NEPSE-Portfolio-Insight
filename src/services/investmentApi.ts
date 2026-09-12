/**
 * Investment & Market Intelligence API Service
 * ============================================
 * Fetches upcoming/active IPOs, Right Shares, and 52-Week High/Low breakout scanners
 * from nepse_server (backed by HamroShare RSC streams).
 */

const NEPSE_SERVER_URL = import.meta.env.DEV
    ? '/api/nepse-server'
    : 'http://localhost:8000';

export interface CorporateIssue {
    symbol: string | null;
    company_name: string;
    share_type: string;
    issue_price: number;
    total_units: number;
    opening_date: string | null;
    closing_date: string | null;
    final_date: string | null;
    status: 'Open' | 'Upcoming' | 'Closed';
}

export interface HighLowScannerRow {
    symbol: string;
    company_name: string;
    sector: string;
    ltp: number;
    change_pct: number;
    high_52: number;
    low_52: number;
    pct_from_high: number;
    pct_from_low: number;
}

/**
 * Fetch upcoming and open IPOs, Right Shares, and Mutual Funds
 */
export async function fetchCorporateIssues(): Promise<CorporateIssue[]> {
    try {
        const resp = await fetch(`${NEPSE_SERVER_URL}/api/investment/ipos`, {
            headers: { 'Accept': 'application/json' }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.issues || [];
    } catch (e) {
        console.error('[investmentApi] Failed to fetch corporate issues:', e);
        return [];
    }
}

/**
 * Fetch 52-week High/Low breakout scanner
 */
export async function fetchHighLowScanner(): Promise<HighLowScannerRow[]> {
    try {
        const resp = await fetch(`${NEPSE_SERVER_URL}/api/market/high-low-scanner`, {
            headers: { 'Accept': 'application/json' }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.rows || [];
    } catch (e) {
        console.error('[investmentApi] Failed to fetch 52w scanner:', e);
        return [];
    }
}
