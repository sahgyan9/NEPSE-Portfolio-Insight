import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PortfolioSummary } from "@/data/portfolioData";
import { useEffect, useState } from "react";
import { getValueHistory, isServerRunning, ValueHistoryPoint, recordPortfolioValue, getTransactions, DBTransaction } from "@/services/portfolioDb";
import { useT } from "@/i18n";
import { bsMonthName, fmtDate, fmtMoney, fmtNumber, fmtPercent, toBS } from "@/i18n/format";
import { fmtAxisCompact } from "@/components/charts";

interface PortfolioValueChartProps {
  summary: PortfolioSummary;
}

interface TransactionSummary {
  buys: { symbol: string; quantity: number; price: number }[];
  sells: { symbol: string; quantity: number; price: number }[];
}

interface ChartDataPoint {
  month: string;
  value: number;
  invested: number;
  fullDate?: string;
  displayDate?: string;
  transactions?: TransactionSummary;
}

/** Older value chart (the home page uses PortfolioValueTrendChart). Draws only recorded history, never simulated data. */
export const PortfolioValueChart = ({ summary }: PortfolioValueChartProps) => {
  const { t } = useT();
  const [dbData, setDbData] = useState<ChartDataPoint[]>([]);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const serverUp = await isServerRunning();
        setIsDbConnected(serverUp);

        if (serverUp) {
          const [history, transactions] = await Promise.all([
            getValueHistory(),
            getTransactions().catch(() => [] as DBTransaction[]),
          ]);

          // Group transactions by date
          const transactionsByDate: Record<string, TransactionSummary> = {};
          transactions.forEach((tx: DBTransaction) => {
            const dateKey = tx.date.split(" ")[0];
            if (!transactionsByDate[dateKey]) {
              transactionsByDate[dateKey] = { buys: [], sells: [] };
            }
            const txInfo = { symbol: tx.symbol, quantity: tx.quantity, price: tx.price };
            if (tx.type === "BUY") {
              transactionsByDate[dateKey].buys.push(txInfo);
            } else {
              transactionsByDate[dateKey].sells.push(txInfo);
            }
          });

          // Keep only the last entry for each date and drop zero values
          const historyByDate: Record<string, ValueHistoryPoint> = {};
          history.forEach((point: ValueHistoryPoint) => {
            if (point.value > 0) {
              historyByDate[point.date] = point;
            }
          });

          const aggregatedHistory = Object.values(historyByDate).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          const chartData = aggregatedHistory.map((point: ValueHistoryPoint) => {
            const bs = toBS(point.date);
            return {
              month: bs ? `${bs.day} ${bsMonthName(bs.month)}` : point.date,
              value: Math.round(point.value),
              invested: Math.round(point.invested),
              fullDate: point.date,
              displayDate: fmtDate(point.date),
              transactions: transactionsByDate[point.date],
            };
          });

          // Update the last point with current actual values
          if (chartData.length > 0 && summary.currentValue > 0) {
            const lastPoint = chartData[chartData.length - 1];
            lastPoint.value = Math.round(summary.currentValue);
            lastPoint.invested = Math.round(summary.totalInvested);
          }

          setDbData(chartData);

          if (summary.currentValue > 0) {
            await recordPortfolioValue(summary.currentValue).catch(() => {
              // Recording is best-effort
            });
          }
        }
      } catch (error) {
        setIsDbConnected(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [summary.currentValue, summary.totalInvested]);

  const data = isDbConnected ? dbData : [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const valueData = payload.find((p: any) => p.dataKey === "value");
      const investedData = payload.find((p: any) => p.dataKey === "invested");
      const dataPoint = payload[0]?.payload as ChartDataPoint;
      const transactions = dataPoint?.transactions;
      const gainLoss = (valueData?.value || 0) - (investedData?.value || 0);
      const gainLossPercent = investedData?.value ? fmtPercent((gainLoss / investedData.value) * 100, 2) : "0%";

      return (
        <div className="w-[220px] max-w-[80vw] rounded-lg border border-border bg-card p-3 shadow-sm">
          <p className="mb-2 border-b border-border pb-2 font-semibold text-foreground">{dataPoint?.displayDate || label}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-2 text-sm text-primary">
              <span>{t("home.tipPortfolioValue")}</span>
              <span className="font-medium">{fmtMoney(valueData?.value)}</span>
            </p>
            <p className="flex justify-between gap-2 text-sm text-muted-foreground">
              <span>{t("home.tipInvested")}</span>
              <span>{fmtMoney(investedData?.value)}</span>
            </p>
            <p className={`flex justify-between gap-2 text-sm ${gainLoss >= 0 ? "text-success" : "text-destructive"}`}>
              <span>{t("home.tipGainLoss")}</span>
              <span className="text-right font-medium">
                {gainLoss > 0 ? "+" : gainLoss < 0 ? "-" : ""}
                {fmtMoney(Math.abs(gainLoss))} ({gainLossPercent})
              </span>
            </p>
          </div>

          {transactions && (transactions.buys.length > 0 || transactions.sells.length > 0) && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("home.tipTransactions")}</p>
              {transactions.buys.map((tx, idx) => (
                <p key={`buy-${idx}`} className="flex items-center gap-1 text-xs text-success">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-success"></span>
                  {t("home.txBought")}: {t("home.txLine", { qty: fmtNumber(tx.quantity), symbol: tx.symbol, price: fmtMoney(tx.price, true) })}
                </p>
              ))}
              {transactions.sells.map((tx, idx) => (
                <p key={`sell-${idx}`} className="flex items-center gap-1 text-xs text-destructive">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive"></span>
                  {t("home.txSold")}: {t("home.txLine", { qty: fmtNumber(tx.quantity), symbol: tx.symbol, price: fmtMoney(tx.price, true) })}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="surface p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold sm:text-lg">{t("home.pvtTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {loading ? t("common.loading") : isDbConnected ? t("home.pvtConnected") : t("home.pvtNoDb")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-primary" />
            <span className="text-muted-foreground">{t("home.legendValue")}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-muted-foreground/30" />
            <span className="text-muted-foreground">{t("home.legendInvested")}</span>
          </div>
        </div>
      </div>
      <div className="relative h-[220px] sm:h-[240px]">
        {!loading && data.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm leading-relaxed text-muted-foreground">
            {isDbConnected ? t("home.pvtEmpty") : t("home.pvtEmptyNoDb")}
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-accent))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--chart-accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(var(--chart-axis))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--chart-grid))" }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={fmtAxisCompact}
              tick={{ fill: "hsl(var(--chart-axis))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--chart-grid))" }}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="invested" name={t("home.legendInvested")} stroke="hsl(var(--chart-axis))" strokeWidth={1} strokeDasharray="5 5" fill="none" />
            <Area type="monotone" dataKey="value" name={t("home.legendValue")} stroke="hsl(var(--chart-accent))" strokeWidth={2} fill="url(#valueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
