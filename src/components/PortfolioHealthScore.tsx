/**
 * Portfolio Health Score Component
 * =================================
 * 
 * Visual representation of portfolio health with:
 * - Circular gauge for overall score
 * - Individual metric indicators
 * - Educational tooltips
 * - Grade badge
 */

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { StockHolding } from '@/data/portfolioData';
import {
    calculatePortfolioHealth,
    getGradeColor,
    getHealthColor,
    getHealthBgColor,
} from '@/lib/valuationScoring';
import { getPortfolioHealth, PortfolioHealthResponse } from '@/services/portfolioDb';
import { HealthIndicator, MetricHealth } from '@/types/fundamentals';
import { Info, TrendingUp, Shield, PieChart, Building2, Coins } from 'lucide-react';

interface PortfolioHealthScoreProps {
    holdings: StockHolding[];
}

export const PortfolioHealthScore = ({ holdings }: PortfolioHealthScoreProps) => {
    const [serverHealth, setServerHealth] = useState<PortfolioHealthResponse | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchServerHealth = async () => {
            try {
                setLoading(true);
                const data = await getPortfolioHealth();
                setServerHealth(data);
            } catch (err) {
                console.warn("Failed to fetch health score from server, falling back to client-side", err);
            } finally {
                setLoading(false);
            }
        };
        fetchServerHealth();
    }, [holdings]);

    const health = useMemo(() => {
        if (serverHealth && !('error' in serverHealth)) {
            const createIndicator = (
                name: string,
                value: number,
                description: string,
                icon: string,
                status: MetricHealth
            ): HealthIndicator => {
                return {
                    name,
                    value,
                    maxValue: 100,
                    status,
                    label: `${value}%`,
                    description,
                    icon,
                    color: getHealthColor(status),
                    bgColor: getHealthBgColor(status),
                };
            };
            
            const getStatusFromScore = (score: number): MetricHealth => {
                if (score >= 80) return 'excellent';
                if (score >= 65) return 'good';
                if (score >= 50) return 'fair';
                if (score >= 35) return 'poor';
                return 'critical';
            };

            const pillars = serverHealth.pillars;
            return {
                overallScore: serverHealth.overallScore,
                status: getStatusFromScore(serverHealth.overallScore),
                grade: serverHealth.grade,
                textSummary: serverHealth.textSummary,
                indicators: {
                    diversification: createIndicator(
                        pillars.structure.name,
                        pillars.structure.score,
                        pillars.structure.description,
                        '📊',
                        getStatusFromScore(pillars.structure.score)
                    ),
                    valuation: createIndicator(
                        pillars.valuation.name,
                        pillars.valuation.score,
                        pillars.valuation.description,
                        '💎',
                        getStatusFromScore(pillars.valuation.score)
                    ),
                    dividendQuality: createIndicator(
                        pillars.dividend.name,
                        pillars.dividend.score,
                        pillars.dividend.description,
                        '💰',
                        getStatusFromScore(pillars.dividend.score)
                    ),
                    concentration: createIndicator(
                        pillars.fundamentals.name,
                        pillars.fundamentals.score,
                        pillars.fundamentals.description,
                        '🏢',
                        getStatusFromScore(pillars.fundamentals.score)
                    ),
                    sectorBalance: createIndicator(
                        pillars.volatility.name,
                        pillars.volatility.score,
                        pillars.volatility.description,
                        '⚡',
                        getStatusFromScore(pillars.volatility.score)
                    ),
                },
                strengths: serverHealth.strengths,
                warnings: serverHealth.warnings,
                recommendations: serverHealth.recommendations
            };
        }
        return calculatePortfolioHealth(holdings);
    }, [holdings, serverHealth]);

    // Icon mapping for indicators
    const iconMap: Record<string, React.ReactNode> = {
        diversification: <PieChart className="w-4 h-4" />,
        valuation: <TrendingUp className="w-4 h-4" />,
        dividendQuality: <Coins className="w-4 h-4" />,
        concentration: <Building2 className="w-4 h-4" />,
        sectorBalance: <Shield className="w-4 h-4" />,
    };

    return (
        <Card className="w-full">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-bold">Portfolio Health Score</CardTitle>
                        <CardDescription>Comprehensive assessment of your portfolio</CardDescription>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-4 h-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>
                                    Health score is calculated based on diversification, valuation metrics,
                                    dividend quality, concentration risk, and sector balance.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Score Gauge */}
                    <div className="flex flex-col items-center justify-center">
                        <div className="relative w-40 h-40">
                            {/* Background circle */}
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    className="text-muted/20"
                                />
                                {/* Progress circle */}
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke={getGradeColor(health.grade)}
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${health.overallScore * 2.83} 283`}
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            {/* Center content */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span
                                    className="text-4xl font-bold"
                                    style={{ color: getGradeColor(health.grade) }}
                                >
                                    {health.grade}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    {health.overallScore}/100
                                </span>
                            </div>
                        </div>
                        <Badge
                            className="mt-4 text-sm"
                            style={{
                                backgroundColor: `${getGradeColor(health.grade)}20`,
                                color: getGradeColor(health.grade),
                            }}
                        >
                            {health.status === 'excellent' && '🌟 Excellent'}
                            {health.status === 'good' && '✅ Good'}
                            {health.status === 'fair' && '⚖️ Fair'}
                            {health.status === 'poor' && '⚠️ Needs Attention'}
                            {health.status === 'critical' && '🚨 Critical'}
                        </Badge>
                    </div>

                    {/* Individual Indicators & Summary */}
                    <div className="lg:col-span-2 space-y-4">
                        {health.textSummary && (
                            <div className="p-4 rounded-xl bg-card border border-border/50 text-sm text-foreground leading-relaxed shadow-inner">
                                <p className="font-semibold text-primary mb-1 flex items-center gap-1.5">
                                    <Shield className="w-4 h-4 text-primary" /> Health Assessment
                                </p>
                                <p className="text-muted-foreground">{health.textSummary}</p>
                            </div>
                        )}
                        
                        <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider">
                            Health Breakdown
                        </h4>
                        
                        {Object.entries(health.indicators).map(([key, indicator]) => (
                            <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={indicator.bgColor + ' p-1.5 rounded-md'}>
                                            {iconMap[key]}
                                        </span>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger className="flex items-center gap-1">
                                                    <span className="text-sm font-medium">{indicator.name}</span>
                                                    <Info className="w-3 h-3 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs">
                                                    <p className="text-sm">{indicator.description}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <span
                                        className="text-sm font-bold"
                                        style={{ color: indicator.color }}
                                    >
                                        {indicator.label}
                                    </span>
                                </div>
                                <Progress
                                    value={indicator.value}
                                    className="h-2"
                                    style={{
                                        ['--progress-color' as any]: indicator.color,
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Insights Section */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Strengths */}
                    {health.strengths.length > 0 && (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                            <h5 className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-2 mb-2">
                                <span>💪</span> Strengths
                            </h5>
                            <ul className="space-y-1.5">
                                {health.strengths.map((s, i) => (
                                    <li key={i} className="text-sm text-muted-foreground leading-relaxed">• {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Warnings */}
                    {health.warnings.length > 0 && (
                        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <h5 className="font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2 mb-2">
                                <span>⚠️</span> Warnings
                            </h5>
                            <ul className="space-y-1.5">
                                {health.warnings.map((w, i) => (
                                    <li key={i} className="text-sm text-muted-foreground leading-relaxed">• {w}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Recommendations */}
                    {health.recommendations.length > 0 && (
                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <h5 className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2 mb-2">
                                <span>💡</span> Recommendations
                            </h5>
                            <ul className="space-y-1.5">
                                {health.recommendations.map((r, i) => (
                                    <li key={i} className="text-sm text-muted-foreground leading-relaxed">• {r}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
