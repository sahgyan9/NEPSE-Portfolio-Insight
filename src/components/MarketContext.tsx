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

interface MarketContextDisplayProps {
    compact?: boolean;
}

export const MarketContextDisplay = ({ compact = false }: MarketContextDisplayProps) => {
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
            setError('Failed to fetch market data');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Refresh every 5 minutes
        const interval = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (isLoading) {
        return <MarketContextSkeleton compact={compact} />;
    }

    if (error) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button onClick={fetchData} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!marketData) return null;

    if (compact) {
        return <CompactMarketWidget data={marketData} onRefresh={fetchData} />;
    }

    return (
        <div className="space-y-4">
            {/* Main Index Card */}
            <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-5 h-5 text-primary" />
                                <span className="text-sm font-medium text-muted-foreground">NEPSE Index</span>
                            </div>
                            {marketData.nepseIndex ? (
                                <>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-4xl font-bold">
                                            {marketData.nepseIndex.index.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </span>
                                        <div className={`flex items-center gap-1 ${marketData.nepseIndex.change >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                            {marketData.nepseIndex.change >= 0 ? (
                                                <ArrowUpRight className="w-5 h-5" />
                                            ) : (
                                                <ArrowDownRight className="w-5 h-5" />
                                            )}
                                            <span className="text-lg font-semibold">
                                                {marketData.nepseIndex.change >= 0 ? '+' : ''}
                                                {marketData.nepseIndex.change.toFixed(2)}
                                            </span>
                                            <span className="text-sm">
                                                ({marketData.nepseIndex.percentChange >= 0 ? '+' : ''}
                                                {marketData.nepseIndex.percentChange.toFixed(2)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                                        <span>High: {marketData.nepseIndex.high.toLocaleString()}</span>
                                        <span>Low: {marketData.nepseIndex.low.toLocaleString()}</span>
                                        <span>Prev: {marketData.nepseIndex.previousClose.toLocaleString()}</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-muted-foreground">Index data unavailable</p>
                            )}
                        </div>

                        <div className="text-right">
                            <Button onClick={fetchData} variant="ghost" size="sm" className="mb-2">
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Refresh
                            </Button>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {marketData.lastUpdated.toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Market Summary */}
                {marketData.summary && (
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatItem
                                label="Total Turnover"
                                value={`Rs. ${(marketData.summary.totalTurnover / 10000000).toFixed(2)} Cr`}
                                icon={<BarChart3 className="w-4 h-4" />}
                            />
                            <StatItem
                                label="Traded Shares"
                                value={marketData.summary.totalTradedShares.toLocaleString()}
                                icon={<Activity className="w-4 h-4" />}
                            />
                            <StatItem
                                label="Transactions"
                                value={marketData.summary.totalTransactions.toLocaleString()}
                                icon={<TrendingUp className="w-4 h-4" />}
                            />
                            <StatItem
                                label="Scrips Traded"
                                value={marketData.summary.totalScripsTrades.toString()}
                                icon={<Building2 className="w-4 h-4" />}
                            />
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Top Gainers & Losers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TopMoversCard
                    title="Top Gainers"
                    stocks={marketData.topGainers}
                    type="gainer"
                />
                <TopMoversCard
                    title="Top Losers"
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
                            Sector Indices
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
}: {
    data: MarketContext;
    onRefresh: () => void;
}) => (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">NEPSE</span>
        </div>

        {data.nepseIndex && (
            <>
                <span className="text-lg font-bold">
                    {data.nepseIndex.index.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <Badge
                    variant="outline"
                    className={data.nepseIndex.change >= 0
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : 'bg-red-500/10 text-red-600 border-red-500/20'
                    }
                >
                    {data.nepseIndex.change >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                    ) : (
                        <ArrowDownRight className="w-3 h-3 mr-1" />
                    )}
                    {data.nepseIndex.change >= 0 ? '+' : ''}
                    {data.nepseIndex.change.toFixed(2)} ({data.nepseIndex.percentChange >= 0 ? '+' : ''}{data.nepseIndex.percentChange.toFixed(2)}%)
                </Badge>
            </>
        )}

        {data.summary && (
            <span className="text-xs text-muted-foreground hidden md:inline">
                Turnover: Rs. {(data.summary.totalTurnover / 10000000).toFixed(1)} Cr
            </span>
        )}

        <Button onClick={onRefresh} variant="ghost" size="icon" className="ml-auto h-8 w-8">
            <RefreshCw className="w-3 h-3" />
        </Button>
    </div>
);

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
}) => (
    <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
                {type === 'gainer' ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
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
                                <p className="font-medium">Rs. {stock.ltp.toLocaleString()}</p>
                                <p className={`text-sm ${type === 'gainer' ? 'text-green-500' : 'text-red-500'}`}>
                                    {stock.percentChange >= 0 ? '+' : ''}
                                    {stock.percentChange.toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No data available
                    </p>
                )}
            </div>
        </CardContent>
    </Card>
);

// Sub-index item
const SubIndexItem = ({
    index,
}: {
    index: { name: string; value: number; change: number; percentChange: number };
}) => (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
        <p className="text-xs text-muted-foreground truncate">{index.name}</p>
        <p className="font-semibold">{index.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        <div className={`flex items-center gap-1 text-xs ${index.change >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
            {index.change >= 0 ? (
                <ArrowUpRight className="w-3 h-3" />
            ) : (
                <ArrowDownRight className="w-3 h-3" />
            )}
            <span>{index.change >= 0 ? '+' : ''}{index.percentChange.toFixed(2)}%</span>
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
            <div className="grid grid-cols-2 gap-4">
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
