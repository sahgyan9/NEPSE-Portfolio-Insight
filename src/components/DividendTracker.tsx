/**
 * Dividend Tracker Component
 * ==========================
 *
 * Displays dividend information including:
 * - Expected annual dividends
 * - Dividend calendar
 * - Yield analysis
 * - Projections by holding
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StockHolding } from '@/data/portfolioData';
import { calculateDividendProjections } from '@/lib/valuationScoring';
import { Coins, Calendar, TrendingUp, Gift, PiggyBank } from 'lucide-react';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import { Explain } from '@/components/Explain';
import { useT } from '@/i18n';
import { fmtMoney, fmtNumber, fmtPercent } from '@/i18n/format';

interface DividendTrackerProps {
    holdings: StockHolding[];
}

const CONFIDENCE_KEY: Record<string, string> = {
    high: 'dividends.confidenceHigh',
    medium: 'dividends.confidenceMedium',
    low: 'dividends.confidenceLow',
};

/** Month windows produced by calculateDividendProjections (English, Gregorian). */
const MONTH_KEY: Record<string, string> = {
    'July-Aug': 'dividends.monthJulAug',
    'July-Sept': 'dividends.monthJulSep',
    'Aug-Oct': 'dividends.monthAugOct',
};

export const DividendTracker = ({ holdings }: DividendTrackerProps) => {
    const { t } = useT();
    const dividendData = useMemo(() => calculateDividendProjections(holdings), [holdings]);

    const tiles = [
        { icon: PiggyBank, label: t('dividends.trackerExpectedCash'), value: fmtMoney(dividendData.totalExpectedCashDividend), sub: t('dividends.trackerExpectedCashSub') },
        { icon: Gift, label: t('dividends.trackerBonusValue'), value: fmtMoney(dividendData.totalExpectedBonusValue), sub: t('dividends.trackerBonusValueSub') },
        { icon: TrendingUp, label: t('dividends.trackerYield'), value: fmtPercent(dividendData.portfolioDividendYield, 2, false), sub: t('dividends.trackerYieldSub'), term: 'dividendYield' as const },
        { icon: Calendar, label: t('dividends.trackerYoc'), value: fmtPercent(dividendData.yieldOnCost, 2, false), sub: t('dividends.trackerYocSub'), term: 'yieldOnCost' as const },
    ];

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Coins className="w-5 h-5 text-primary" aria-hidden="true" />
                            {t('dividends.trackerTitle')}
                        </CardTitle>
                        <CardDescription className="leading-relaxed">
                            {t('dividends.trackerSub')}
                        </CardDescription>
                    </div>
                    <Explain title={t('dividends.trackerInfoTitle')} text={t('dividends.trackerInfo')} className="h-6 w-6" />
                </div>
            </CardHeader>

            <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {tiles.map(({ icon: Icon, label, value, sub, term }) => (
                        <div key={label} className="p-4 rounded-xl bg-muted/50 border border-border">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                                {term && <Explain term={term} />}
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-foreground break-words">{value}</p>
                            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                        </div>
                    ))}
                </div>

                {/* Dividend Projections */}
                <div className="mt-6">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4" aria-hidden="true" />
                        {t('dividends.trackerByStock')}
                    </h4>

                    <div className="space-y-3">
                        {dividendData.upcomingDividends.length > 0 ? (
                            dividendData.upcomingDividends.map((dividend) => (
                                <DividendProjectionRow key={dividend.symbol} dividend={dividend} />
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                {t('dividends.trackerEmpty')}
                            </p>
                        )}
                    </div>
                </div>

                {/* Educational Note */}
                <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
                    <h5 className="font-semibold text-sm mb-2">
                        {t('dividends.trackerLearnTitle')}
                    </h5>
                    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                        <p><strong className="text-foreground">{t('dividends.trackerLearnCashLabel')}</strong> {t('dividends.trackerLearnCash')}</p>
                        <p><strong className="text-foreground">{t('dividends.trackerLearnBonusLabel')}</strong> {t('dividends.trackerLearnBonus')}</p>
                        <p><strong className="text-foreground">{t('dividends.trackerLearnBookLabel')}</strong> {t('dividends.trackerLearnBook')}</p>
                        <p><strong className="text-foreground">{t('dividends.trackerLearnAgmLabel')}</strong> {t('dividends.trackerLearnAgm')}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// Individual dividend projection row
interface DividendProjectionRowProps {
    dividend: {
        symbol: string;
        name: string;
        quantity: number;
        currentPrice: number;
        expectedDividendPercent: number;
        expectedCashAmount: number;
        expectedBonusShares: number;
        expectedMonth?: string;
        confidence: 'high' | 'medium' | 'low';
    };
}

const DividendProjectionRow = ({ dividend }: DividendProjectionRowProps) => {
    const { t } = useT();
    const confidenceClass: Record<string, string> = {
        high: 'bg-success/10 text-success border-success/20',
        medium: 'bg-warning/10 text-warning border-warning/20',
        low: 'bg-muted text-muted-foreground border-border',
    };

    return (
        <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <StockSymbolLink symbol={dividend.symbol} className="font-bold" />
                        <Badge variant="outline" className="text-xs font-normal">
                            {t('dividends.kittaCount', { n: fmtNumber(dividend.quantity) })}
                        </Badge>
                        <Badge variant="outline" className={`text-xs font-normal ${confidenceClass[dividend.confidence] ?? confidenceClass.low}`}>
                            {t(CONFIDENCE_KEY[dividend.confidence] ?? 'dividends.confidenceLow')}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                        {dividend.name}
                    </p>
                </div>

                <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-foreground">
                        {fmtMoney(dividend.expectedCashAmount)}
                    </p>
                    {dividend.expectedMonth && (
                        <p className="text-xs text-muted-foreground">
                            {t('dividends.trackerExpectedMonth', {
                                month: MONTH_KEY[dividend.expectedMonth] ? t(MONTH_KEY[dividend.expectedMonth]) : dividend.expectedMonth,
                            })}
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-border">
                <div>
                    <span className="text-xs text-muted-foreground">{t('dividends.trackerRowYield')}</span>
                    <p className="font-medium">{fmtPercent(dividend.expectedDividendPercent, 1, false)}</p>
                </div>
                <div>
                    <span className="text-xs text-muted-foreground">{t('dividends.trackerRowCash')}</span>
                    <p className="font-medium">{fmtMoney(dividend.expectedCashAmount)}</p>
                </div>
                <div>
                    <span className="text-xs text-muted-foreground">{t('dividends.trackerRowBonus')}</span>
                    <p className="font-medium">{t('dividends.kittaCount', { n: fmtNumber(dividend.expectedBonusShares) })}</p>
                </div>
            </div>

            {/* Visual yield bar */}
            <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{t('dividends.trackerRowStrength')}</span>
                    <span className="font-medium">{fmtPercent(dividend.expectedDividendPercent, 1, false)}</span>
                </div>
                <Progress
                    value={Math.min(dividend.expectedDividendPercent * 10, 100)}
                    className="h-1.5"
                    aria-label={t('dividends.trackerRowStrength')}
                />
            </div>
        </div>
    );
};

// Compact version for dashboard
export const DividendSummaryCard = ({ holdings }: DividendTrackerProps) => {
    const { t } = useT();
    const dividendData = useMemo(() => calculateDividendProjections(holdings), [holdings]);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary" aria-hidden="true" />
                    {t('dividends.summaryCardTitle')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-foreground break-words">
                    {fmtMoney(dividendData.totalExpectedCashDividend)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    {t('dividends.summaryCardSub')}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                        {t('dividends.trackerYield')}
                        <Explain term="dividendYield" />
                    </span>
                    <span className="font-medium">{fmtPercent(dividendData.portfolioDividendYield, 2, false)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm mt-1">
                    <span className="flex items-center gap-1 text-muted-foreground">
                        {t('dividends.trackerYoc')}
                        <Explain term="yieldOnCost" />
                    </span>
                    <span className="font-medium">{fmtPercent(dividendData.yieldOnCost, 2, false)}</span>
                </div>
            </CardContent>
        </Card>
    );
};
