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
        <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
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
    <div className="glass-card p-4 h-[400px] opacity-0 animate-fade-in" style={{ animationDelay: "800ms" }}>
      <h3 className="text-lg font-semibold mb-4">Individual Stock Performance</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 12%, 18%)" />
          <XAxis
            type="number"
            tickFormatter={(value) => `${value}%`}
            tick={{ fill: "hsl(150, 10%, 55%)", fontSize: 12 }}
            axisLine={{ stroke: "hsl(160, 12%, 18%)" }}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={45}
            tick={{ fill: "hsl(150, 10%, 55%)", fontSize: 11 }}
            axisLine={{ stroke: "hsl(160, 12%, 18%)" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(160, 12%, 15%)" }} />
          <ReferenceLine x={0} stroke="hsl(150, 10%, 55%)" strokeWidth={1} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={1500}>
            {sortedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isPositive ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
