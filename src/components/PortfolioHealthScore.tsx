/**
 * Portfolio Health Score
 * Grade, score and five pillar bars, then plain lists of strengths and things to look at.
 */

import { useMemo, useState, useEffect } from 'react';
import { Explain } from '@/components/Explain';
import { Skeleton } from '@/components/ui/skeleton';
import { StockHolding } from '@/data/portfolioData';
import {
    calculatePortfolioHealth,
    getGradeColor,
    getHealthColor,
    getHealthBgColor,
} from '@/lib/valuationScoring';
import { getPortfolioHealth, PortfolioHealthResponse } from '@/services/portfolioDb';
import { StatusIcon } from '@/components/StatusIcon';
import { HealthIndicator, MetricHealth } from '@/types/fundamentals';
import { Check, TriangleAlert, ArrowRight } from 'lucide-react';

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
                        'diversification',
                        getStatusFromScore(pillars.structure.score)
                    ),
                    valuation: createIndicator(
                        pillars.valuation.name,
                        pillars.valuation.score,
                        pillars.valuation.description,
                        'valuation',
                        getStatusFromScore(pillars.valuation.score)
                    ),
                    dividendQuality: createIndicator(
                        pillars.dividend.name,
                        pillars.dividend.score,
                        pillars.dividend.description,
                        'dividend',
                        getStatusFromScore(pillars.dividend.score)
                    ),
                    concentration: createIndicator(
                        pillars.fundamentals.name,
                        pillars.fundamentals.score,
                        pillars.fundamentals.description,
                        'concentration',
                        getStatusFromScore(pillars.fundamentals.score)
                    ),
                    sectorBalance: createIndicator(
                        pillars.volatility.name,
                        pillars.volatility.score,
                        pillars.volatility.description,
                        'sector',
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

    const pillars = Object.values(health.indicators);
    const gradeColor = getGradeColor(health.grade);

    return (
        <section className="surface p-4 sm:p-5">
            <header className="mb-4 flex items-start justify-between gap-2">
                <div>
                    <h3 className="flex items-center gap-1.5 text-base font-semibold">
                        How healthy is the portfolio overall?
                        <Explain term="healthScore" />
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Five checks, each scored 0 to 100.</p>
                </div>
            </header>

            {loading && !serverHealth ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[160px_1fr]">
                    <div className="flex flex-col items-start justify-center">
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold leading-none" style={{ color: gradeColor }}>
                                {health.grade}
                            </span>
                            <span className="font-mono text-sm text-muted-foreground">{health.overallScore}/100</span>
                        </div>
                        <p className="mt-2 text-sm capitalize text-muted-foreground">{health.status.replace('-', ' ')}</p>
                    </div>

                    <ul className="space-y-3">
                        {pillars.map((p) => (
                            <li key={p.name}>
                                <div className="mb-1 flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <span style={{ color: p.color }}><StatusIcon name={p.icon} className="h-4 w-4" /></span>
                                        {p.name}
                                    </span>
                                    <span className="font-mono text-muted-foreground">{p.value}</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${p.name}: ${p.value} out of 100`}>
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, p.value))}%`, background: p.color }} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {health.textSummary && (
                <p className="mt-5 rounded-md border border-border bg-muted/50 p-3 text-sm leading-relaxed">
                    {health.textSummary}
                </p>
            )}

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
                {health.strengths.length > 0 && (
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">Strengths</h4>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {health.strengths.map((t, i) => (
                                <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{t}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {health.warnings.length > 0 && (
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">Worth a closer look</h4>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {health.warnings.map((t, i) => (
                                <li key={i} className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{t}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {health.recommendations.length > 0 && (
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">Things to consider</h4>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {health.recommendations.map((t, i) => (
                                <li key={i} className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
};
