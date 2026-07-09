/**
 * Valuation Scoring System
 * ========================
 * 
 * Calculates health scores for stocks based on fundamental metrics
 * with educational thresholds and visual indicators.
 * 
 * Based on value investing principles from:
 * - "The Intelligent Investor" by Benjamin Graham
 * - NEPSE market averages
 */

import {
    ValuationScore,
    ValuationStatus,
    MetricHealth,
    FinancialMetric,
    MetricThreshold,
    HealthIndicator,
    PortfolioHealth,
    StockFundamentals,
    DividendProjection,
    PortfolioDividendSummary,
} from '@/types/fundamentals';
import { StockHolding } from '@/data/portfolioData';

// ============================================================
// THRESHOLD DEFINITIONS
// ============================================================

/**
 * P/E Ratio thresholds (lower is generally better)
 * - < 10: Excellent (possibly undervalued)
 * - 10-15: Good
 * - 15-25: Fair
 * - 25-35: Poor (expensive)
 * - > 35: Critical (overvalued)
 */
export const PE_THRESHOLDS: MetricThreshold = {
    excellent: 10,
    good: 15,
    fair: 25,
    poor: 35,
    lowerIsBetter: true,
};

/**
 * P/B Ratio thresholds (lower is generally better)
 * - < 1.0: Excellent (trading below book value)
 * - 1.0-1.5: Good
 * - 1.5-2.5: Fair
 * - 2.5-4.0: Poor
 * - > 4.0: Critical
 */
export const PB_THRESHOLDS: MetricThreshold = {
    excellent: 1.0,
    good: 1.5,
    fair: 2.5,
    poor: 4.0,
    lowerIsBetter: true,
};

/**
 * Dividend Yield thresholds (higher is generally better)
 * - > 6%: Excellent
 * - 4-6%: Good
 * - 2-4%: Fair
 * - 1-2%: Poor
 * - < 1%: Critical
 */
export const DIVIDEND_THRESHOLDS: MetricThreshold = {
    excellent: 6,
    good: 4,
    fair: 2,
    poor: 1,
    lowerIsBetter: false,
};

/**
 * EPS thresholds (higher is better, context-dependent)
 * These are relative to stock price
 */
export const EPS_THRESHOLDS: MetricThreshold = {
    excellent: 50,
    good: 30,
    fair: 15,
    poor: 5,
    lowerIsBetter: false,
};

// ============================================================
// EDUCATIONAL CONTENT
// ============================================================

