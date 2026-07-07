/**
 * Financial calculation utilities - These compound in value as they're reused
 * across components, reducing bugs and ensuring consistency.
 */

/**
 * Calculate compound annual growth rate (CAGR)
 * @param beginningValue - Initial investment value
 * @param endingValue - Final investment value
 * @param years - Number of years
 * @returns CAGR as a percentage
 */
export const calculateCAGR = (
    beginningValue: number,
    endingValue: number,
    years: number
): number => {
    if (beginningValue <= 0 || years <= 0) return 0;
    return (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
};

/**
 * Calculate future value with compound interest
 * @param principal - Initial investment
 * @param rate - Annual interest rate (as decimal, e.g., 0.10 for 10%)
 * @param years - Number of years
 * @param compoundingFrequency - Times per year interest compounds (default: 1 for annual)
 * @returns Future value
 */
export const calculateFutureValue = (
    principal: number,
    rate: number,
    years: number,
    compoundingFrequency: number = 1
): number => {
    return principal * Math.pow(1 + rate / compoundingFrequency, compoundingFrequency * years);
};

/**
 * Calculate gain/loss amount and percentage
 * @param currentValue - Current market value
 * @param costBasis - Original purchase cost
 * @returns Object with absolute and percentage gains
 */
export const calculateGainLoss = (
    currentValue: number,
    costBasis: number
): { amount: number; percent: number } => {
    const amount = currentValue - costBasis;
    const percent = costBasis > 0 ? (amount / costBasis) * 100 : 0;
    return { amount, percent };
};

/**
 * Format currency for display (NPR - Nepalese Rupees)
 * @param value - Numeric value to format
 * @param showSign - Whether to show +/- sign
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number, showSign: boolean = false): string => {
    const formatted = new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));

    if (showSign && value !== 0) {
        return value > 0 ? `+${formatted}` : `-${formatted.replace('NPR', 'NPR ')}`;
    }
    return formatted;
};

/**
 * Format percentage for display
 * @param value - Numeric percentage value
 * @param showSign - Whether to show +/- sign
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercent = (
    value: number,
    showSign: boolean = true,
    decimals: number = 2
): string => {
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
};

/**
 * Calculate portfolio diversification score (0-100)
 * Higher score = better diversification
 * Uses Herfindahl-Hirschman Index (HHI) concept
 */
export const calculateDiversificationScore = (
    holdings: { currentValue: number }[]
): number => {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    if (totalValue === 0) return 0;

    // Calculate HHI (sum of squared market shares)
    const hhi = holdings.reduce((sum, h) => {
        const share = h.currentValue / totalValue;
        return sum + share * share;
    }, 0);

    // Convert HHI to 0-100 score (lower HHI = better diversification)
    // Perfect diversification (equal weights) would have HHI = 1/n
    // Single stock would have HHI = 1
    const minHHI = 1 / holdings.length;
    const score = ((1 - hhi) / (1 - minHHI)) * 100;

    return Math.max(0, Math.min(100, score));
};

/**
 * Project portfolio value using historical CAGR
 * @param currentValue - Current portfolio value
 * @param cagr - Historical CAGR as percentage
 * @param years - Years to project
 * @returns Array of projected values by year
 */
export const projectPortfolioGrowth = (
    currentValue: number,
    cagr: number,
    years: number
): { year: number; value: number }[] => {
    const projections: { year: number; value: number }[] = [];
    const rate = cagr / 100;

    for (let i = 0; i <= years; i++) {
        projections.push({
            year: i,
            value: currentValue * Math.pow(1 + rate, i),
        });
    }

    return projections;
};

/**
 * Calculate time to double investment (Rule of 72)
 * @param annualReturn - Expected annual return as percentage
 * @returns Years to double
 */
export const yearsToDouble = (annualReturn: number): number => {
    if (annualReturn <= 0) return Infinity;
    return 72 / annualReturn;
};
