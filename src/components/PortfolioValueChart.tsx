import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PortfolioSummary } from "@/data/portfolioData";
import { useEffect, useState } from "react";
import { getValueHistory, isServerRunning, ValueHistoryPoint, recordPortfolioValue, getTransactions, DBTransaction } from "@/services/portfolioDb";

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

export const PortfolioValueChart = ({ summary }: PortfolioValueChartProps) => {
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
            getTransactions().catch(() => [] as DBTransaction[])
          ]);

          // Group transactions by date
          const transactionsByDate: Record<string, TransactionSummary> = {};
          transactions.forEach((tx: DBTransaction) => {
            const dateKey = tx.date.split(' ')[0]; // Extract just the date part
            if (!transactionsByDate[dateKey]) {
              transactionsByDate[dateKey] = { buys: [], sells: [] };
            }
            const txInfo = { symbol: tx.symbol, quantity: tx.quantity, price: tx.price };
            if (tx.type === 'BUY') {
              transactionsByDate[dateKey].buys.push(txInfo);
            } else {
              transactionsByDate[dateKey].sells.push(txInfo);
            }
          });

          // Aggregate history by date - keep only the last entry for each date
          // and filter out entries with value = 0
          const historyByDate: Record<string, ValueHistoryPoint> = {};
          history.forEach((point: ValueHistoryPoint) => {
            if (point.value > 0) {
              historyByDate[point.date] = point;
            }
          });

          // Convert to array and sort by date
          const aggregatedHistory = Object.values(historyByDate)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Convert database history to chart format
          const chartData = aggregatedHistory.map((point: ValueHistoryPoint) => {
            const date = new Date(point.date);
            const displayDate = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric"
            });
            return {
              month: displayDate,
              value: Math.round(point.value),
              invested: Math.round(point.invested),
              fullDate: point.date,
              displayDate: date.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric"
              }),
              transactions: transactionsByDate[point.date],
            };
          });

          // Update the last point with current actual values
          if (chartData.length > 0) {
            const lastPoint = chartData[chartData.length - 1];
            lastPoint.value = Math.round(summary.currentValue);
            lastPoint.invested = Math.round(summary.totalInvested);
          }

          setDbData(chartData);

          // Record today's value to the database
          await recordPortfolioValue(summary.currentValue).catch(() => {
            // Silently fail if recording doesn't work
          });
        }
      } catch (error) {
        console.log("Database not connected, using simulated data");
        setIsDbConnected(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [summary.currentValue, summary.totalInvested]);

  // Fallback: Simulated historical data for visualization
  const generateHistoricalData = (): ChartDataPoint[] => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
    const baseValue = summary.totalInvested;
    let currentValue = baseValue * 0.85;

    return months.map((month, index) => {
      // Simulate gradual growth with some volatility
      const growth = 1 + (Math.random() * 0.08 - 0.02);
      currentValue = currentValue * growth;

      // Last month should match actual current value
      if (index === months.length - 1) {
        currentValue = summary.currentValue;
      }

      return {
        month,
        value: Math.round(currentValue),
        invested: baseValue,
      };
    });
  };

  const data = isDbConnected && dbData.length > 0 ? dbData : generateHistoricalData();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Find the correct values by dataKey
      const valueData = payload.find((p: any) => p.dataKey === "value");
      const investedData = payload.find((p: any) => p.dataKey === "invested");
      const dataPoint = payload[0]?.payload as ChartDataPoint;
      const transactions = dataPoint?.transactions;
      const gainLoss = (valueData?.value || 0) - (investedData?.value || 0);
      const gainLossPercent = investedData?.value ? ((gainLoss / investedData.value) * 100).toFixed(2) : "0";

      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-xl min-w-[200px]">
          <p className="font-semibold text-foreground border-b border-border pb-2 mb-2">
            {dataPoint?.displayDate || label}
          </p>
          <div className="space-y-1">
            <p className="text-sm text-primary flex justify-between">
              <span>Current Value:</span>
              <span className="font-medium">Rs. {valueData?.value?.toLocaleString("en-NP")}</span>
            </p>
            <p className="text-sm text-muted-foreground flex justify-between">
              <span>Invested:</span>
              <span>Rs. {investedData?.value?.toLocaleString("en-NP")}</span>
            </p>
            <p className={`text-sm flex justify-between ${gainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <span>Gain/Loss:</span>
              <span className="font-medium">
                {gainLoss >= 0 ? '+' : ''}Rs. {gainLoss.toLocaleString("en-NP")} ({gainLossPercent}%)
              </span>
            </p>
          </div>

          {transactions && (transactions.buys.length > 0 || transactions.sells.length > 0) && (
            <div className="border-t border-border mt-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Transactions:</p>
              {transactions.buys.length > 0 && (
                <div className="mb-1">
                  {transactions.buys.map((tx, idx) => (
                    <p key={`buy-${idx}`} className="text-xs text-green-500 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Bought {tx.quantity} {tx.symbol} @ Rs. {tx.price.toLocaleString("en-NP")}
                    </p>
                  ))}
                </div>
              )}
              {transactions.sells.length > 0 && (
                <div>
                  {transactions.sells.map((tx, idx) => (
                    <p key={`sell-${idx}`} className="text-xs text-red-500 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Sold {tx.quantity} {tx.symbol} @ Rs. {tx.price.toLocaleString("en-NP")}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-4 h-[300px] opacity-0 animate-fade-in" style={{ animationDelay: "650ms" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Portfolio Value Trend</h3>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading..." : isDbConnected ? "Historical data from database" : "Simulated historical performance"}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {isDbConnected && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-500 text-[10px]">DB Connected</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary" />
            <span className="text-muted-foreground">Current Value</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted-foreground/30" />
            <span className="text-muted-foreground">Invested</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(158, 64%, 52%)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(158, 64%, 52%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 12%, 18%)" />
          <XAxis
            dataKey="month"
            tick={{ fill: "hsl(150, 10%, 55%)", fontSize: 12 }}
            axisLine={{ stroke: "hsl(160, 12%, 18%)" }}
          />
          <YAxis
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            tick={{ fill: "hsl(150, 10%, 55%)", fontSize: 12 }}
            axisLine={{ stroke: "hsl(160, 12%, 18%)" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="invested"
            stroke="hsl(150, 10%, 35%)"
            strokeWidth={1}
            strokeDasharray="5 5"
            fill="none"
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(158, 64%, 52%)"
            strokeWidth={2}
            fill="url(#valueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
