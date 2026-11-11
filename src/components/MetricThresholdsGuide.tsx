/**
 * Metric Thresholds Educational Component
 * ========================================
 * 
 * Visual representation of financial metric thresholds
 * with educational content for investors.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    PE_THRESHOLDS,
    PB_THRESHOLDS,
    DIVIDEND_THRESHOLDS,
    METRIC_EDUCATION,
} from '@/lib/valuationScoring';
import { Info, TrendingUp, BookOpen, Coins, BarChart3 } from 'lucide-react';

export const MetricThresholdsGuide = () => {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Understanding Valuation Metrics
                </CardTitle>
                <CardDescription>
                    Learn what each metric means and how to interpret the values
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* P/E Ratio */}
                <MetricExplainer
                    title="P/E Ratio (Price-to-Earnings)"
                    icon={<TrendingUp className="w-5 h-5" />}
                    education={METRIC_EDUCATION.peRatio}
                    thresholds={[
                        { range: '< 10', label: 'Excellent', color: 'hsl(var(--status-1))', description: 'Potentially undervalued' },
                        { range: '10-15', label: 'Good', color: 'hsl(var(--status-2))', description: 'Fairly priced' },
                        { range: '15-25', label: 'Fair', color: 'hsl(var(--status-3))', description: 'Average valuation' },
                        { range: '25-35', label: 'High', color: 'hsl(var(--status-4))', description: 'Expensive' },
                        { range: '> 35', label: 'Very High', color: 'hsl(var(--status-5))', description: 'Significantly overvalued' },
                    ]}
                    lowerIsBetter={true}
                    nepseAverage="15-20"
                />

                {/* P/B Ratio */}
                <MetricExplainer
                    title="P/B Ratio (Price-to-Book)"
                    icon={<BarChart3 className="w-5 h-5" />}
                    education={METRIC_EDUCATION.pbRatio}
                    thresholds={[
                        { range: '< 1.0', label: 'Excellent', color: 'hsl(var(--status-1))', description: 'Below book value' },
                        { range: '1.0-1.5', label: 'Good', color: 'hsl(var(--status-2))', description: 'Near book value' },
                        { range: '1.5-2.5', label: 'Fair', color: 'hsl(var(--status-3))', description: 'Moderate premium' },
                        { range: '2.5-4.0', label: 'High', color: 'hsl(var(--status-4))', description: 'Significant premium' },
                        { range: '> 4.0', label: 'Very High', color: 'hsl(var(--status-5))', description: 'Large premium' },
                    ]}
                    lowerIsBetter={true}
                    nepseAverage="0.8-1.5 (Banks)"
                />

                {/* Dividend Yield */}
                <MetricExplainer
                    title="Dividend Yield"
                    icon={<Coins className="w-5 h-5" />}
                    education={METRIC_EDUCATION.dividendYield}
                    thresholds={[
                        { range: '> 6%', label: 'Excellent', color: 'hsl(var(--status-1))', description: 'High income' },
                        { range: '4-6%', label: 'Good', color: 'hsl(var(--status-2))', description: 'Good income' },
                        { range: '2-4%', label: 'Fair', color: 'hsl(var(--status-3))', description: 'Moderate income' },
                        { range: '1-2%', label: 'Low', color: 'hsl(var(--status-4))', description: 'Low income' },
                        { range: '< 1%', label: 'Very Low', color: 'hsl(var(--status-5))', description: 'Minimal income' },
                    ]}
                    lowerIsBetter={false}
                    nepseAverage="3-5%"
                />

                {/* EPS */}
                <MetricExplainer
                    title="EPS (Earnings Per Share)"
                    icon={<TrendingUp className="w-5 h-5" />}
                    education={METRIC_EDUCATION.eps}
                    thresholds={[
                        { range: '> Rs 50', label: 'Excellent', color: 'hsl(var(--status-1))', description: 'High profitability' },
                        { range: 'Rs 30-50', label: 'Good', color: 'hsl(var(--status-2))', description: 'Good profitability' },
                        { range: 'Rs 15-30', label: 'Fair', color: 'hsl(var(--status-3))', description: 'Moderate' },
                        { range: 'Rs 5-15', label: 'Low', color: 'hsl(var(--status-4))', description: 'Low profitability' },
                        { range: '< Rs 5', label: 'Very Low', color: 'hsl(var(--status-5))', description: 'Poor profitability' },
                    ]}
                    lowerIsBetter={false}
                    nepseAverage="Varies by sector"
                />

                {/* Educational Notes */}
                <div className="mt-8 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-700 flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4" />
                        Important Notes for Nepal Market
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-700 mt-1">•</span>
                            <span>
                                <strong>Sector Matters:</strong> Banks typically have lower P/B ratios (0.7-1.5) while manufacturing might have higher ones. Compare within sectors.
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-700 mt-1">•</span>
                            <span>
                                <strong>Growth vs Value:</strong> High P/E might be justified for fast-growing companies. Consider growth prospects.
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-700 mt-1">•</span>
                            <span>
                                <strong>Dividend Sustainability:</strong> Very high dividend yields (&gt;10%) may indicate unsustainable payouts or falling stock prices.
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-700 mt-1">•</span>
                            <span>
                                <strong>Face Value:</strong> Nepal uses Rs. 100 face value. Dividends are calculated on face value, not market price.
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-700 mt-1">•</span>
                            <span>
                                <strong>Book Value Importance:</strong> For financial institutions, book value is crucial as it represents net asset backing.
                            </span>
                        </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
};

