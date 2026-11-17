/**
 * Market Context Component
 * ========================
 * 
 * Displays real-time NEPSE market data including:
 * - NEPSE Index with trend
 * - Market summary stats
 * - Top gainers/losers
 * - Sub-indices
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    fetchMarketContext,
    MarketContext,
    TopStock,
} from '@/services/marketData';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import { useT } from '@/i18n';
import { fmtMoney, fmtMoneyCompact, fmtNumber, fmtPercent } from '@/i18n/format';
import {
    TrendingUp,
    TrendingDown,
    Activity,
    BarChart3,
    RefreshCw,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Building2,
    Info,
} from 'lucide-react';

/** Index points keep two decimals; digits stay Latin with lakh grouping. */
const idx2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtIndex = (v: number) => idx2.format(v);
const fmtSignedPts = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
const timeOf = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** The user's own change since the previous close, shown beside NEPSE in the compact strip. */
export interface PortfolioDayChange {
    amount?: number;
    percent?: number;
}

interface MarketContextDisplayProps {
    compact?: boolean;
    portfolioToday?: PortfolioDayChange;
}

export const MarketContextDisplay = ({ compact = false, portfolioToday }: MarketContextDisplayProps) => {
    const { t } = useT();
    const [marketData, setMarketData] = useState<MarketContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchMarketContext();
            setMarketData(data);
        } catch (err) {
            setError('failed');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Retry every 30 s while NEPSE server is still warming up;
        // slow down to every 5 min once index data is available.
        const intervalMs = marketData?.nepseIndex ? 5 * 60 * 1000 : 30 * 1000;
        const interval = setInterval(fetchData, intervalMs);
        return () => clearInterval(interval);
    }, [fetchData, marketData?.nepseIndex]);

    if (isLoading && !marketData) {
        return <MarketContextSkeleton compact={compact} />;
    }

    if (error) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                    <p className="text-muted-foreground mb-4 text-center text-sm leading-relaxed">{t('home.mktError')}</p>
                    <Button onClick={fetchData} variant="outline" className="h-11 sm:h-9">
                        <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                        {t('common.retry')}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!marketData) return null;

    if (compact) {
        return <CompactMarketWidget data={marketData} onRefresh={fetchData} portfolioToday={portfolioToday} />;
    }

    return (
        <div className="space-y-4">
            {/* Main Index Card */}
            <Card className="overflow-hidden">
                <div className="bg-muted/50 p-4 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-5 h-5 text-primary" />
                                <span className="text-sm font-medium text-muted-foreground">{t('home.mktIndex')}</span>
                            </div>
                            {marketData.nepseIndex ? (
                                <>
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                        <span className="text-3xl font-bold sm:text-4xl">
                                            {fmtIndex(marketData.nepseIndex.index)}
                                        </span>
                                        <div className={`flex items-center gap-1 ${marketData.nepseIndex.change >= 0 ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                            {marketData.nepseIndex.change >= 0 ? (
                                                <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
                                            ) : (
                                                <ArrowDownRight className="w-5 h-5" aria-hidden="true" />
                                            )}
                                            <span className="sr-only">{t(marketData.nepseIndex.change >= 0 ? 'home.mktUp' : 'home.mktDown')}</span>
                                            <span className="text-lg font-semibold">
                                                {fmtSignedPts(marketData.nepseIndex.change)}
                                            </span>
                                            <span className="text-sm">
                                                ({fmtPercent(marketData.nepseIndex.percentChange, 2)})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                        <span>{t('home.mktHigh', { value: fmtIndex(marketData.nepseIndex.high) })}</span>
                                        <span>{t('home.mktLow', { value: fmtIndex(marketData.nepseIndex.low) })}</span>
                                        <span>{t('home.mktPrev', { value: fmtIndex(marketData.nepseIndex.previousClose) })}</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-muted-foreground">{t('home.mktIndexUnavailable')}</p>
                            )}
                        </div>

                        <div className="text-right">
                            <Button onClick={fetchData} variant="ghost" size="sm" className="mb-2 h-11 sm:h-9">
                                <RefreshCw className="w-4 h-4 mr-1" aria-hidden="true" />
                                {t('common.refresh')}
                            </Button>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                {t('common.updated', { time: timeOf(marketData.lastUpdated) })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Market Summary */}
                {marketData.summary && (
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatItem
                                label={t('home.mktTurnover')}
                                value={fmtMoneyCompact(marketData.summary.totalTurnover)}
                                icon={<BarChart3 className="w-4 h-4" />}
                            />
                            <StatItem
                                label={t('home.mktTradedShares')}
                                value={fmtNumber(marketData.summary.totalTradedShares)}
                                icon={<Activity className="w-4 h-4" />}
                            />
                            <StatItem
                                label={t('home.mktTransactions')}
                                value={fmtNumber(marketData.summary.totalTransactions)}
                                icon={<TrendingUp className="w-4 h-4" />}
                            />
                            <StatItem
                                label={t('home.mktScrips')}
                                value={fmtNumber(marketData.summary.totalScripsTrades)}
                                icon={<Building2 className="w-4 h-4" />}
                            />
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Top Gainers & Losers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TopMoversCard
                    title={t('home.mktGainers')}
                    stocks={marketData.topGainers}
                    type="gainer"
                />
                <TopMoversCard
                    title={t('home.mktLosers')}
                    stocks={marketData.topLosers}
                    type="loser"
                />
            </div>

            {/* Sub-Indices */}
            {marketData.subIndices.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            {t('home.mktSectorIndices')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {marketData.subIndices.map((index) => (
                                <SubIndexItem key={index.name} index={index} />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// Compact widget for dashboard header
const CompactMarketWidget = ({
    data,
    onRefresh,
    portfolioToday,
}: {
    data: MarketContext;
    onRefresh: () => void;
    portfolioToday?: PortfolioDayChange;
}) => {
    const { t } = useT();
    const mine = portfolioToday?.amount;
    const hasMine = mine !== undefined && mine !== null && !Number.isNaN(mine);
    // Under Rs. 1 either way counts as no change, same rule as the simple view.
    const mineDir = !hasMine ? null : Math.abs(mine) < 1 ? 'flat' : mine > 0 ? 'up' : 'down';
    return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">{t('home.mktNepse')}</span>
        </div>

        {data.nepseIndex && (
            <>
                <span className="text-lg font-bold">
                    {fmtIndex(data.nepseIndex.index)}
                </span>
                <Badge
                    variant="outline"
                    className={data.nepseIndex.change >= 0
                        ? 'bg-green-500/10 text-green-700 border-green-500/20'
                        : 'bg-red-500/10 text-red-700 border-red-500/20'
                    }
                >
                    {data.nepseIndex.change >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 mr-1" aria-hidden="true" />
                    ) : (
                        <ArrowDownRight className="w-3 h-3 mr-1" aria-hidden="true" />
                    )}
                    <span className="sr-only">{t(data.nepseIndex.change >= 0 ? 'home.mktUp' : 'home.mktDown')} </span>
                    {fmtSignedPts(data.nepseIndex.change)} ({fmtPercent(data.nepseIndex.percentChange, 2)})
                </Badge>
            </>
        )}

        {hasMine && (
            <div className="flex items-center gap-2" title={t('home.mktMineHint')}>
                <span className="text-sm font-medium">{t('home.mktMine')}</span>
                <Badge
                    variant="outline"
                    className={mineDir === 'up'
                        ? 'bg-green-500/10 text-green-700 border-green-500/20'
                        : mineDir === 'down'
                            ? 'bg-red-500/10 text-red-700 border-red-500/20'
                            : 'text-muted-foreground'
                    }
                >
                    {mineDir === 'up' && <ArrowUpRight className="w-3 h-3 mr-1" aria-hidden="true" />}
                    {mineDir === 'down' && <ArrowDownRight className="w-3 h-3 mr-1" aria-hidden="true" />}
                    {mineDir !== 'flat' && (
                        <span className="sr-only">{t(mineDir === 'up' ? 'home.mktUp' : 'home.mktDown')} </span>
                    )}
                    {mine > 0 ? '+' : mine < 0 ? '-' : ''}{fmtMoney(Math.abs(mine))}
                    {portfolioToday?.percent !== undefined && ` (${fmtPercent(portfolioToday.percent, 2)})`}
                </Badge>
            </div>
        )}

        {data.summary && (
            <span className="text-xs text-muted-foreground hidden md:inline">
                {t('home.mktTurnoverShort', { amount: fmtMoneyCompact(data.summary.totalTurnover) })}
            </span>
        )}

        <Button onClick={onRefresh} variant="ghost" size="icon" className="ml-auto h-11 w-11 sm:h-8 sm:w-8" aria-label={t('common.refresh')}>
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
        </Button>
    </div>
    );
};

// Stat item component
const StatItem = ({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
}) => (
    <div className="text-center p-3 rounded-lg bg-muted/30">
        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            {icon}
            <span className="text-xs">{label}</span>
        </div>
        <p className="font-semibold">{value}</p>
    </div>
);

// Top movers card
const TopMoversCard = ({
    title,
    stocks,
    type,
}: {
    title: string;
    stocks: TopStock[];
    type: 'gainer' | 'loser';
}) => {
    const { t } = useT();
    return (
    <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
                {type === 'gainer' ? (
                    <TrendingUp className="w-4 h-4 text-green-700" />
                ) : (
                    <TrendingDown className="w-4 h-4 text-red-700" />
                )}
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-2">
                {stocks.length > 0 ? (
                    stocks.map((stock, idx) => (
                        <div
                            key={stock.symbol}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                                <div>
                                    <StockSymbolLink symbol={stock.symbol} className="font-medium" />
                                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                                        {stock.name}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-medium">{fmtMoney(stock.ltp, true)}</p>
                                <p className={`text-sm ${type === 'gainer' ? 'text-success' : 'text-destructive'}`}>
                                    {fmtPercent(stock.percentChange, 2)}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        {t('home.mktNoData')}
                    </p>
                )}
            </div>
        </CardContent>
    </Card>
    );
};

// Sub-index item
const SubIndexItem = ({
    index,
}: {
    index: { name: string; value: number; change: number; percentChange: number };
}) => (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
        <p className="text-xs text-muted-foreground truncate">{index.name}</p>
        <p className="font-semibold">{fmtIndex(index.value)}</p>
        <div className={`flex items-center gap-1 text-xs ${index.change >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
            {index.change >= 0 ? (
                <ArrowUpRight className="w-3 h-3" />
            ) : (
                <ArrowDownRight className="w-3 h-3" />
            )}
            <span>{fmtPercent(index.percentChange, 2)}</span>
        </div>
    </div>
);

// Loading skeleton
const MarketContextSkeleton = ({ compact }: { compact: boolean }) => {
    if (compact) {
        return (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-16" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-6">
                    <Skeleton className="h-8 w-40 mb-4" />
                    <Skeleton className="h-12 w-32 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                    <CardContent className="p-4">
                        <Skeleton className="h-6 w-24 mb-4" />
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full mb-2" />
                        ))}
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <Skeleton className="h-6 w-24 mb-4" />
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full mb-2" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// Export individual components for flexible use
export { CompactMarketWidget, TopMoversCard, SubIndexItem };
