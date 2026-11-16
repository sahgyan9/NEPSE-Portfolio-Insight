/**
 * Stock Valuation Card Component
 * ===============================
 *
 * Individual stock card showing:
 * - A plain description of how the price compares with earnings and net worth
 * - Key numbers (P/E, PBV, EPS, dividend yield), each with a tap-to-open explanation
 * - How the score is made, with the number written next to every bar
 *
 * Nothing here is a recommendation. A low price can also mean a weak company, and the
 * card says so wherever it describes a valuation.
 */

import { StockResearchBlock } from "@/components/research/StockResearchBlock";
import { StatusIcon } from "@/components/StatusIcon";
import { Explain } from "@/components/Explain";
import { useMemo, type ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StockHolding } from '@/data/portfolioData';
import {
    calculateValuationScore,
    getMetricHealth,
    getHealthColor,
    getHealthIcon,
    healthWord,
    valuationLabel,
    valuationInsights,
    PE_THRESHOLDS,
    PB_THRESHOLDS,
    DIVIDEND_THRESHOLDS,
} from '@/lib/valuationScoring';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import { useT } from '@/i18n';
import { fmtMoney, fmtNumber, fmtPercent } from '@/i18n/format';
import { MetricHealth, ValuationScore } from '@/types/fundamentals';

interface StockValuationCardProps {
    holding: StockHolding;
    showDetails?: boolean;
    allHoldings?: StockHolding[];
}

const ratio = (value: number | null | undefined, na: string, suffix = ''): string =>
    value === null || value === undefined || Number.isNaN(value) ? na : `${value.toFixed(2)}${suffix}`;

/** Status icon, plain description and the "low price can mean a weak company" note. */
const ValuationDescription = ({ valuation, align = 'left' }: { valuation: ValuationScore; align?: 'left' | 'right' }) => {
    const { t } = useT();
    const rated = valuation.status !== 'unknown';
    return (
        <div className={align === 'right' ? 'text-right' : ''}>
            <p
                className={`inline-flex items-start gap-1.5 text-sm font-medium leading-relaxed ${align === 'right' ? 'text-right' : ''}`}
                style={{ color: valuation.color }}
            >
                <span className="mt-1 shrink-0"><StatusIcon name={valuation.icon} /></span>
                <span>{valuationLabel(valuation)}</span>
            </p>
            {rated && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('valuation.lowPriceNote')}</p>
            )}
        </div>
    );
};

