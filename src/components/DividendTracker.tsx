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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { StockHolding } from '@/data/portfolioData';
import { calculateDividendProjections } from '@/lib/valuationScoring';
import { Coins, Calendar, TrendingUp, Gift, Info, PiggyBank } from 'lucide-react';
import { StockSymbolLink } from '@/components/StockSymbolLink';

interface DividendTrackerProps {
    holdings: StockHolding[];
}

export const DividendTracker = ({ holdings }: DividendTrackerProps) => {
    const dividendData = useMemo(() => calculateDividendProjections(holdings), [holdings]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NP', {
            style: 'currency',
            currency: 'NPR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const getConfidenceColor = (confidence: string) => {
        switch (confidence) {
            case 'high': return '#22c55e';
            case 'medium': return '#eab308';
            case 'low': return '#f97316';
            default: return '#6b7280';
        }
    };

    const getConfidenceLabel = (confidence: string) => {
        switch (confidence) {
            case 'high': return '🟢 High';
            case 'medium': return '🟡 Medium';
            case 'low': return '🟠 Low';
            default: return '⚪ Unknown';
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Coins className="w-5 h-5 text-primary" />
                            Dividend Tracker
                        </CardTitle>
                        <CardDescription>
                            Expected dividend income from your portfolio
                        </CardDescription>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-4 h-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p className="text-sm">
                                    Projections are based on historical dividend patterns.
                                    Actual dividends depend on company performance and board decisions.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>

            <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Total Expected Cash */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <PiggyBank className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-medium text-muted-foreground">Expected Cash</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(dividendData.totalExpectedCashDividend)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Annual estimate</p>
                    </div>

                    {/* Bonus Value */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Gift className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-medium text-muted-foreground">Bonus Value</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {formatCurrency(dividendData.totalExpectedBonusValue)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">In bonus shares</p>
                    </div>

                    {/* Portfolio Yield */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-medium text-muted-foreground">Portfolio Yield</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {dividendData.portfolioDividendYield.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Current value basis</p>
                    </div>

                    {/* Yield on Cost */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-medium text-muted-foreground">Yield on Cost</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                            {dividendData.yieldOnCost.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Based on purchase price</p>
                    </div>
                </div>

                {/* Dividend Projections Table */}
                <div className="mt-6">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Expected Dividends by Stock
                    </h4>

                    <div className="space-y-3">
                        {dividendData.upcomingDividends.length > 0 ? (
                            dividendData.upcomingDividends.map((dividend) => (
                                <DividendProjectionRow key={dividend.symbol} dividend={dividend} />
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No dividend-paying stocks in portfolio
                            </p>
                        )}
                    </div>
                </div>

                {/* Educational Note */}
                <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
                    <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        📚 Understanding Dividends in Nepal
                    </h5>
                    <div className="space-y-2 text-xs text-muted-foreground">
                        <p>
                            <strong>Cash Dividend:</strong> Direct cash payment per share. A 20% cash dividend means Rs. 20 per Rs. 100 face value share.
                        </p>
                        <p>
                            <strong>Bonus Shares:</strong> Free additional shares. A 10% bonus means 1 free share for every 10 shares held.
                        </p>
                        <p>
                            <strong>Book Close Date:</strong> You must own shares before this date to receive dividends.
                        </p>
                        <p>
                            <strong>Typical Timeline:</strong> AGMs usually happen July-October. Dividends announced at AGM, distributed within ~3 months.
                        </p>
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
    const getConfidenceColor = (confidence: string) => {
        switch (confidence) {
            case 'high': return 'bg-green-500/10 text-green-600 border-green-500/20';
            case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
            case 'low': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
            default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
        }
    };

    return (
        <div className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <StockSymbolLink symbol={dividend.symbol} className="font-bold" />
                        <Badge variant="outline" className="text-xs">
                            {dividend.quantity} units
                        </Badge>
                        <Badge className={`text-xs ${getConfidenceColor(dividend.confidence)}`}>
                            {dividend.confidence} confidence
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {dividend.name}
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        Rs. {dividend.expectedCashAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {dividend.expectedMonth && `Expected: ${dividend.expectedMonth}`}
                    </p>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-4 pt-3 border-t">
                <div>
                    <span className="text-xs text-muted-foreground">Yield</span>
                    <p className="font-medium">{dividend.expectedDividendPercent.toFixed(1)}%</p>
                </div>
                <div>
                    <span className="text-xs text-muted-foreground">Cash Dividend</span>
                    <p className="font-medium">Rs. {dividend.expectedCashAmount.toFixed(0)}</p>
                </div>
                <div>
                    <span className="text-xs text-muted-foreground">Bonus Shares</span>
                    <p className="font-medium">{dividend.expectedBonusShares} shares</p>
                </div>
            </div>

            {/* Visual yield bar */}
            <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Yield Strength</span>
                    <span className="font-medium">{dividend.expectedDividendPercent.toFixed(1)}%</span>
                </div>
                <Progress
                    value={Math.min(dividend.expectedDividendPercent * 10, 100)}
                    className="h-1.5"
                />
            </div>
        </div>
    );
};

// Compact version for dashboard
export const DividendSummaryCard = ({ holdings }: DividendTrackerProps) => {
    const dividendData = useMemo(() => calculateDividendProjections(holdings), [holdings]);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Coins className="w-4 h-4 text-green-500" />
                    Dividend Income
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    Rs. {dividendData.totalExpectedCashDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    Expected annual dividend
                </p>
                <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Portfolio Yield</span>
                    <span className="font-medium">{dividendData.portfolioDividendYield.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Yield on Cost</span>
                    <span className="font-medium text-amber-600">{dividendData.yieldOnCost.toFixed(2)}%</span>
                </div>
            </CardContent>
        </Card>
    );
};