export const METRIC_EDUCATION = {
    peRatio: {
        term: 'P/E Ratio (Price-to-Earnings)',
        definition: 'Shows how much investors pay for each rupee of earnings. A P/E of 15 means investors pay Rs. 15 for every Rs. 1 of earnings.',
        example: 'If a stock trades at Rs. 100 with EPS of Rs. 10, P/E = 100/10 = 10',
        goodRange: '10-20 for most sectors',
        warningThreshold: 'Above 25 may indicate overvaluation',
        interpretation: {
            low: 'May be undervalued or facing challenges',
            average: 'Fairly valued relative to earnings',
            high: 'Investors expect high growth or stock is overpriced',
        },
    },
    pbRatio: {
        term: 'P/B Ratio (Price-to-Book)',
        definition: 'Compares stock price to book value (assets minus liabilities). Shows if you\'re paying more or less than the company\'s net asset value.',
        example: 'P/B of 0.8 means stock trades at 20% discount to book value',
        goodRange: '0.5-1.5 for banks, 1.0-3.0 for others',
        warningThreshold: 'Above 3.0 for non-growth stocks',
        interpretation: {
            low: 'Potentially undervalued, check for hidden problems',
            average: 'Trading near fair value',
            high: 'Premium valuation, justify with growth prospects',
        },
    },
    eps: {
        term: 'EPS (Earnings Per Share)',
        definition: 'Company\'s profit divided by shares outstanding. Shows how much profit each share generates.',
        example: 'Net Profit Rs. 10 Cr with 1 Cr shares = EPS of Rs. 10',
        goodRange: 'Positive and growing YoY',
        warningThreshold: 'Negative or declining EPS is concerning',
        interpretation: {
            low: 'Low profitability or many shares outstanding',
            average: 'Moderate earnings generation',
            high: 'Strong profit generation per share',
        },
    },
    dividendYield: {
        term: 'Dividend Yield',
        definition: 'Annual dividend as percentage of stock price. Shows return from dividends alone.',
        example: 'Rs. 10 dividend on Rs. 200 stock = 5% yield',
        goodRange: '3-8% for income stocks',
        warningThreshold: 'Very high yield (>10%) may be unsustainable',
        interpretation: {
            low: 'Growth-focused or conserving cash',
            average: 'Balanced dividend policy',
            high: 'Income-friendly but verify sustainability',
        },
    },
    bookValue: {
        term: 'Book Value Per Share',
        definition: 'Net asset value per share. What shareholders would receive if company liquidated at book value.',
        example: 'Total equity Rs. 100 Cr with 10 Cr shares = BV of Rs. 100',
        goodRange: 'Should be positive and growing',
        warningThreshold: 'Declining book value is a red flag',
        interpretation: {
            low: 'Low asset base relative to shares',
            average: 'Moderate asset backing',
            high: 'Strong asset base, good for stability',
        },
    },
    grahamNumber: {
        term: 'Graham Number',
        definition: 'The maximum fair value price based on Benjamin Graham\'s classic formula (square root of 22.5 * EPS * Book Value).',
        example: '√(22.5 * EPS * Book Value)',
        goodRange: 'Current price < Graham Number (Margin of Safety)',
        warningThreshold: 'Current price > Graham Number',
    },
    pegRatio: {
        term: 'PEG Ratio (P/E to Growth)',
        definition: 'Compares the P/E ratio to the company\'s YoY earnings growth rate to find value in growth.',
        example: 'P/E Ratio / YoY TTM Net Profit Growth %',
        goodRange: 'Below 1.0 (undervalued relative to growth)',
        warningThreshold: 'Above 1.5 (expensive relative to growth)',
    },
    earningsYield: {
        term: 'Earnings Yield',
        definition: 'Shows earnings generated per rupee of stock price. The direct inverse of P/E, comparable to interest rates.',
        example: '(EPS / Price) * 100',
        goodRange: 'Above 8% (highly competitive with Fixed Deposits)',
        warningThreshold: 'Below 4% (low yield compared to risk-free rate)',
    },
};

// ============================================================
// SCORING FUNCTIONS
// ============================================================

/**
 * Get health status for a metric value
 */
export const getMetricHealth = (
    value: number | null | undefined,
    thresholds: MetricThreshold
): MetricHealth => {
    if (value === null || value === undefined || isNaN(value)) {
        return 'unknown';
    }

    if (thresholds.lowerIsBetter) {
        if (value < 0) return 'critical'; // Negative PE/PB signifies losses/insolvency
        if (value <= thresholds.excellent) return 'excellent';
        if (value <= thresholds.good) return 'good';
        if (value <= thresholds.fair) return 'fair';
        if (value <= thresholds.poor) return 'poor';
        return 'critical';
    } else {
        if (value >= thresholds.excellent) return 'excellent';
        if (value >= thresholds.good) return 'good';
        if (value >= thresholds.fair) return 'fair';
        if (value >= thresholds.poor) return 'poor';
        return 'critical';
    }
};

/**
 * Convert metric health to score (0-100)
 */
export const healthToScore = (health: MetricHealth): number => {
    const scores: Record<MetricHealth, number> = {
        excellent: 100,
        good: 80,
        fair: 60,
        poor: 40,
        critical: 20,
        unknown: 0,
    };
    return scores[health];
};

/**
 * Get color for health status
 */
export const getHealthColor = (health: MetricHealth): string => {
    const colors: Record<MetricHealth, string> = {
        excellent: '#22c55e', // green-500
        good: '#84cc16',      // lime-500
        fair: '#eab308',      // yellow-500
        poor: '#f97316',      // orange-500
        critical: '#ef4444',  // red-500
        unknown: '#6b7280',   // gray-500
    };
    return colors[health];
};

/**
 * Get background color for health status
 */
export const getHealthBgColor = (health: MetricHealth): string => {
    const colors: Record<MetricHealth, string> = {
        excellent: 'bg-green-500/10',
        good: 'bg-lime-500/10',
        fair: 'bg-yellow-500/10',
        poor: 'bg-orange-500/10',
        critical: 'bg-red-500/10',
        unknown: 'bg-gray-500/10',
    };
    return colors[health];
};

/**
 * Get icon for health status
 */
