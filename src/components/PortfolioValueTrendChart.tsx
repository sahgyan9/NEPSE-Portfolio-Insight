import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot,
    ReferenceLine,
    Legend,
} from "recharts";
import { PortfolioSummary } from "@/data/portfolioData";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
    getValueHistory,
    isServerRunning,
    ValueHistoryPoint,
    recordPortfolioValue,
    getTransactions,
    DBTransaction,
    TimePeriod,
    getValueHistoryStats,
    ValueHistoryStats,
} from "@/services/portfolioDb";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpCircle, ArrowDownCircle, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Get total dividend income from manual entries in localStorage
 */
const getTotalDividendIncome = (): number => {
    try {
        const savedRows = localStorage.getItem('manualDividendRows');
        if (savedRows) {
            const parsed = JSON.parse(savedRows);
            return parsed.reduce((sum: number, row: any) => sum + (row.cashIncome || 0), 0);
        }
    } catch (e) {
        console.warn('Failed to parse manual dividend data:', e);
    }
    return 0;
};

/**
 * Get dividend entries added on a specific date
 */
const getDividendsForDate = (dateStr: string): any[] => {
    try {
        const savedRows = localStorage.getItem('manualDividendRows');
        if (!savedRows) return [];

        const parsed = JSON.parse(savedRows);
        const targetDate = new Date(dateStr);
        const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

        return parsed.filter((row: any) => {
            if (!row.id) return false;
            // Extract timestamp from ID (format: SYMBOL-timestamp)
            const timestamp = parseInt(row.id.split('-')[1]);
            if (isNaN(timestamp)) return false;

            const entryDate = new Date(timestamp);
            const entryDateStr = entryDate.toISOString().split('T')[0];

            return entryDateStr === targetDateStr;
        });
    } catch (e) {
        console.warn('Failed to parse dividend data for date:', e);
        return [];
    }
};

interface PortfolioValueTrendChartProps {
    summary: PortfolioSummary;
}

interface TransactionMarker {
    date: string;
    type: "BUY" | "SELL";
    symbol: string;
    quantity: number;
    price: number;
    value?: number;
}

interface ChartDataPoint {
    date: string;
    displayDate: string;
    fullDate: string;
    value: number;
    invested: number;
    dividendIncome: number;
    totalWithDividends: number;
    transactions?: TransactionMarker[];
    hasBuy?: boolean;
    hasSell?: boolean;
}

const TIME_PERIODS: { label: string; value: TimePeriod; description: string }[] = [
    { label: "1D", value: "1d", description: "Last 24 hours" },
    { label: "1W", value: "1w", description: "Last 7 days" },
    { label: "1M", value: "1m", description: "Last 30 days" },
    { label: "3M", value: "3m", description: "Last 3 months" },
    { label: "6M", value: "6m", description: "Last 6 months" },
    { label: "1Y", value: "1y", description: "Last year" },
    { label: "ALL", value: "all", description: "All time" },
];

