/**
 * Type definitions - Single source of truth
 * Types defined once compound their value across the entire codebase
 * by providing type safety and IntelliSense everywhere.
 */

// Re-export from data for backward compatibility
export type { StockHolding, PortfolioSummary } from '@/data/portfolioData';

import type { StockHolding, PortfolioSummary } from '@/data/portfolioData';

/** Holding as built by useLivePortfolio: adds the previous close when the live feed supplied it. */
export type LiveStockHolding = StockHolding & {
    /** Previous session close (NPR), only set when it came from the same live feed as currentPrice. */
    previousClose?: number;
};

/** Summary as built by useLivePortfolio: adds the day's change when previous closes are available. */
export type LivePortfolioSummary = PortfolioSummary & {
    /** Sum of quantity * (currentPrice - previousClose) over holdings with both prices. Absent when none. */
    todayChange?: number;
    /** todayChange as a percent of the previous-close value of those same holdings. */
    todayChangePercent?: number;
};

/**
 * Sector allocation for charts
 */
export interface SectorAllocation {
    name: string;
    value: number;
    percentage?: number;
    color?: string;
}

/**
 * Performance metrics over time
 */
export interface PerformanceMetric {
    date: string;
    value: number;
    percentChange?: number;
}

/**
 * Growth projection data point
 */
export interface GrowthProjection {
    year: number;
    value: number;
    label?: string;
}

/**
 * Portfolio health indicators
 */
export interface PortfolioHealth {
    diversificationScore: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
}

/**
 * Valuation status based on fundamentals
 */
export type ValuationStatus = 'undervalued' | 'fair' | 'overvalued' | 'unknown';

/**
 * Stock analysis result
 */
export interface StockAnalysis {
    scrip: string;
    valuation: ValuationStatus;
    score: number; // 0-100 investment score
    signals: {
        type: 'bullish' | 'bearish' | 'neutral';
        indicator: string;
        description: string;
    }[];
}

/**
 * Time range options for charts
 */
export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';

/**
 * Chart theme configuration
 */
export interface ChartTheme {
    colors: {
        positive: string;
        negative: string;
        neutral: string;
        primary: string;
        secondary: string;
    };
    gradients?: {
        positive: [string, string];
        negative: [string, string];
    };
}

/**
 * API response wrapper for consistent error handling
 */
export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
}
