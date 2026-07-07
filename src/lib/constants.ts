/**
 * Application constants - Centralized configuration
 * Changes here automatically propagate everywhere, reducing bugs
 * and ensuring consistency across the application.
 */

/**
 * Sector colors for consistent visualization across all charts
 */
export const SECTOR_COLORS: Record<string, string> = {
    'Commercial Bank': '#3b82f6',      // Blue
    'Development Bank': '#06b6d4',      // Cyan
    'Hydropower': '#22c55e',            // Green
    'Life Insurance': '#a855f7',        // Purple
    'Non-Life Insurance': '#ec4899',    // Pink
    'Manufacturing': '#f97316',         // Orange
    'Mutual Fund': '#eab308',           // Yellow
    'Telecom': '#14b8a6',               // Teal
    'Investment': '#6366f1',            // Indigo
    'Other': '#64748b',                 // Slate
} as const;

/**
 * Chart color palette for consistent theming
 */
export const CHART_COLORS = {
    positive: '#22c55e',   // Green for gains
    negative: '#ef4444',   // Red for losses
    neutral: '#64748b',    // Gray for neutral
    primary: '#3b82f6',    // Primary blue
    secondary: '#8b5cf6',  // Secondary purple
    accent: '#f59e0b',     // Accent amber
} as const;

/**
 * Thresholds for various calculations and displays
 */
export const THRESHOLDS = {
    // Gain/Loss classifications
    significantGain: 20,      // > 20% is significant gain
    moderateGain: 5,          // > 5% is moderate gain
    significantLoss: -20,     // < -20% is significant loss
    moderateLoss: -5,         // < -5% is moderate loss

    // Valuation thresholds (P/B Ratio)
    undervaluedPB: 1.0,       // P/B < 1 suggests undervalued
    overvaluedPB: 3.0,        // P/B > 3 suggests overvalued

    // Diversification
    minDiversificationScore: 60,  // Below this needs attention

    // Concentration risk
    maxSingleHoldingPercent: 25,  // Single holding > 25% is risky
    maxSectorPercent: 40,         // Single sector > 40% is risky
} as const;

/**
 * Date formats used throughout the application
 */
export const DATE_FORMATS = {
    display: 'MMM dd, yyyy',      // Nov 30, 2025
    short: 'MM/dd/yy',            // 11/30/25
    chart: 'MMM dd',              // Nov 30
    iso: 'yyyy-MM-dd',            // 2025-11-30
} as const;

/**
 * Animation durations for consistent UX
 */
export const ANIMATIONS = {
    fast: 150,
    normal: 300,
    slow: 500,
    chart: 750,
} as const;

/**
 * API configuration
 */
export const API_CONFIG = {
    gemini: {
        model: 'gemini-1.5-flash',
        maxTokens: 2048,
        temperature: 0.7,
    },
} as const;

/**
 * Local storage keys - centralized to prevent typos
 */
export const STORAGE_KEYS = {
    apiKey: 'gemini_api_key',
    theme: 'portfolio_theme',
    preferences: 'user_preferences',
} as const;

/**
 * Route paths
 */
export const ROUTES = {
    home: '/',
    holdings: '/holdings',
    fundamentals: '/fundamentals',
    market: '/market',
    analysis: '/analysis',
    settings: '/settings',
} as const;

/**
 * Valuation thresholds for scoring
 */
export const VALUATION_THRESHOLDS = {
    // P/E Ratio (lower is better)
    pe: {
        excellent: 10,
        good: 15,
        fair: 25,
        poor: 35,
    },
    // P/B Ratio (lower is better)
    pb: {
        excellent: 1.0,
        good: 1.5,
        fair: 2.5,
        poor: 4.0,
    },
    // Dividend Yield (higher is better)
    dividend: {
        excellent: 6,
        good: 4,
        fair: 2,
        poor: 1,
    },
    // EPS (higher is better)
    eps: {
        excellent: 50,
        good: 30,
        fair: 15,
        poor: 5,
    },
} as const;

/**
 * Health score grade thresholds
 */
export const GRADE_THRESHOLDS = {
    'A+': 85,
    'A': 75,
    'B+': 65,
    'B': 55,
    'C': 45,
    'D': 35,
    'F': 0,
} as const;

/**
 * Market Data configuration
 * Note: External APIs are currently unavailable, using mock data
 */
export const MARKET_DATA_CONFIG = {
    cacheDuration: 5 * 60 * 1000, // 5 minutes
    requestTimeout: 10000, // 10 seconds
    useMockData: true, // Set to false when live API becomes available
} as const;

/**
 * External Links Configuration
 * Centralized configuration for stock research websites
 * Change the baseUrl here to easily switch to a different provider
 */
export const EXTERNAL_LINKS = {
    // Primary stock research provider - change this to switch sites
    stockResearch: {
        name: 'NepseAlpha',
        baseUrl: 'https://nepsealpha.com/search',
        queryParam: 'q',
        // Alternative URLs for easy switching:
        // baseUrl: 'https://merolagani.com/CompanyDetail.aspx',
        // queryParam: 'symbol',
    },
} as const;

/**
 * Generate external link URL for a stock symbol
 * @param symbol - Stock symbol (e.g., 'NABIL', 'HDL')
 * @returns Full URL to the stock research page
 */
export const getStockResearchUrl = (symbol: string): string => {
    const { baseUrl, queryParam } = EXTERNAL_LINKS.stockResearch;
    return `${baseUrl}?${queryParam}=${encodeURIComponent(symbol)}`;
};
