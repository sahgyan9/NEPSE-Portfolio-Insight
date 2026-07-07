/**
 * Extended Type Definitions for Portfolio Analysis
 * =================================================
 * 
 * Enhanced types for fundamental analysis, valuation scoring,
 * dividend tracking, and portfolio health metrics.
 */

// Re-export existing types
export * from '@/data/portfolioData';

// ============================================================
// VALUATION & SCORING TYPES
// ============================================================

/**
 * Valuation status based on fundamentals
 */
export type ValuationStatus = 'excellent' | 'good' | 'fair' | 'overvalued' | 'highly-overvalued' | 'unknown';

/**
 * Risk level classification
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'very-high';

/**
 * Metric health status
 */
export type MetricHealth = 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown';

/**
 * Threshold configuration for a metric
 */
export interface MetricThreshold {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    // Whether lower is better (like P/E) or higher is better (like dividend yield)
    lowerIsBetter: boolean;
}

/**
 * Financial metric with educational context
 */
export interface FinancialMetric {
    value: number | null;
    label: string;
    shortLabel: string;
    description: string;
    educationalNote: string;
    health: MetricHealth;
    thresholds: MetricThreshold;
    unit?: string;
    format?: 'number' | 'percent' | 'currency' | 'ratio';
}

/**
 * Complete valuation score breakdown
 */
export interface ValuationScore {
    overallScore: number; // 0-100
    status: ValuationStatus;
    label: string;
    color: string;
    icon: string;
    breakdown: {
        peScore: number;
        pbScore: number;
        dividendScore: number;
        epsScore: number;
    };
    recommendations: string[];
}

/**
 * Stock fundamental data with analysis
 */
export interface StockFundamentals {
    symbol: string;
    name: string;
    sector: string;

    // Price metrics
    currentPrice: number;
    previousClose?: number;
    change?: number;
    changePercent?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;

    // Valuation metrics
    peRatio: FinancialMetric;
    pbRatio: FinancialMetric;
    eps: FinancialMetric;
    bookValue: FinancialMetric;

    // Dividend metrics
    dividendYield: FinancialMetric;
    dividendHistory?: DividendRecord[];
    expectedAnnualDividend?: number;

    // Overall valuation
    valuationScore: ValuationScore;

    // Market data
    marketCap?: number;
    volume?: number;
    turnover?: number;
}

// ============================================================
// DIVIDEND TRACKING TYPES
// ============================================================

/**
 * Single dividend record
 */
export interface DividendRecord {
    fiscalYear: string;
    cashDividendPercent: number;
    bonusSharePercent: number;
    totalDividendPercent: number;
    announcementDate?: string;
    bookCloseDate?: string;
    status: 'announced' | 'paid' | 'expected';
}

/**
 * Dividend projection for a holding
 */
export interface DividendProjection {
    symbol: string;
    name: string;
    quantity: number;
    currentPrice: number;
    expectedDividendPercent: number;
    expectedCashAmount: number;
    expectedBonusShares: number;
    expectedMonth?: string;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Portfolio dividend summary
 */
export interface PortfolioDividendSummary {
    totalExpectedCashDividend: number;
    totalExpectedBonusValue: number;
    portfolioDividendYield: number;
    yieldOnCost: number;
    upcomingDividends: DividendProjection[];
    dividendHistory: {
        year: string;
        totalReceived: number;
        breakdown: { symbol: string; amount: number }[];
    }[];
}

// ============================================================
// PORTFOLIO HEALTH TYPES
// ============================================================

/**
 * Health indicator with visual styling
 */
export interface HealthIndicator {
    name: string;
    value: number;
    maxValue: number;
    status: MetricHealth;
    label: string;
    description: string;
    icon: string;
    color: string;
    bgColor: string;
}

/**
 * Complete portfolio health assessment
 */
export interface PortfolioHealth {
    overallScore: number; // 0-100
    status: MetricHealth;
    grade: string; // A+, A, B+, B, C, D, F

    indicators: {
        diversification: HealthIndicator;
        valuation: HealthIndicator;
        dividendQuality: HealthIndicator;
        concentration: HealthIndicator;
        sectorBalance: HealthIndicator;
    };

    strengths: string[];
    warnings: string[];
    recommendations: string[];
}

// ============================================================
// SECTOR ANALYSIS TYPES
// ============================================================

/**
 * Sector allocation data for charts
 */
export interface SectorAllocation {
    name: string;
    value: number;
    percentage: number;
    color: string;
    holdings: number;
    gainLoss: number;
    gainLossPercent: number;
}

/**
 * Sector comparison with benchmark
 */
export interface SectorBenchmark {
    sector: string;
    portfolioWeight: number;
    marketWeight?: number;
    deviation?: number;
    status: 'overweight' | 'underweight' | 'neutral';
}

// ============================================================
// MARKET CONTEXT TYPES
// ============================================================

/**
 * NEPSE market overview
 */
export interface MarketOverview {
    nepseIndex: {
        value: number;
        change: number;
        changePercent: number;
        trend: 'up' | 'down' | 'neutral';
    };

    marketSummary: {
        totalTurnover: number;
        totalVolume: number;
        totalTransactions: number;
        advancingStocks: number;
        decliningStocks: number;
        unchangedStocks: number;
    };

    marketSentiment: 'bullish' | 'bearish' | 'neutral';
    lastUpdated: Date;
}

// ============================================================
// EDUCATIONAL CONTENT TYPES
// ============================================================

/**
 * Educational tooltip content
 */
export interface EducationalTooltip {
    term: string;
    definition: string;
    example?: string;
    goodRange?: string;
    warningThreshold?: string;
    source?: string;
}

/**
 * Metric benchmark reference
 */
export interface MetricBenchmark {
    metric: string;
    nepseAverage?: number;
    sectorAverage?: number;
    globalAverage?: number;
    idealRange: { min: number; max: number };
    interpretation: string;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
    lastUpdated?: Date;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// ============================================================
// CHART DATA TYPES
// ============================================================

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
    date: string;
    value: number;
    label?: string;
}

/**
 * Chart configuration
 */
export interface ChartConfig {
    type: 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'gauge';
    colors?: string[];
    showLegend?: boolean;
    showTooltip?: boolean;
    animate?: boolean;
}

// ============================================================
// FILTER & SORT TYPES
// ============================================================

/**
 * Filter options for holdings
 */
export interface HoldingsFilter {
    sector?: string;
    minValue?: number;
    maxValue?: number;
    gainersOnly?: boolean;
    losersOnly?: boolean;
    undervaluedOnly?: boolean;
}

/**
 * Sort options
 */
export interface SortOption {
    field: string;
    direction: 'asc' | 'desc';
    label: string;
}