export const PortfolioValueTrendChart = ({ summary }: PortfolioValueTrendChartProps) => {
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [isDbConnected, setIsDbConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1m");
    const [stats, setStats] = useState<ValueHistoryStats | null>(null);
    const [transactions, setTransactions] = useState<DBTransaction[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const formatDateForPeriod = useCallback((dateStr: string, period: TimePeriod): { display: string; full: string } => {
        const date = new Date(dateStr);

        let display: string;
        switch (period) {
            case "1d":
                display = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                break;
            case "1w":
                display = date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
                break;
            case "1m":
                display = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                break;
            case "3m":
            case "6m":
                display = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                break;
            case "1y":
            case "all":
            default:
                display = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                break;
        }

        const full = date.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: period === "1d" ? "2-digit" : undefined,
            minute: period === "1d" ? "2-digit" : undefined,
        });

        return { display, full };
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const serverUp = await isServerRunning();
            setIsDbConnected(serverUp);

            if (serverUp) {
                const [history, txns, periodStats] = await Promise.all([
                    getValueHistory(selectedPeriod),
                    getTransactions(selectedPeriod).catch(() => [] as DBTransaction[]),
                    getValueHistoryStats(selectedPeriod).catch(() => null),
                ]);

                setStats(periodStats);
                setTransactions(txns);

                // Group transactions by date
                const transactionsByDate: Record<string, TransactionMarker[]> = {};
                txns.forEach((tx: DBTransaction) => {
                    const dateKey = tx.date.split(" ")[0]; // Extract just the date part
                    if (!transactionsByDate[dateKey]) {
                        transactionsByDate[dateKey] = [];
                    }
                    transactionsByDate[dateKey].push({
                        date: tx.date,
                        type: tx.type,
                        symbol: tx.symbol,
                        quantity: tx.quantity,
                        price: tx.price,
                    });
                });

                // Get total dividend income
                const totalDividendIncome = getTotalDividendIncome();

                // Convert database history to chart format
                const data = history
                    .filter((point: ValueHistoryPoint) => point.value > 0)
                    .map((point: ValueHistoryPoint) => {
                        const dateKey = point.date.split("T")[0];
                        const { display, full } = formatDateForPeriod(point.date, selectedPeriod);
                        const txs = transactionsByDate[dateKey];
                        const pointValue = Math.round(point.value);

                        return {
                            date: point.date,
                            displayDate: display,
                            fullDate: full,
                            value: pointValue,
                            invested: Math.round(point.invested),
                            dividendIncome: totalDividendIncome,
                            totalWithDividends: pointValue + totalDividendIncome,
                            transactions: txs,
                            hasBuy: txs?.some((t) => t.type === "BUY"),
                            hasSell: txs?.some((t) => t.type === "SELL"),
                        };
                    });

                // Update the last point with current actual values if it exists
                if (data.length > 0) {
                    const lastPoint = data[data.length - 1];
                    lastPoint.value = Math.round(summary.currentValue);
                    lastPoint.invested = Math.round(summary.totalInvested);
                    lastPoint.dividendIncome = totalDividendIncome;
                    lastPoint.totalWithDividends = Math.round(summary.currentValue) + totalDividendIncome;
                }

                setChartData(data);

                // Record today's value to the database
                await recordPortfolioValue(summary.currentValue).catch(() => {
                    // Silently fail if recording doesn't work
                });
            }
        } catch (error) {
            console.log("Database not connected, using simulated data");
            setIsDbConnected(false);
            generateSimulatedData();
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, summary.currentValue, summary.totalInvested, formatDateForPeriod]);

    const generateSimulatedData = useCallback(() => {
        const now = new Date();
        const data: ChartDataPoint[] = [];
        const baseValue = summary.totalInvested;
        let currentValue = baseValue * 0.9;

        let dataPoints: number;
        let intervalMs: number;

        switch (selectedPeriod) {
            case "1d":
                dataPoints = 24;
                intervalMs = 60 * 60 * 1000; // 1 hour
                break;
            case "1w":
                dataPoints = 7;
                intervalMs = 24 * 60 * 60 * 1000; // 1 day
                break;
            case "1m":
                dataPoints = 30;
                intervalMs = 24 * 60 * 60 * 1000;
                break;
            case "3m":
                dataPoints = 12;
                intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
                break;
            case "6m":
                dataPoints = 24;
                intervalMs = 7 * 24 * 60 * 60 * 1000;
                break;
            case "1y":
                dataPoints = 12;
                intervalMs = 30 * 24 * 60 * 60 * 1000; // 1 month
                break;
            default:
                dataPoints = 12;
                intervalMs = 30 * 24 * 60 * 60 * 1000;
        }

        for (let i = dataPoints - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - i * intervalMs);
            const growth = 1 + (Math.random() * 0.06 - 0.02);
            currentValue = currentValue * growth;

            if (i === 0) {
                currentValue = summary.currentValue;
            }

            const { display, full } = formatDateForPeriod(date.toISOString(), selectedPeriod);
            const totalDividendIncome = getTotalDividendIncome();
            const roundedValue = Math.round(currentValue);

            data.push({
                date: date.toISOString(),
                displayDate: display,
                fullDate: full,
                value: roundedValue,
                invested: Math.round(baseValue),
                dividendIncome: totalDividendIncome,
                totalWithDividends: roundedValue + totalDividendIncome,
            });
        }

        setChartData(data);
    }, [selectedPeriod, summary.currentValue, summary.totalInvested, formatDateForPeriod]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchData();
        setIsRefreshing(false);
    };

    const handlePeriodChange = (period: TimePeriod) => {
        setSelectedPeriod(period);
    };

    // Calculate period change dynamically from chartData so it includes the live current value
    const periodChange = chartData.length >= 2
        ? chartData[chartData.length - 1].value - chartData[0].value
        : 0;

    const periodChangePercent = chartData.length >= 2 && chartData[0].value > 0
        ? ((periodChange / chartData[0].value) * 100)
        : 0;

    const isPositiveChange = periodChange >= 0;

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0]?.payload as ChartDataPoint;
            const valueData = payload.find((p: any) => p.dataKey === "value");
            const investedData = payload.find((p: any) => p.dataKey === "invested");
            const dividendIncome = dataPoint?.dividendIncome || 0;
            const gainLoss = (valueData?.value || 0) - (investedData?.value || 0);
            const totalReturn = gainLoss + dividendIncome;
            const gainLossPercent = investedData?.value
                ? ((gainLoss / investedData.value) * 100).toFixed(2)
                : "0";
            const totalReturnPercent = investedData?.value
                ? ((totalReturn / investedData.value) * 100).toFixed(2)
                : "0";

            // Get dividends added on this date
            const dividendsOnDate = getDividendsForDate(dataPoint?.date || "");

            return (
                <div className="bg-card border border-border rounded-lg p-3 shadow-xl min-w-[250px]">
                    <p className="font-semibold text-foreground border-b border-border pb-2 mb-2">
                        {dataPoint?.fullDate}
                    </p>
                    <div className="space-y-1">
                        <p className="text-sm text-primary flex justify-between">
                            <span>Portfolio Value:</span>
                            <span className="font-medium">
                                Rs. {valueData?.value?.toLocaleString("en-NP")}
                            </span>
                        </p>
                        <p className="text-sm text-muted-foreground flex justify-between">
                            <span>Invested:</span>
                            <span>Rs. {investedData?.value?.toLocaleString("en-NP")}</span>
                        </p>
                        <p
                            className={cn(
                                "text-sm flex justify-between",
                                gainLoss >= 0 ? "text-green-500" : "text-red-500"
                            )}
                        >
                            <span>Capital Gain/Loss:</span>
                            <span className="font-medium">
                                {gainLoss >= 0 ? "+" : ""}Rs. {gainLoss.toLocaleString("en-NP")} (
                                {gainLossPercent}%)
                            </span>
                        </p>
                        {dividendIncome > 0 && (
                            <p className="text-sm text-purple-500 flex justify-between">
                                <span>Dividend Income:</span>
                                <span className="font-medium">
                                    +Rs. {dividendIncome.toLocaleString("en-NP")}
                                </span>
                            </p>
                        )}
                        {dividendIncome > 0 && (
                            <p
                                className={cn(
                                    "text-sm flex justify-between font-semibold border-t border-border pt-1 mt-1",
                                    totalReturn >= 0 ? "text-emerald-400" : "text-red-500"
                                )}
                            >
                                <span>Total Return:</span>
                                <span>
                                    {totalReturn >= 0 ? "+" : ""}Rs. {totalReturn.toLocaleString("en-NP")} (
                                    {totalReturnPercent}%)
                                </span>
                            </p>
                        )}
                    </div>

                    {dataPoint?.transactions && dataPoint.transactions.length > 0 && (
                        <div className="border-t border-border mt-2 pt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                                Transactions on this date:
                            </p>
                            <div className="max-h-[150px] overflow-y-auto">
                                {dataPoint.transactions.map((tx, idx) => (
                                    <p
                                        key={idx}
                                        className={cn(
                                            "text-xs flex items-center gap-1 py-0.5",
                                            tx.type === "BUY" ? "text-green-500" : "text-red-500"
                                        )}
                                    >
                                        {tx.type === "BUY" ? (
                                            <ArrowUpCircle className="w-3 h-3" />
                                        ) : (
                                            <ArrowDownCircle className="w-3 h-3" />
                                        )}
                                        <span className="font-medium">{tx.type}</span>
                                        <span>
                                            {tx.quantity} {tx.symbol} @ Rs. {tx.price.toLocaleString("en-NP")}
                                        </span>
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {dividendsOnDate.length > 0 && (
                        <div className="border-t border-border mt-2 pt-2">
                            <p className="text-xs font-medium text-purple-400 mb-1 flex items-center gap-1">
                                <Gift className="w-3 h-3" />
                                Dividends added on this date:
                            </p>
                            <div className="space-y-1">
                                {dividendsOnDate.map((div, idx) => (
                                    <div key={idx} className="text-xs text-muted-foreground">
                                        <p className="font-medium text-foreground">{div.symbol}</p>
                                        <div className="ml-2 space-y-0.5">
                                            {div.cashPercent > 0 && (
                                                <p className="text-green-400">
                                                    Cash: {div.cashPercent}% (Rs. {div.cashIncome.toLocaleString("en-NP")})
                                                </p>
                                            )}
                                            {div.bonusPercent > 0 && (
                                                <p className="text-amber-400">
                                                    Bonus: {div.bonusPercent}%
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    // Custom dot to show transaction markers
    const CustomDot = (props: any) => {
        const { cx, cy, payload } = props;

        if (!payload.hasBuy && !payload.hasSell) return null;

        const hasBoth = payload.hasBuy && payload.hasSell;
        const color = hasBoth
            ? "#eab308" // yellow for both
            : payload.hasBuy
                ? "#22c55e" // green for buy
                : "#ef4444"; // red for sell

        return (
            <g>
                <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
                />
                {hasBoth && (
                    <circle
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill="white"
                    />
                )}
            </g>
        );
    };

    return (
        <div
            className="glass-card p-4 h-[380px] opacity-0 animate-fade-in relative"
            style={{ animationDelay: "650ms", zIndex: 10 }}
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            Portfolio Value Trend
                            {isPositiveChange ? (
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            ) : (
                                <TrendingDown className="w-5 h-5 text-red-500" />
                            )}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                                {loading
                                    ? "Loading..."
                                    : isDbConnected
                                        ? "Live data from database"
                                        : "Simulated data"}
                            </span>
                            {isDbConnected && (
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-green-500">Connected</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Period stats */}
                <div className="flex items-center gap-4">
                    {/* Dividend Income Badge */}
                    {getTotalDividendIncome() > 0 && (
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Gift className="w-3 h-3 text-purple-500" />
                                Dividend Income
                            </p>
                            <p className="text-sm font-semibold text-purple-500">
                                +Rs. {getTotalDividendIncome().toLocaleString("en-NP")}
                            </p>
                        </div>
                    )}
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                            {TIME_PERIODS.find((p) => p.value === selectedPeriod)?.description} change
                        </p>
                        <p
                            className={cn(
                                "text-sm font-semibold",
                                isPositiveChange ? "text-green-500" : "text-red-500"
                            )}
                        >
                            {isPositiveChange ? "+" : ""}Rs. {Math.abs(periodChange).toLocaleString("en-NP")}{" "}
                            ({isPositiveChange ? "+" : ""}
                            {periodChangePercent.toFixed(2)}%)
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-8 w-8"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Time period selector */}
            <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
                {TIME_PERIODS.map((period) => (
                    <Button
                        key={period.value}
                        variant={selectedPeriod === period.value ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handlePeriodChange(period.value)}
                        className={cn(
                            "h-7 px-3 text-xs font-medium transition-all",
                            selectedPeriod === period.value
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                        )}
                    >
                        {period.label}
                    </Button>
                ))}

                {/* Legend */}
                <div className="ml-auto flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-primary" />
                        <span className="text-muted-foreground">Value</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-muted-foreground/50" style={{ borderStyle: "dashed" }} />
                        <span className="text-muted-foreground">Invested</span>
                    </div>
                    {transactions.length > 0 && (
                        <>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-muted-foreground">Buy</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-muted-foreground">Sell</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Chart */}
            <div className="relative" style={{ height: '70%', overflow: 'visible' }}>
                <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="valueTrendGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor={isPositiveChange ? "hsl(158, 64%, 52%)" : "hsl(0, 84%, 60%)"}
                                    stopOpacity={0.4}
                                />
                                <stop
                                    offset="95%"
                                    stopColor={isPositiveChange ? "hsl(158, 64%, 52%)" : "hsl(0, 84%, 60%)"}
                                    stopOpacity={0}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 12%, 18%)" />
                        <XAxis
                            dataKey="displayDate"
                            tick={{ fill: "hsl(150, 10%, 55%)", fontSize: 11 }}
                            axisLine={{ stroke: "hsl(160, 12%, 18%)" }}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tickFormatter={(value) =>
                                value >= 1000000
                                    ? `${(value / 1000000).toFixed(1)}M`
                                    : value >= 1000
                                        ? `${(value / 1000).toFixed(0)}K`
                                        : value.toString()
                            }
                            tick={{ fill: "hsl(150, 10%, 55%)", fontSize: 11 }}
                            axisLine={{ stroke: "hsl(160, 12%, 18%)" }}
                            tickLine={false}
                            width={50}
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            wrapperStyle={{ zIndex: 50 }}
                        />

                        {/* Invested amount line (dashed) */}
                        <Area
                            type="monotone"
                            dataKey="invested"
                            stroke="hsl(150, 10%, 35%)"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            fill="none"
                        />

                        {/* Portfolio value area */}
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={isPositiveChange ? "hsl(158, 64%, 52%)" : "hsl(0, 84%, 60%)"}
                            strokeWidth={2}
                            fill="url(#valueTrendGradient)"
                            dot={<CustomDot />}
                            activeDot={{
                                r: 6,
                                stroke: isPositiveChange ? "hsl(158, 64%, 52%)" : "hsl(0, 84%, 60%)",
                                strokeWidth: 2,
                                fill: "hsl(var(--card))",
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Transaction summary */}
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                {transactions.length > 0 && (
                    <span>
                        {transactions.filter((t) => t.type === "BUY").length} buys,{" "}
                        {transactions.filter((t) => t.type === "SELL").length} sells in this period
                    </span>
                )}
            </div>
        </div>
    );
};
