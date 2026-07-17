/**
 * Received Dividends API Service
 * ==============================
 * Talks to nepse_server.py's auto-dividend endpoints:
 *   GET  /api/dividends/portfolio?fy=081-082  - computed per-holding dividend impact
 *   POST /api/dividends/refresh               - re-scrape announcements (NepaliPaisa)
 */

const API_BASE = import.meta.env.DEV
    ? '/api/nepse-server/api'
    : 'http://localhost:8000/api';

export interface SharePoint {
    date: string;   // YYYY-MM-DD (AD)
    shares: number;
}

export interface ReceivedDividend {
    bonusShares: number;
    bonusSharesExact: number;
    cashGross: number;
    cashNet: number;
    bonusTaxDue: number;
    manualCashIncome: number | null;
}

export interface CompanyDividend {
    symbol: string;
    companyName: string;
    quantity: number;
    paidUpValue: number;
    fiscalYear: string;
    bonusPercent: number;
    cashPercent: number;
    totalPercent: number;
    bookClosureDateAD: string;
    bookClosureDateBS: string;
    status: 'announced' | 'book-closure-upcoming' | 'book-closed';
    source: 'auto' | 'manual' | 'manual-override';
    received: ReceivedDividend;
    shareTimeline: SharePoint[];
}

export interface PortfolioDividendsResponse {
    fiscalYear: string;
    receiveWindow: { start: string; end: string };
    taxRate: number;
    totals: {
        cashGross: number;
        cashNet: number;
        bonusShares: number;
        bonusTaxDue: number;
        companiesPaying: number;
    };
    companies: CompanyDividend[];
}

export async function fetchPortfolioDividends(fy: string): Promise<PortfolioDividendsResponse> {
    const response = await fetch(`${API_BASE}/dividends/portfolio?fy=${encodeURIComponent(fy)}`, {
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch portfolio dividends: ${response.status}`);
    }
    return response.json();
}

export async function refreshDividendAnnouncements(): Promise<{ message: string; partial: boolean; log: string }> {
    const response = await fetch(`${API_BASE}/dividends/refresh`, {
        method: 'POST',
        signal: AbortSignal.timeout(180000), // scraping ~26 symbols takes a while
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Refresh failed: ${response.status}`);
    }
    return response.json();
}
