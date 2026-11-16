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
import { useT } from '@/i18n';
import {
    clientLineText,
    clientPillarText,
    healthLines,
    pillarText,
    type HealthResponseWithItems,
} from '@/lib/healthText';

interface PortfolioHealthScoreProps {
    holdings: StockHolding[];
}

export const PortfolioHealthScore = ({ holdings }: PortfolioHealthScoreProps) => {
    const { t } = useT();
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

            const server = serverHealth as HealthResponseWithItems;
            const pillars = server.pillars;
            // Pillar names and descriptions come from the `health` namespace by pillar id;
            // the server's English is the fallback.
            const pillar = (id: keyof typeof pillars, icon: string) => {
                const p = pillars[id];
                const label = pillarText(id, p.name, p.description);
                return createIndicator(label.name, p.score, label.description, icon, getStatusFromScore(p.score));
            };
            const summary = Array.isArray(server.summaryItems)
                ? healthLines(server.summaryItems, undefined).join(' ')
                : server.textSummary;
            return {
                overallScore: server.overallScore,
                status: getStatusFromScore(server.overallScore),
                grade: server.grade,
                textSummary: summary,
                indicators: {
                    diversification: pillar('structure', 'diversification'),
                    valuation: pillar('valuation', 'valuation'),
                    dividendQuality: pillar('dividend', 'dividend'),
                    concentration: pillar('fundamentals', 'concentration'),
                    sectorBalance: pillar('volatility', 'sector'),
                },
                strengths: healthLines(server.strengthItems, server.strengths),
                warnings: healthLines(server.warningItems, server.warnings),
                recommendations: healthLines(server.recommendationItems, server.recommendations),
            };
        }
        // Server not reachable: a simpler score worked out in the browser. Its English lines
        // and pillar names are matched to `health` templates.
        const local = calculatePortfolioHealth(holdings);
        const indicators = Object.fromEntries(
            Object.entries(local.indicators).map(([id, ind]) => {
                const label = clientPillarText(id, ind.name, ind.description);
                return [id, { ...ind, name: label.name, description: label.description }];
            })
        ) as typeof local.indicators;
        return {
            ...local,
            textSummary: undefined as string | undefined,
            indicators,
            strengths: local.strengths.map(clientLineText),
            warnings: local.warnings.map(clientLineText),
            recommendations: local.recommendations.map(clientLineText),
        };
    }, [holdings, serverHealth]);

    const pillars = Object.values(health.indicators);
    const gradeColor = getGradeColor(health.grade);

    return (
        <section className="surface p-4 sm:p-5">
            <header className="mb-4 flex items-start justify-between gap-2">
                <div>
                    <h3 className="flex items-center gap-1.5 text-base font-semibold">
                        {t("home.healthTitle")}
                        <Explain term="healthScore" />
                    </h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t("home.healthSub")}</p>
                </div>
            </header>

            {loading && !serverHealth ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[160px_1fr]">
                    <div className="flex flex-col items-start justify-center">
                        <div
                            className="flex items-baseline gap-2"
                            role="img"
                            aria-label={t("health.gradeAria", { grade: health.grade, score: health.overallScore })}
                        >
                            <span className="text-5xl font-bold leading-none" style={{ color: gradeColor }} aria-hidden>
                                {health.grade}
                            </span>
                            <span className="font-mono text-sm text-muted-foreground" aria-hidden>{health.overallScore}/100</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{t(`home.health_${health.status}`)}</p>
                    </div>

                    <ul className="space-y-3">
                        {pillars.map((p) => (
                            <li key={p.name}>
                                <div className="mb-1 flex items-center justify-between text-sm">
                                    <span className="flex min-w-0 items-center gap-1.5 font-medium">
                                        <span style={{ color: p.color }}><StatusIcon name={p.icon} className="h-4 w-4" /></span>
                                        {p.name}
                                    </span>
                                    <span className="font-mono text-muted-foreground">{p.value}</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={t("home.healthBarAria", { name: p.name, value: p.value })}>
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
                        <h4 className="mb-2 text-sm font-semibold">{t("home.healthStrengths")}</h4>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {health.strengths.map((line, i) => (
                                <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{line}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {health.warnings.length > 0 && (
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">{t("home.healthWarnings")}</h4>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {health.warnings.map((line, i) => (
                                <li key={i} className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />{line}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {health.recommendations.length > 0 && (
                    <div>
                        <h4 className="mb-2 text-sm font-semibold">{t("health.checksTitle")}</h4>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {health.recommendations.map((line, i) => (
                                <li key={i} className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{line}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
};