export const getHealthIcon = (health: MetricHealth): string => {
    const icons: Record<MetricHealth, string> = {
        excellent: '🟢',
        good: '🟡',
        fair: '🟠',
        poor: '🔴',
        critical: '⛔',
        unknown: '⚪',
    };
    return icons[health];
};

export const calculateValuationScore = (holding: StockHolding): ValuationScore => {
    if (holding.sector === 'Mutual Fund') {
        return {
            overallScore: 0,
            status: 'unknown',
            label: 'Mutual Fund (Not Rated)',
            color: '#6b7280', // gray-500
            icon: '⚪',
            breakdown: {
                peScore: 0,
                pbScore: 0,
                dividendScore: 0,
                epsScore: 0,
            },
            recommendations: ['Valuation metrics are not applicable to Mutual Funds. Analyze fund Net Asset Value (NAV) instead.'],
        };
    }

    const peHealth = getMetricHealth(holding.peRatio, PE_THRESHOLDS);
    const pbHealth = getMetricHealth(holding.pbRatio, PB_THRESHOLDS);
    const dividendHealth = getMetricHealth(holding.dividendYield, DIVIDEND_THRESHOLDS);
    const epsHealth = holding.eps !== null && holding.eps > 0 ? 'good' : 'poor';

    const peScore = healthToScore(peHealth);
    const pbScore = healthToScore(pbHealth);
    const dividendScore = healthToScore(dividendHealth);
    const epsScore = healthToScore(epsHealth as MetricHealth);

    // Weighted average (P/E and P/B are more important for value investing)
    const weights = { pe: 0.35, pb: 0.30, dividend: 0.20, eps: 0.15 };
    const overallScore = Math.round(
        peScore * weights.pe +
        pbScore * weights.pb +
        dividendScore * weights.dividend +
        epsScore * weights.eps
    );

    // Determine status
    let status: ValuationStatus;
    let label: string;
    let color: string;
    let icon: string;

    if (overallScore >= 80) {
        status = 'excellent';
        label = 'Excellent Value';
        color = '#22c55e';
        icon = '🌟';
    } else if (overallScore >= 65) {
        status = 'good';
        label = 'Good Value';
        color = '#84cc16';
        icon = '✅';
    } else if (overallScore >= 50) {
        status = 'fair';
        label = 'Fair Value';
        color = '#eab308';
        icon = '⚖️';
    } else if (overallScore >= 35) {
        status = 'overvalued';
        label = 'Overvalued';
        color = '#f97316';
        icon = '⚠️';
    } else {
        status = 'highly-overvalued';
        label = 'Highly Overvalued';
        color = '#ef4444';
        icon = '🚫';
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (peHealth === 'poor' || peHealth === 'critical') {
        recommendations.push('High P/E ratio suggests stock may be overpriced relative to earnings');
    }
    if (pbHealth === 'poor' || pbHealth === 'critical') {
        recommendations.push('High P/B ratio indicates premium valuation - verify growth justifies price');
    }
    if (dividendHealth === 'poor' || dividendHealth === 'critical') {
        recommendations.push('Low dividend yield - consider if growth potential compensates');
    }
    if (pbHealth === 'excellent') {
        recommendations.push('Trading below book value - potential value opportunity');
    }
    if (dividendHealth === 'excellent') {
        recommendations.push('Strong dividend yield provides good income potential');
    }

    return {
        overallScore,
        status,
        label,
        color,
        icon,
        breakdown: {
            peScore,
            pbScore,
            dividendScore,
            epsScore,
        },
        recommendations,
    };
};

/**
 * Create financial metric object with educational content
 */
export const createFinancialMetric = (
    value: number | null,
    key: keyof typeof METRIC_EDUCATION,
    thresholds: MetricThreshold
): FinancialMetric => {
    const education = METRIC_EDUCATION[key];
    const health = getMetricHealth(value, thresholds);

    return {
        value,
        label: education.term,
        shortLabel: key.toUpperCase(),
        description: education.definition,
        educationalNote: education.goodRange,
        health,
        thresholds,
    };
};

/**
 * Calculate portfolio health score
 */
export const calculatePortfolioHealth = (holdings: StockHolding[]): PortfolioHealth => {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

    // 1. Diversification Score
    const sectorMap: Record<string, number> = {};
    holdings.forEach(h => {
        sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue;
    });
    const sectorWeights = Object.values(sectorMap).map(v => v / totalValue);
    const hhi = sectorWeights.reduce((sum, w) => sum + w * w, 0);
    const diversificationScore = Math.round((1 - hhi) * 100);

    // 2. Valuation Score (average of all holdings)
    const valuationScores = holdings.map(h => calculateValuationScore(h).overallScore);
    const avgValuationScore = Math.round(
        valuationScores.reduce((a, b) => a + b, 0) / valuationScores.length
    );

    // 3. Dividend Quality Score
    const dividendYields = holdings
        .filter(h => h.dividendYield !== null && h.dividendYield > 0)
        .map(h => h.dividendYield!);
    const avgDividendYield = dividendYields.length > 0
        ? dividendYields.reduce((a, b) => a + b, 0) / dividendYields.length
        : 0;
    const dividendScore = Math.min(100, Math.round(avgDividendYield * 15));

    // 4. Concentration Risk Score
    const maxWeight = Math.max(...holdings.map(h => h.currentValue / totalValue));
    const concentrationScore = Math.round((1 - maxWeight) * 100);

    // 5. Sector Balance Score
    const uniqueSectors = Object.keys(sectorMap).length;
    const sectorBalanceScore = Math.min(100, uniqueSectors * 12);

    // Overall score
    const overallScore = Math.round(
        diversificationScore * 0.25 +
        avgValuationScore * 0.30 +
        dividendScore * 0.15 +
        concentrationScore * 0.15 +
        sectorBalanceScore * 0.15
    );

    // Determine grade
    let grade: string;
    let status: MetricHealth;
    if (overallScore >= 85) { grade = 'A+'; status = 'excellent'; }
    else if (overallScore >= 75) { grade = 'A'; status = 'good'; }
    else if (overallScore >= 65) { grade = 'B+'; status = 'good'; }
    else if (overallScore >= 55) { grade = 'B'; status = 'fair'; }
    else if (overallScore >= 45) { grade = 'C'; status = 'fair'; }
    else if (overallScore >= 35) { grade = 'D'; status = 'poor'; }
    else { grade = 'F'; status = 'critical'; }

    // Build indicators
    const createIndicator = (
        name: string,
        value: number,
        description: string,
        icon: string
    ): HealthIndicator => {
        const health =
            value >= 80 ? 'excellent' :
                value >= 65 ? 'good' :
                    value >= 50 ? 'fair' :
                        value >= 35 ? 'poor' : 'critical';

        return {
            name,
            value,
            maxValue: 100,
            status: health,
            label: `${value}%`,
            description,
            icon,
            color: getHealthColor(health),
            bgColor: getHealthBgColor(health),
        };
    };

    const indicators = {
        diversification: createIndicator(
            'Diversification',
            diversificationScore,
            'How well-spread your investments are across different stocks',
            '📊'
        ),
        valuation: createIndicator(
            'Valuation Quality',
            avgValuationScore,
            'Average fundamental value score of your holdings',
            '💎'
        ),
        dividendQuality: createIndicator(
            'Dividend Quality',
            dividendScore,
            'Income generation potential from dividends',
            '💰'
        ),
        concentration: createIndicator(
            'Low Concentration',
            concentrationScore,
            'Risk from having too much in single stocks',
            '⚖️'
        ),
        sectorBalance: createIndicator(
            'Sector Balance',
            sectorBalanceScore,
            'Distribution across different market sectors',
            '🏢'
        ),
    };

    // Generate insights
    const strengths: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (diversificationScore >= 70) {
        strengths.push('Well-diversified portfolio reduces risk');
    } else if (diversificationScore < 50) {
        warnings.push('Portfolio concentration is high');
        recommendations.push('Consider adding more stocks to improve diversification');
    }

    if (avgValuationScore >= 65) {
        strengths.push('Holdings are generally well-valued');
    } else if (avgValuationScore < 50) {
        warnings.push('Several holdings appear overvalued');
        recommendations.push('Review high P/E and P/B ratio stocks for potential rebalancing');
    }

    if (avgDividendYield >= 4) {
        strengths.push('Strong dividend income potential');
    }

    if (maxWeight > 0.25) {
        warnings.push(`Single stock makes up ${(maxWeight * 100).toFixed(1)}% of portfolio`);
        recommendations.push('Consider reducing position in largest holding');
    }

    if (uniqueSectors >= 6) {
        strengths.push('Good sector diversification');
    } else if (uniqueSectors < 4) {
        warnings.push('Limited sector exposure');
        recommendations.push('Consider adding stocks from different sectors');
    }

    return {
        overallScore,
        status,
        grade,
        indicators,
        strengths,
        warnings,
        recommendations,
    };
};

/**
 * Calculate dividend projections for portfolio
 * Uses live dividend data from Merolagani when available, falls back to dividendYield
 */
export const calculateDividendProjections = (holdings: StockHolding[]): PortfolioDividendSummary => {
    const upcomingDividends: DividendProjection[] = [];
    let totalExpectedCash = 0;
    let totalExpectedBonusValue = 0;
    let totalInvested = 0;
    let totalCost = 0;

    holdings.forEach(holding => {
        // Prefer live dividend data from Merolagani, fall back to static dividendYield
        const liveDividendPercent = holding.latestDividendPercent || 0;
        const liveDividendIncome = holding.dividendIncome || 0;
        const staticDividendYield = holding.dividendYield || 0;

        // Use live data if available, otherwise use static yield
        const hasLiveData = liveDividendPercent > 0;
        const dividendYield = hasLiveData ? liveDividendPercent : staticDividendYield;

        if (dividendYield > 0) {
            // For live data, use the calculated income; for static, estimate
            let expectedCash: number;
            let expectedBonusShares: number;
            let expectedBonusValue: number;

            if (hasLiveData) {
                // Use the live calculated dividend income
                expectedCash = liveDividendIncome;
                // Assume no bonus for now (would need separate bonus data)
                expectedBonusShares = 0;
                expectedBonusValue = 0;
            } else {
                // Estimate based on historical dividend yield
                // Assuming 80% cash, 20% bonus typical for Nepal
                const expectedCashPercent = dividendYield * 0.8;
                const expectedBonusPercent = dividendYield * 0.2;

                const faceValue = 100; // Standard face value in Nepal
                expectedCash = (holding.quantity * faceValue * expectedCashPercent) / 100;
                expectedBonusShares = Math.floor(holding.quantity * (expectedBonusPercent / 100));
                expectedBonusValue = expectedBonusShares * holding.currentPrice;
            }

            totalExpectedCash += expectedCash;
            totalExpectedBonusValue += expectedBonusValue;

            // Determine expected month based on sector (approximate)
            let expectedMonth = 'July-Aug'; // Default for most companies
            if (holding.sector === 'Commercial Bank') {
                expectedMonth = 'July-Sept';
            } else if (holding.sector === 'Insurance' || holding.sector === 'Life Insurance' || holding.sector === 'Non-Life Insurance') {
                expectedMonth = 'Aug-Oct';
            }

            upcomingDividends.push({
                symbol: holding.scrip,
                name: holding.fullName,
                quantity: holding.quantity,
                currentPrice: holding.currentPrice,
                expectedDividendPercent: dividendYield,
                expectedCashAmount: expectedCash,
                expectedBonusShares,
                expectedMonth,
                confidence: hasLiveData ? 'high' : (dividendYield > 3 ? 'high' : dividendYield > 1 ? 'medium' : 'low'),
            });
        }

        totalInvested += holding.currentValue;
        totalCost += holding.totalCost;
    });

    // Sort by expected amount
    upcomingDividends.sort((a, b) => b.expectedCashAmount - a.expectedCashAmount);

    const portfolioDividendYield = totalInvested > 0
        ? (totalExpectedCash / totalInvested) * 100
        : 0;

    const yieldOnCost = totalCost > 0
        ? (totalExpectedCash / totalCost) * 100
        : 0;

    return {
        totalExpectedCashDividend: totalExpectedCash,
        totalExpectedBonusValue,
        portfolioDividendYield,
        yieldOnCost,
        upcomingDividends,
        dividendHistory: [], // Would need historical data
    };
};

/**
 * Get grade color
 */
export const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return '#22c55e';
    if (grade.startsWith('B')) return '#84cc16';
    if (grade === 'C') return '#eab308';
    if (grade === 'D') return '#f97316';
    return '#ef4444';
};

/**
 * Format score as percentage bar
 */
export const getScoreBarWidth = (score: number): string => {
    return `${Math.min(100, Math.max(0, score))}%`;
};