interface ThresholdItem {
    range: string;
    label: string;
    color: string;
    description: string;
}

interface MetricExplainerProps {
    title: string;
    icon: React.ReactNode;
    education: {
        term: string;
        definition: string;
        example?: string;
        goodRange: string;
        warningThreshold: string;
    };
    thresholds: ThresholdItem[];
    lowerIsBetter: boolean;
    nepseAverage?: string;
}

const MetricExplainer = ({
    title,
    icon,
    education,
    thresholds,
    lowerIsBetter,
    nepseAverage,
}: MetricExplainerProps) => (
    <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {icon}
            </div>
            <div className="flex-1">
                <h4 className="font-semibold text-lg">{title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{education.definition}</p>

                {education.example && (
                    <div className="mt-2 p-2 rounded bg-muted/50 text-sm">
                        <span className="font-medium">Example:</span> {education.example}
                    </div>
                )}

                {/* Threshold Visual */}
                <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                            {lowerIsBetter ? 'Lower is Better ←' : '→ Higher is Better'}
                        </span>
                        {nepseAverage && (
                            <span className="text-xs text-muted-foreground">
                                NEPSE Avg: {nepseAverage}
                            </span>
                        )}
                    </div>

                    <div className="flex rounded-lg overflow-hidden h-8">
                        {thresholds.map((threshold, idx) => (
                            <TooltipProvider key={idx}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="flex-1 flex items-center justify-center cursor-help transition-opacity hover:opacity-80"
                                            style={{ backgroundColor: threshold.color }}
                                        >
                                            <span className="text-xs font-medium text-card">
                                                {threshold.range}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="font-semibold">{threshold.label}</p>
                                        <p className="text-sm">{threshold.description}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>

                    <div className="flex mt-1">
                        {thresholds.map((threshold, idx) => (
                            <div key={idx} className="flex-1 text-center">
                                <span className="text-xs text-muted-foreground">{threshold.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick reference badges */}
                <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/20">
                        Good: {education.goodRange}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/20">
                        Watch: {education.warningThreshold}
                    </Badge>
                </div>
            </div>
        </div>
    </div>
);

// Compact version for tooltips
export const MetricTooltipContent = ({
    metric,
}: {
    metric: 'pe' | 'pb' | 'dividend' | 'eps';
}) => {
    const educationMap = {
        pe: METRIC_EDUCATION.peRatio,
        pb: METRIC_EDUCATION.pbRatio,
        dividend: METRIC_EDUCATION.dividendYield,
        eps: METRIC_EDUCATION.eps,
    };

    const edu = educationMap[metric];

    return (
        <div className="max-w-xs">
            <p className="font-semibold mb-1">{edu.term}</p>
            <p className="text-sm text-muted-foreground mb-2">{edu.definition}</p>
            <div className="space-y-1">
                <p className="text-xs text-green-700">Good: {edu.goodRange}</p>
                <p className="text-xs text-yellow-700">Watch: {edu.warningThreshold}</p>
            </div>
        </div>
    );
};
