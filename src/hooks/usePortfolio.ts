/**
 * Custom hooks for portfolio data - Encapsulating logic that compounds across components
 * These hooks follow the single-responsibility principle and can be composed together.
 */

import { useMemo } from 'react';
import {
    StockHolding,
    PortfolioSummary,
} from '@/data/portfolioData';
import {
    calculateCAGR,
    calculateDiversificationScore,
    projectPortfolioGrowth,
    yearsToDouble,
} from '@/lib/finance';
import { useLivePortfolio } from './useLivePortfolio';

/**
 * Hook for complete portfolio analytics with live data from ShareBazaar API
 * Fetches real-time stock prices and correct company names from NEPSE
 */
export const usePortfolioAnalytics = () => {
    const { holdings, summary, isLoading, error, lastUpdated, refetch, isDbConnected, isEmpty } = useLivePortfolio();

    const sectorData = useMemo(() => {
        const sectorMap: Record<string, number> = {};
        holdings.forEach((h) => {
            sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue;
        });
        return Object.entries(sectorMap).map(([name, value]) => ({ name, value }));
    }, [holdings]);

    const topPerformers = useMemo(() => {
        return [...holdings].sort((a, b) => b.gainLossPercent - a.gainLossPercent).slice(0, 5);
    }, [holdings]);

    const worstPerformers = useMemo(() => {
        return [...holdings].sort((a, b) => a.gainLossPercent - b.gainLossPercent).slice(0, 5);
    }, [holdings]);

    const diversificationScore = useMemo(
        () => calculateDiversificationScore(holdings),
        [holdings]
    );

    // Assuming ~1 year holding period for CAGR estimation
    const estimatedCAGR = useMemo(
        () => calculateCAGR(summary.totalInvested, summary.currentValue, 1),
        [summary]
    );

    const projectedGrowth = useMemo(
        () => projectPortfolioGrowth(summary.currentValue, estimatedCAGR, 10),
        [summary.currentValue, estimatedCAGR]
    );

    const doublingYears = useMemo(
        () => yearsToDouble(estimatedCAGR),
        [estimatedCAGR]
    );

    return {
        holdings,
        summary,
        sectorData,
        topPerformers,
        worstPerformers,
        diversificationScore,
        estimatedCAGR,
        projectedGrowth,
        doublingYears,
        // Live data status
        isLoading,
        error,
        lastUpdated,
        refetch,
        isDbConnected,
        isEmpty,
    };
};

/**
 * Hook for filtering and sorting holdings
 */
export const useFilteredHoldings = (
    holdings: StockHolding[],
    options: {
        sector?: string;
        sortBy?: keyof StockHolding;
        sortOrder?: 'asc' | 'desc';
        minGainPercent?: number;
        maxGainPercent?: number;
    } = {}
) => {
    return useMemo(() => {
        let filtered = [...holdings];

        // Filter by sector
        if (options.sector) {
            filtered = filtered.filter((h) => h.sector === options.sector);
        }

        // Filter by gain percentage range
        if (options.minGainPercent !== undefined) {
            filtered = filtered.filter((h) => h.gainLossPercent >= options.minGainPercent!);
        }
        if (options.maxGainPercent !== undefined) {
            filtered = filtered.filter((h) => h.gainLossPercent <= options.maxGainPercent!);
        }

        // Sort
        if (options.sortBy) {
            filtered.sort((a, b) => {
                const aVal = a[options.sortBy!];
                const bVal = b[options.sortBy!];

                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;

                const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return options.sortOrder === 'desc' ? -comparison : comparison;
            });
        }

        return filtered;
    }, [holdings, options.sector, options.sortBy, options.sortOrder, options.minGainPercent, options.maxGainPercent]);
};

/**
 * Hook for sector-based analytics
 */
export const useSectorAnalytics = (holdings: StockHolding[]) => {
    return useMemo(() => {
        const sectorMap: Record<string, {
            holdings: StockHolding[];
            totalValue: number;
            totalCost: number;
            gainLoss: number;
            gainLossPercent: number;
        }> = {};

        holdings.forEach((h) => {
            if (!sectorMap[h.sector]) {
                sectorMap[h.sector] = {
                    holdings: [],
                    totalValue: 0,
                    totalCost: 0,
                    gainLoss: 0,
                    gainLossPercent: 0,
                };
            }
            sectorMap[h.sector].holdings.push(h);
            sectorMap[h.sector].totalValue += h.currentValue;
            sectorMap[h.sector].totalCost += h.totalCost;
        });

        // Calculate gains for each sector
        Object.values(sectorMap).forEach((sector) => {
            sector.gainLoss = sector.totalValue - sector.totalCost;
            sector.gainLossPercent = (sector.gainLoss / sector.totalCost) * 100;
        });

        return sectorMap;
    }, [holdings]);
};
