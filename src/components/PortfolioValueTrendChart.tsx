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
import { useT } from "@/i18n";
import { fmtDate, fmtDayMonth, fmtMonthYear, fmtMoney, fmtNumber, fmtPercent } from "@/i18n/format";
import { fmtAxisCompact } from "@/components/charts";

const timeOf = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const signedMoney = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmtMoney(Math.abs(v))}`;

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
    /** False while live prices are still loading. A partly priced portfolio must not be drawn or saved as today's value. */
    ready?: boolean;
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

/** Label and description keys live in the "home" namespace: home.period_<value> and home.periodLong_<value>. */
const TIME_PERIODS: TimePeriod[] = ["1d", "1w", "1m", "3m", "6m", "1y", "all"];

export const PortfolioValueTrendChart = ({ summary, ready = true }: PortfolioValueTrendChartProps) => {
    const { t } = useT();
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [isDbConnected, setIsDbConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1m");
    const [stats, setStats] = useState<ValueHistoryStats | null>(null);
    const [transactions, setTransactions] = useState<DBTransaction[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const formatDateForPeriod = useCallback((dateStr: string, period: TimePeriod): { display: string; full: string } => {
        // Dates in the chosen system (BS or AD), Latin digits.
        const date = new Date(dateStr);

        let display: string;
        switch (period) {
            case "1d":
                display = timeOf(date);
                break;
            case "1w":
            case "1m":
            case "3m":
            case "6m":
                display = fmtDayMonth(date);
                break;
            case "1y":
            case "all":
            default:
                display = fmtMonthYear(date);
                break;
        }

        const full = period === "1d" ? `${fmtDate(date)}, ${timeOf(date)}` : fmtDate(date);

        return { display, full };
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const serverUp = await isServerRunning();
            setIsDbConnected(serverUp);
            if (!serverUp) setChartData([]);

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
                // Live prices arrive after the history does; until then currentValue is 0
                // and must not be drawn (or recorded) as a 100% loss.
                const hasLiveValue = ready && summary.currentValue > 0;
                if (data.length > 0 && hasLiveValue) {
                    const lastPoint = data[data.length - 1];
                    lastPoint.value = Math.round(summary.currentValue);
                    lastPoint.invested = Math.round(summary.totalInvested);
                    lastPoint.dividendIncome = totalDividendIncome;
                    lastPoint.totalWithDividends = Math.round(summary.currentValue) + totalDividendIncome;
                }

                setChartData(data);

                // Record today's value to the database
                if (hasLiveValue) {
                    await recordPortfolioValue(summary.currentValue).catch(() => {
                        // Silently fail if recording doesn't work
                    });
                }
            }
        } catch (error) {
            // No invented history: an unreachable database shows an empty chart with a clear message.
            setIsDbConnected(false);
            setChartData([]);
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, summary.currentValue, summary.totalInvested, formatDateForPeriod, ready]);

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
            const gainLossPercent = investedData?.value ? fmtPercent((gainLoss / investedData.value) * 100, 2) : "0%";
            const totalReturnPercent = investedData?.value ? fmtPercent((totalReturn / investedData.value) * 100, 2) : "0%";

            // Get dividends added on this date
            const dividendsOnDate = getDividendsForDate(dataPoint?.date || "");

            return (
                <div className="bg-card border border-border rounded-lg p-3 shadow-sm w-[240px] max-w-[80vw]">
                    <p className="font-semibold text-foreground border-b border-border pb-2 mb-2">
                        {dataPoint?.fullDate}
                    </p>
                    <div className="space-y-1">
                        <p className="text-sm text-primary flex justify-between gap-2">
                            <span>{t("home.tipPortfolioValue")}</span>
                            <span className="font-medium">{fmtMoney(valueData?.value)}</span>
                        </p>
                        <p className="text-sm text-muted-foreground flex justify-between gap-2">
                            <span>{t("home.tipInvested")}</span>
                            <span>{fmtMoney(investedData?.value)}</span>
                        </p>
                        <p
                            className={cn(
                                "text-sm flex justify-between gap-2",
                                gainLoss >= 0 ? "text-success" : "text-destructive"
                            )}
                        >
                            <span>{t("home.tipGainLoss")}</span>
                            <span className="font-medium text-right">
                                {signedMoney(gainLoss)} ({gainLossPercent})
                            </span>
                        </p>
                        {dividendIncome > 0 && (
                            <p className="text-sm text-primary flex justify-between gap-2">
                                <span>{t("home.tipDividendIncome")}</span>
                                <span className="font-medium">+{fmtMoney(dividendIncome)}</span>
                            </p>
                        )}
                        {dividendIncome > 0 && (
                            <p
                                className={cn(
                                    "text-sm flex justify-between gap-2 font-semibold border-t border-border pt-1 mt-1",
                                    totalReturn >= 0 ? "text-success" : "text-destructive"
                                )}
                            >
                                <span>{t("home.tipTotalReturn")}</span>
                                <span className="text-right">
                                    {signedMoney(totalReturn)} ({totalReturnPercent})
                                </span>
                            </p>
                        )}
                    </div>

                    {dataPoint?.transactions && dataPoint.transactions.length > 0 && (
                        <div className="border-t border-border mt-2 pt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-warning"></span>
                                {t("home.tipTransactions")}
                            </p>
                            <div className="max-h-[150px] overflow-y-auto">
                                {dataPoint.transactions.map((tx, idx) => (
                                    <p
                                        key={idx}
                                        className={cn(
                                            "text-xs flex items-center gap-1 py-0.5",
                                            tx.type === "BUY" ? "text-success" : "text-destructive"
                                        )}
                                    >
                                        {tx.type === "BUY" ? (
                                            <ArrowUpCircle className="w-3 h-3" aria-hidden="true" />
                                        ) : (
                                            <ArrowDownCircle className="w-3 h-3" aria-hidden="true" />
                                        )}
                                        <span className="font-medium">{t(tx.type === "BUY" ? "home.txBought" : "home.txSold")}</span>
                                        <span>
                                            {t("home.txLine", { qty: fmtNumber(tx.quantity), symbol: tx.symbol, price: fmtMoney(tx.price, true) })}
                                        </span>
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {dividendsOnDate.length > 0 && (
                        <div className="border-t border-border mt-2 pt-2">
                            <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                                <Gift className="w-3 h-3" aria-hidden="true" />
                                {t("home.tipDividendsAdded")}
                            </p>
                            <div className="space-y-1">
                                {dividendsOnDate.map((div, idx) => (
                                    <div key={idx} className="text-xs text-muted-foreground">
                                        <p className="font-medium text-foreground">{div.symbol}</p>
                                        <div className="ml-2 space-y-0.5">
                                            {div.cashPercent > 0 && (
                                                <p className="text-success">
                                                    {t("home.tipCash", { percent: div.cashPercent, amount: fmtMoney(div.cashIncome) })}
                                                </p>
                                            )}
                                            {div.bonusPercent > 0 && (
                                                <p className="text-warning">
                                                    {t("home.tipBonus", { percent: div.bonusPercent })}
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
            ? "hsl(var(--status-3))" // yellow for both
            : payload.hasBuy
                ? "hsl(var(--status-1))" // green for buy
                : "hsl(var(--status-5))"; // red for sell

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


    const dividendTotal = getTotalDividendIncome();
    const buyCount = transactions.filter((tx) => tx.type === "BUY").length;
    const sellCount = transactions.filter((tx) => tx.type === "SELL").length;
    const lineColor = isPositiveChange ? "hsl(var(--chart-accent))" : "hsl(var(--status-5))";

    return (
        <div className="surface relative p-4">
            {/* Header */}
            <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                        {t("home.pvtTitle")}
                        {isPositiveChange ? (
                            <TrendingUp className="h-5 w-5 text-success" aria-hidden="true" />
                        ) : (
                            <TrendingDown className="h-5 w-5 text-destructive" aria-hidden="true" />
                        )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {loading
                            ? t("common.loading")
                            : isDbConnected
                                ? t("home.pvtConnected")
                                : t("home.pvtNoDb")}
                    </p>
                </div>

                {/* Period stats */}
                <div className="flex items-center gap-4">
                    {dividendTotal > 0 && (
                        <div className="hidden text-right sm:block">
                            <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                                <Gift className="h-3 w-3 text-primary" aria-hidden="true" />
                                {t("home.tipDividendIncome")}
                            </p>
                            <p className="text-sm font-semibold text-primary">+{fmtMoney(dividendTotal)}</p>
                        </div>
                    )}
                    <div className="sm:text-right">
                        <p className="text-xs text-muted-foreground">
                            {t("home.pvtChangeLabel", { period: t(`home.periodLong_${selectedPeriod}`) })}
                        </p>
                        <p className={cn("text-sm font-semibold", isPositiveChange ? "text-success" : "text-destructive")}>
                            {signedMoney(periodChange)} ({fmtPercent(periodChangePercent, 2)})
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="ml-auto h-11 w-11 sm:ml-0 sm:h-8 sm:w-8"
                        aria-label={t("common.refresh")}
                    >
                        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
                    </Button>
                </div>
            </div>

            {/* One-sentence summary so the chart is not needed to get the point */}
            {!loading && chartData.length >= 2 && (
                <p className="mb-3 text-sm leading-relaxed">
                    {t(periodChange > 0 ? "home.pvtSummaryUp" : periodChange < 0 ? "home.pvtSummaryDown" : "home.pvtSummaryFlat", {
                        period: t(`home.periodLong_${selectedPeriod}`),
                        amount: fmtMoney(Math.abs(periodChange)),
                        percent: fmtPercent(Math.abs(periodChangePercent), 1, false),
                    })}
                </p>
            )}

            {/* Time period selector */}
            <div className="mb-2 flex items-center gap-1 overflow-x-auto pb-1" role="group" aria-label={t("home.pvtPeriodAria")}>
                {TIME_PERIODS.map((period) => (
                    <Button
                        key={period}
                        variant={selectedPeriod === period ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handlePeriodChange(period)}
                        aria-pressed={selectedPeriod === period}
                        title={t(`home.periodLong_${period}`)}
                        className={cn(
                            "h-9 shrink-0 px-3 text-xs font-medium",
                            selectedPeriod === period ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                    >
                        {t(`home.period_${period}`)}
                    </Button>
                ))}
            </div>

            {/* Legend */}
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded bg-primary" />
                    <span className="text-muted-foreground">{t("home.legendValue")}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="h-0.5 w-3 bg-muted-foreground/50" style={{ borderStyle: "dashed" }} />
                    <span className="text-muted-foreground">{t("home.legendInvested")}</span>
                </div>
                {transactions.length > 0 && (
                    <>
                        <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-success" />
                            <span className="text-muted-foreground">{t("home.legendBought")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-destructive" />
                            <span className="text-muted-foreground">{t("home.legendSold")}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Chart */}
            <div className="relative h-[220px] sm:h-[260px]" style={{ overflow: "visible" }}>
                {!loading && chartData.length === 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm leading-relaxed text-muted-foreground">
                        {isDbConnected ? t("home.pvtEmpty") : t("home.pvtEmptyNoDb")}
                    </div>
                )}
                <ResponsiveContainer width="100%" height="100%" style={{ overflow: "visible" }}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="valueTrendGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={lineColor} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                        <XAxis
                            dataKey="displayDate"
                            tick={{ fill: "hsl(var(--chart-axis))", fontSize: 11 }}
                            axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={24}
                        />
                        <YAxis
                            tickFormatter={fmtAxisCompact}
                            tick={{ fill: "hsl(var(--chart-axis))", fontSize: 11 }}
                            axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                            tickLine={false}
                            width={44}
                        />
                        <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 50 }} />

                        {/* Invested amount line (dashed) */}
                        <Area
                            type="monotone"
                            dataKey="invested"
                            name={t("home.legendInvested")}
                            stroke="hsl(var(--chart-axis))"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            fill="none"
                        />

                        {/* Portfolio value area */}
                        <Area
                            type="monotone"
                            dataKey="value"
                            name={t("home.legendValue")}
                            stroke={lineColor}
                            strokeWidth={2}
                            fill="url(#valueTrendGradient)"
                            dot={<CustomDot />}
                            activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2, fill: "hsl(var(--card))" }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Transaction summary */}
            {transactions.length > 0 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                    {t("home.pvtTxSummary", { bought: buyCount, sold: sellCount })}
                </p>
            )}
        </div>
    );
};
