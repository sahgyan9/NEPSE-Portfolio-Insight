/**
 * Stock Valuation Card Component
 * ===============================
 * 
 * Individual stock card showing:
 * - Valuation score with visual gauge
 * - Key metrics (P/E, P/B, EPS, Dividend)
 * - Educational tooltips for each metric
 * - Health indicators
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { StockHolding } from '@/data/portfolioData';
import {
    calculateValuationScore,
    getMetricHealth,
    getHealthColor,
    getHealthIcon,
    PE_THRESHOLDS,
    PB_THRESHOLDS,
    DIVIDEND_THRESHOLDS,
    METRIC_EDUCATION,
} from '@/lib/valuationScoring';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { StockSymbolLink } from '@/components/StockSymbolLink';

interface StockValuationCardProps {
    holding: StockHolding;
    showDetails?: boolean;
}

export const StockValuationCard = ({ holding, showDetails = true }: StockValuationCardProps) => {
    const valuation = useMemo(() => calculateValuationScore(holding), [holding]);

    const peHealth = getMetricHealth(holding.peRatio, PE_THRESHOLDS);
    const pbHealth = getMetricHealth(holding.pbRatio, PB_THRESHOLDS);
    const dividendHealth = getMetricHealth(holding.dividendYield, DIVIDEND_THRESHOLDS);

    const formatValue = (value: number | null, suffix = ''): string => {
        if (value === null) return 'N/A';
        return `${value.toFixed(2)}${suffix}`;
    };

    const getGainIcon = () => {
        if (holding.gainLossPercent > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
        if (holding.gainLossPercent < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
        return <Minus className="w-4 h-4 text-gray-500" />;
    };

    return (
        <Card className="w-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <StockSymbolLink symbol={holding.scrip} className="font-bold text-lg" />
                            <Badge variant="outline" className="text-xs">
                                {holding.sector}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {holding.fullName}
                        </p>
                    </div>

                    {/* Valuation Badge */}
                    <div className="flex flex-col items-end">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge
                                        className="text-sm font-bold px-3 py-1"
                                        style={{
                                            backgroundColor: `${valuation.color}20`,
                                            color: valuation.color,
                                        }}
                                    >
                                        {valuation.icon} {valuation.overallScore}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p className="font-semibold">{valuation.label}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Score based on P/E, P/B, EPS, and Dividend metrics
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <span className="text-xs text-muted-foreground mt-1">
                            {valuation.label}
                        </span>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {/* Price & Gain/Loss Row */}
                <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50">
                    <div>
                        <span className="text-xs text-muted-foreground">Current Price</span>
                        <p className="text-lg font-bold">Rs. {holding.currentPrice.toLocaleString()}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                        {getGainIcon()}
                        <div>
                            <span className="text-xs text-muted-foreground">Gain/Loss</span>
                            <p className={`text-lg font-bold ${holding.gainLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {holding.gainLossPercent >= 0 ? '+' : ''}{holding.gainLossPercent.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </div>

                {showDetails && (
                    <>
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* P/E Ratio */}
                            <MetricItem
                                label="P/E Ratio"
                                value={formatValue(holding.peRatio)}
                                health={peHealth}
                                education={METRIC_EDUCATION.peRatio}
                            />

                            {/* P/B Ratio */}
                            <MetricItem
                                label="P/B Ratio"
                                value={formatValue(holding.pbRatio)}
                                health={pbHealth}
                                education={METRIC_EDUCATION.pbRatio}
                            />

                            {/* EPS */}
                            <MetricItem
                                label="EPS"
                                value={holding.eps !== null ? `Rs. ${holding.eps.toFixed(2)}` : 'N/A'}
                                health={holding.eps && holding.eps > 20 ? 'good' : 'fair'}
                                education={METRIC_EDUCATION.eps}
                            />

                            {/* Dividend Yield */}
                            <MetricItem
                                label="Div. Yield"
                                value={formatValue(holding.dividendYield, '%')}
                                health={dividendHealth}
                                education={METRIC_EDUCATION.dividendYield}
                            />
                        </div>
                        
                        {/* Derived Metrics Grid */}
                        {(holding.grahamNumber !== undefined || holding.pegRatio !== undefined || holding.earningsYield !== undefined) && (
                            <div className="mt-4 pt-4 border-t">
                                <h4 className="text-xs font-semibold text-muted-foreground mb-2">ANALYST METRICS</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {holding.grahamNumber !== null && holding.grahamNumber !== undefined && (
                                        <MetricItem
                                            label="Graham Number"
                                            value={`Rs. ${holding.grahamNumber.toFixed(2)}`}
                                            health={holding.currentPrice < holding.grahamNumber ? 'excellent' : 'fair'}
                                            education={METRIC_EDUCATION.grahamNumber}
                                        />
                                    )}
                                    {holding.pegRatio !== null && holding.pegRatio !== undefined && (
                                        <MetricItem
                                            label="PEG Ratio"
                                            value={holding.pegRatio.toFixed(2)}
                                            health={holding.pegRatio < 1.0 ? 'excellent' : holding.pegRatio <= 1.5 ? 'good' : 'poor'}
                                            education={METRIC_EDUCATION.pegRatio}
                                        />
                                    )}
                                    {holding.earningsYield !== null && holding.earningsYield !== undefined && (
                                        <MetricItem
                                            label="Earnings Yield"
                                            value={`${holding.earningsYield.toFixed(2)}%`}
                                            health={holding.earningsYield > 8.0 ? 'excellent' : holding.earningsYield >= 5.0 ? 'good' : 'poor'}
                                            education={METRIC_EDUCATION.earningsYield}
                                        />
                                    )}
                                    {holding.sector === 'Commercial Bank' && holding.netInterestMargin !== null && holding.netInterestMargin !== undefined && (
                                        <MetricItem
                                            label="NIM"
                                            value={`${holding.netInterestMargin.toFixed(2)}%`}
                                            health={holding.netInterestMargin > 3.5 ? 'excellent' : 'fair'}
                                            education={{
                                                term: 'Net Interest Margin (NIM)',
                                                definition: 'Measures the difference between interest income generated and interest paid out relative to assets.',
                                                goodRange: '> 3.5% is healthy',
                                                warningThreshold: '< 2.5% signals pressure on earnings',
                                            }}
                                        />
                                    )}
                                    {(holding.sector === 'Hydropower' || holding.sector === 'Manufacturing') && holding.debtToEquity !== null && holding.debtToEquity !== undefined && (
                                        <MetricItem
                                            label="Debt-to-Equity"
                                            value={holding.debtToEquity.toFixed(2)}
                                            health={holding.debtToEquity < 1.5 ? 'excellent' : holding.debtToEquity <= 2.5 ? 'fair' : 'critical'}
                                            education={{
                                                term: 'Debt-to-Equity (D/E)',
                                                definition: 'Compares total borrowings to shareholders\' equity. Higher leverage increases interest payment risk.',
                                                goodRange: '< 1.5 is standard',
                                                warningThreshold: '> 2.0 indicates elevated leverage risk',
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Score Breakdown */}
                        <div className="mt-4 pt-4 border-t">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">SCORE BREAKDOWN</h4>
                            <div className="space-y-2">
                                <ScoreBar label="P/E" score={valuation.breakdown.peScore} />
                                <ScoreBar label="P/B" score={valuation.breakdown.pbScore} />
                                <ScoreBar label="Dividend" score={valuation.breakdown.dividendScore} />
                                <ScoreBar label="EPS" score={valuation.breakdown.epsScore} />
                            </div>
                        </div>

                        {/* Recommendations */}
                        {valuation.recommendations.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                                <h4 className="text-xs font-semibold text-muted-foreground mb-2">INSIGHTS</h4>
                                <ul className="space-y-1">
                                    {valuation.recommendations.slice(0, 2).map((rec, i) => (
                                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                            <span>•</span>
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};

// Helper component for individual metrics
interface MetricItemProps {
    label: string;
    value: string;
    health: string;
    education: {
        term: string;
        definition: string;
        goodRange: string;
        warningThreshold: string;
    };
}

const MetricItem = ({ label, value, health, education }: MetricItemProps) => {
    const healthColor = getHealthColor(health as 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown');
    const healthIcon = getHealthIcon(health as 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown');

    return (
        <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between mb-1">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <p className="font-semibold mb-1">{education.term}</p>
                            <p className="text-sm mb-2">{education.definition}</p>
                            <p className="text-xs text-green-500">✓ Good: {education.goodRange}</p>
                            <p className="text-xs text-yellow-500">⚠ Warning: {education.warningThreshold}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <span className="text-xs">{healthIcon}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: healthColor }}>
                {value}
            </p>
        </div>
    );
};

// Helper component for score bars
interface ScoreBarProps {
    label: string;
    score: number;
}

const ScoreBar = ({ label, score }: ScoreBarProps) => {
    const getScoreColor = (s: number) => {
        if (s >= 80) return '#22c55e';
        if (s >= 60) return '#84cc16';
        if (s >= 40) return '#eab308';
        if (s >= 20) return '#f97316';
        return '#ef4444';
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs w-16 text-muted-foreground">{label}</span>
            <div className="flex-1">
                <Progress
                    value={score}
                    className="h-1.5"
                    style={{
                        // @ts-expect-error -- CSS custom property
                        '--progress-color': getScoreColor(score),
                    }}
                />
            </div>
            <span className="text-xs font-medium w-8 text-right" style={{ color: getScoreColor(score) }}>
                {score}
            </span>
        </div>
    );
};

// Compact version for tables
export const StockValuationBadge = ({ holding }: { holding: StockHolding }) => {
    const valuation = useMemo(() => calculateValuationScore(holding), [holding]);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <Badge
                        className="text-xs cursor-help"
                        style={{
                            backgroundColor: `${valuation.color}20`,
                            color: valuation.color,
                        }}
                    >
                        {valuation.icon} {valuation.overallScore}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <p className="font-semibold">{valuation.label}</p>
                    <div className="mt-2 space-y-1">
                        <p className="text-xs">P/E Score: {valuation.breakdown.peScore}/100</p>
                        <p className="text-xs">P/B Score: {valuation.breakdown.pbScore}/100</p>
                        <p className="text-xs">Dividend Score: {valuation.breakdown.dividendScore}/100</p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
