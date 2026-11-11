import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { StockHolding } from "@/data/portfolioData";

interface PerformanceChartProps {
  holdings: StockHolding[];
}

export const PerformanceChart = ({ holdings }: PerformanceChartProps) => {
  const sortedData = [...holdings]
    .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
    .map((h) => ({
      name: h.scrip,
      value: h.gainLossPercent,
      isPositive: h.gainLossPercent >= 0,
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const holding = holdings.find((h) => h.scrip === label);
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
          <p className="font-semibold text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">{holding?.fullName}</p>
          <p
            className={`text-sm font-mono font-medium ${
              payload[0].value >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {payload[0].value >= 0 ? "+" : ""}
            {payload[0].value.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="surface p-4 h-[400px] ">
      <h3 className="text-lg font-semibold mb-4">Individual Stock Performance</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
          <XAxis
            type="number"
            tickFormatter={(value) => `${value}%`}
            tick={{ fill: "hsl(var(--chart-axis))", fontSize: 12 }}
            axisLine={{ stroke: "hsl(var(--chart-grid))" }}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={45}
            tick={{ fill: "hsl(var(--chart-axis))", fontSize: 11 }}
            axisLine={{ stroke: "hsl(var(--chart-grid))" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--chart-cursor))" }} />
          <ReferenceLine x={0} stroke="hsl(var(--chart-axis))" strokeWidth={1} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={1500}>
            {sortedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isPositive ? "hsl(var(--status-1))" : "hsl(var(--status-5))"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