export const StockValuationCard = ({ holding, showDetails = true, allHoldings }: StockValuationCardProps) => {
    const { t } = useT();
    const valuation = useMemo(() => calculateValuationScore(holding), [holding]);
    const na = t('valuation.na');

    const peHealth = getMetricHealth(holding.peRatio, PE_THRESHOLDS);
    const pbHealth = getMetricHealth(holding.pbRatio, PB_THRESHOLDS);
    const dividendHealth = getMetricHealth(holding.dividendYield, DIVIDEND_THRESHOLDS);

    const up = holding.gainLossPercent > 0;
    const down = holding.gainLossPercent < 0;
    const GainIcon = up ? TrendingUp : down ? TrendingDown : Minus;
    const gainTone = up ? 'text-success' : down ? 'text-destructive' : 'text-muted-foreground';
    const gainWord = up ? t('valuation.profit') : down ? t('valuation.loss') : t('valuation.profitLoss');

    const sectorAverages = useMemo(() => {
        if (!allHoldings) return { pe: null, pb: null };
        const peers = allHoldings.filter(h => h.sector === holding.sector);
        const peList = peers.map(h => h.peRatio).filter((pe): pe is number => pe !== null && pe !== undefined && pe > 0);
        const pbList = peers.map(h => h.pbRatio).filter((pb): pb is number => pb !== null && pb !== undefined && pb > 0);
        return {
            pe: peList.length > 0 ? peList.reduce((a, b) => a + b, 0) / peList.length : null,
            pb: pbList.length > 0 ? pbList.reduce((a, b) => a + b, 0) / pbList.length : null,
        };
    }, [allHoldings, holding.sector]);

    const has52w = holding.high52 !== null && holding.high52 !== undefined && holding.low52 !== null && holding.low52 !== undefined;
    const hasGovernance = (holding.promoterHolding !== null && holding.promoterHolding !== undefined) || (holding.avgVolume120d !== null && holding.avgVolume120d !== undefined);
    const insights = valuationInsights(valuation).slice(0, 2);

    return (
        <Card className="w-full overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <StockSymbolLink symbol={holding.scrip} className="text-lg font-bold" />
                            <Badge variant="outline" className="text-xs">
                                {holding.sector}
                            </Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                            {holding.fullName}
                        </p>
                    </div>

                    <div className="shrink-0 text-right">
                        <Badge
                            className="px-3 py-1 text-sm font-bold"
                            style={{
                                backgroundColor: `color-mix(in srgb, ${valuation.color} 14%, transparent)`,
                                color: valuation.color,
                            }}
                        >
                            <span className="inline-flex items-center gap-1">
                                <StatusIcon name={valuation.icon} />
                                <span className="sr-only">{t('valuation.lblScore')}: </span>
                                {valuation.overallScore}
                            </span>
                        </Badge>
                        <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                            {t('valuation.scoreValue', { score: valuation.overallScore })}
                            <Explain text={t('valuation.scoreTip')} title={t('valuation.lblScore')} />
                        </p>
                    </div>
                </div>
                <div className="pt-2">
                    <ValuationDescription valuation={valuation} />
                </div>
            </CardHeader>

            <CardContent>
                {/* Price and profit or loss */}
                <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                    <div className="min-w-0">
                        <span className="text-xs text-muted-foreground">{t('valuation.currentPrice')}</span>
                        <p className="text-lg font-bold">{fmtMoney(holding.currentPrice, true)}</p>
                    </div>
                    <div className={`flex items-center gap-2 text-right ${gainTone}`}>
                        <GainIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <div>
                            <span className="text-xs text-muted-foreground">{gainWord}</span>
                            <p className="text-lg font-bold">{fmtPercent(holding.gainLossPercent, 2)}</p>
                        </div>
                    </div>
                </div>

                {showDetails && (
                    <>
                        {/* 52-week range */}
                        {has52w && (() => {
                            const range = holding.high52! - holding.low52!;
                            const pct = range > 0 ? ((holding.currentPrice - holding.low52!) / range) * 100 : 0;
                            const clamped = Math.min(100, Math.max(0, pct));
                            return (
                                <div className="mb-4 space-y-2 rounded-lg border border-border p-3">
                                    <p className="text-sm font-semibold">{t('valuation.range52')}</p>
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        {t('valuation.rangePosition', { pct: Math.round(clamped) })}
                                    </p>
                                    <div className="relative h-2 w-full rounded-full bg-muted" role="img" aria-label={t('valuation.rangePosition', { pct: Math.round(clamped) })}>
                                        <div className="h-full w-full rounded-full bg-primary/20" />
                                        <div
                                            className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow"
                                            style={{ left: `${clamped}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                                        <span>{t('valuation.low52')}: {fmtMoney(holding.low52, true)}</span>
                                        <span className="text-right">{t('valuation.high52')}: {fmtMoney(holding.high52, true)}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Key numbers */}
                        <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{t('valuation.keyNumbers')}</h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <MetricItem
                                label={t('valuation.lblPe')}
                                explain={<Explain term="pe" />}
                                value={ratio(holding.peRatio, na)}
                                health={peHealth}
                                subValue={sectorAverages.pe !== null ? t('valuation.sectorAvg', { value: sectorAverages.pe.toFixed(1) }) : undefined}
                            />
                            <MetricItem
                                label={t('valuation.lblPb')}
                                explain={<Explain term="pb" />}
                                value={ratio(holding.pbRatio, na)}
                                health={pbHealth}
                                subValue={sectorAverages.pb !== null ? t('valuation.sectorAvg', { value: sectorAverages.pb.toFixed(1) }) : undefined}
                            />
                            <MetricItem
                                label={t('valuation.lblEps')}
                                explain={<Explain term="eps" />}
                                value={holding.eps !== null ? fmtMoney(holding.eps, true) : na}
                                health={holding.eps && holding.eps > 20 ? 'good' : 'fair'}
                            />
                            <MetricItem
                                label={t('valuation.lblDividendYield')}
                                explain={<Explain term="dividendYield" />}
                                value={holding.dividendYield !== null ? fmtPercent(holding.dividendYield, 2, false) : na}
                                health={dividendHealth}
                            />
                            {holding.bookValue !== null && holding.bookValue !== undefined && (
                                <MetricItem
                                    label={t('valuation.lblBookValue')}
                                    explain={<Explain term="bookValue" />}
                                    value={fmtMoney(holding.bookValue, true)}
                                    health="unknown"
                                />
                            )}
                        </div>

                        {/* Other measures */}
                        {(holding.grahamNumber !== undefined || holding.pegRatio !== undefined || holding.earningsYield !== undefined) && (
                            <div className="mt-4 border-t pt-4">
                                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{t('valuation.otherMeasures')}</h4>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {holding.grahamNumber !== null && holding.grahamNumber !== undefined && (
                                        <MetricItem
                                            label={t('valuation.lblGraham')}
                                            explain={<Explain title={t('valuation.xGrahamTitle')} text={t('valuation.xGrahamText')} />}
                                            value={fmtMoney(holding.grahamNumber, true)}
                                            health={holding.currentPrice < holding.grahamNumber ? 'excellent' : 'fair'}
                                        />
                                    )}
                                    {holding.pegRatio !== null && holding.pegRatio !== undefined && (
                                        <MetricItem
                                            label={t('valuation.lblPeg')}
                                            explain={<Explain title={t('valuation.xPegTitle')} text={t('valuation.xPegText')} />}
                                            value={holding.pegRatio.toFixed(2)}
                                            health={holding.pegRatio < 1.0 ? 'excellent' : holding.pegRatio <= 1.5 ? 'good' : 'poor'}
                                        />
                                    )}
                                    {holding.earningsYield !== null && holding.earningsYield !== undefined && (
                                        <MetricItem
                                            label={t('valuation.lblEarningsYield')}
                                            explain={<Explain title={t('valuation.xEarningsYieldTitle')} text={t('valuation.xEarningsYieldText')} />}
                                            value={fmtPercent(holding.earningsYield, 2, false)}
                                            health={holding.earningsYield > 8.0 ? 'excellent' : holding.earningsYield >= 5.0 ? 'good' : 'poor'}
                                        />
                                    )}
                                    {holding.sector === 'Commercial Bank' && holding.netInterestMargin !== null && holding.netInterestMargin !== undefined && (
                                        <MetricItem
                                            label={t('valuation.lblNim')}
                                            explain={<Explain title={t('valuation.xNimTitle')} text={t('valuation.xNimText')} />}
                                            value={fmtPercent(holding.netInterestMargin, 2, false)}
                                            health={holding.netInterestMargin > 3.5 ? 'excellent' : 'fair'}
                                        />
                                    )}
                                    {(holding.sector === 'Hydropower' || holding.sector === 'Manufacturing') && holding.debtToEquity !== null && holding.debtToEquity !== undefined && (
                                        <MetricItem
                                            label={t('valuation.lblDe')}
                                            explain={<Explain title={t('valuation.xDeTitle')} text={t('valuation.xDeText')} />}
                                            value={holding.debtToEquity.toFixed(2)}
                                            health={holding.debtToEquity < 1.5 ? 'excellent' : holding.debtToEquity <= 2.5 ? 'fair' : 'critical'}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Ownership and trading */}
                        {hasGovernance && (
                            <div className="mt-4 border-t pt-4">
                                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{t('valuation.ownership')}</h4>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {holding.promoterHolding !== null && holding.promoterHolding !== undefined && (
                                        <MetricItem
                                            label={t('valuation.lblPromoter')}
                                            explain={<Explain term="promoterShare" />}
                                            value={fmtPercent(holding.promoterHolding, 1, false)}
                                            health={holding.promoterHolding >= 51 ? 'excellent' : holding.promoterHolding >= 30 ? 'good' : 'poor'}
                                        />
                                    )}
                                    {holding.avgVolume120d !== null && holding.avgVolume120d !== undefined && (
                                        <MetricItem
                                            label={t('valuation.lblVolume')}
                                            explain={<Explain title={t('valuation.xVolumeTitle')} text={t('valuation.xVolumeText')} />}
                                            value={fmtNumber(holding.avgVolume120d)}
                                            health={holding.avgVolume120d >= 5000 ? 'excellent' : 'poor'}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* How the score is made */}
                        <div className="mt-4 border-t pt-4">
                            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{t('valuation.breakdown')}</h4>
                            <div className="space-y-3">
                                <ScoreBar label={t('valuation.lblPe')} score={valuation.breakdown.peScore} />
                                <ScoreBar label={t('valuation.lblPb')} score={valuation.breakdown.pbScore} />
                                <ScoreBar label={t('valuation.lblDividend')} score={valuation.breakdown.dividendScore} />
                                <ScoreBar label={t('valuation.lblEps')} score={valuation.breakdown.epsScore} />
                            </div>
                        </div>

                        {/* What the numbers show */}
                        {insights.length > 0 && (
                            <div className="mt-4 border-t pt-4">
                                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{t('valuation.insights')}</h4>
                                <ul className="space-y-2">
                                    {insights.map((text, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                                            <Info className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                            <span>{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}
                <StockResearchBlock symbol={holding.scrip} sector={holding.sector} narrow className="mt-4" />
            </CardContent>
        </Card>
    );
};

/**
 * Simple-mode card: at most three numbers (P/E, PBV, dividend yield) and one plain description.
 */
export const SimpleValuationCard = ({ holding }: { holding: StockHolding }) => {
    const { t } = useT();
    const valuation = useMemo(() => calculateValuationScore(holding), [holding]);
    const na = t('valuation.na');
    const isFund = holding.sector === 'Mutual Fund';

    return (
        <Card className="w-full overflow-hidden">
            <CardHeader className="pb-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <StockSymbolLink symbol={holding.scrip} className="text-lg font-bold" />
                        <Badge variant="outline" className="text-xs">{holding.sector}</Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{holding.fullName}</p>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {!isFund && (
                    <dl className="grid grid-cols-3 gap-2">
                        <SimpleNumber label={t('valuation.lblPe')} term="pe" value={ratio(holding.peRatio, na)} />
                        <SimpleNumber label={t('valuation.lblPb')} term="pb" value={ratio(holding.pbRatio, na)} />
                        <SimpleNumber
                            label={t('valuation.lblDividendYield')}
                            term="dividendYield"
                            value={holding.dividendYield !== null ? fmtPercent(holding.dividendYield, 1, false) : na}
                        />
                    </dl>
                )}
                <ValuationDescription valuation={valuation} />
            </CardContent>
        </Card>
    );
};

const SimpleNumber = ({ label, term, value }: { label: string; term: 'pe' | 'pb' | 'dividendYield'; value: string }) => (
    <div className="min-w-0 rounded-lg bg-muted/40 p-2.5">
        <dt className="flex items-center gap-1 text-xs leading-relaxed text-muted-foreground">
            <span className="min-w-0">{label}</span>
            <Explain term={term} />
        </dt>
        <dd className="mt-0.5 text-lg font-bold">{value}</dd>
    </div>
);

// Helper component for individual metrics
interface MetricItemProps {
    label: string;
    value: string;
    health: MetricHealth;
    subValue?: string;
    explain: ReactNode;
}

const MetricItem = ({ label, value, health, subValue, explain }: MetricItemProps) => {
    const healthColor = getHealthColor(health);
    const healthIcon = getHealthIcon(health);

    return (
        <div className="flex h-full flex-col justify-between rounded-lg bg-muted/30 p-3">
            <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {label}
                        {explain}
                    </span>
                    {health !== 'unknown' && (
                        <span style={{ color: healthColor }}>
                            <StatusIcon name={healthIcon} />
                            <span className="sr-only">{healthWord(health)}</span>
                        </span>
                    )}
                </div>
                <p className="text-lg font-bold" style={{ color: healthColor }}>
                    {value}
                </p>
            </div>
            {subValue && (
                <p className="mt-1 border-t border-border/20 pt-1 text-xs text-muted-foreground">
                    {subValue}
                </p>
            )}
        </div>
    );
};

// Helper component for score bars: the number is written beside the bar
interface ScoreBarProps {
    label: string;
    score: number;
}

const ScoreBar = ({ label, score }: ScoreBarProps) => {
    const { t } = useT();
    const getScoreColor = (s: number) => {
        if (s >= 80) return 'hsl(var(--status-1))';
        if (s >= 60) return 'hsl(var(--status-2))';
        if (s >= 40) return 'hsl(var(--status-3))';
        if (s >= 20) return 'hsl(var(--status-4))';
        return 'hsl(var(--status-5))';
    };

    return (
        <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-sm leading-relaxed text-muted-foreground">{label}</span>
            <div className="min-w-0 flex-1">
                <Progress
                    value={score}
                    className="h-2"
                    aria-label={`${label}: ${t('valuation.scoreValue', { score })}`}
                    style={{
                        // @ts-expect-error -- CSS custom property
                        '--progress-color': getScoreColor(score),
                    }}
                />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-sm font-medium">
                {score}/100
            </span>
        </div>
    );
};

// Compact version for tables
export const StockValuationBadge = ({ holding }: { holding: StockHolding }) => {
    const { t } = useT();
    const valuation = useMemo(() => calculateValuationScore(holding), [holding]);

    return (
        <Badge
            className="text-xs"
            title={`${valuationLabel(valuation)}. ${t('valuation.lblPe')}: ${valuation.breakdown.peScore}/100, ${t('valuation.lblPb')}: ${valuation.breakdown.pbScore}/100, ${t('valuation.lblDividend')}: ${valuation.breakdown.dividendScore}/100`}
            style={{
                backgroundColor: `color-mix(in srgb, ${valuation.color} 14%, transparent)`,
                color: valuation.color,
            }}
        >
            <span className="inline-flex items-center gap-1">
                <StatusIcon name={valuation.icon} />
                {valuation.overallScore}
                <span className="sr-only">{valuationLabel(valuation)}</span>
            </span>
        </Badge>
    );
};
