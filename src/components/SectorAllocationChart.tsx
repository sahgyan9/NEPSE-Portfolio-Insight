import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SectorData {
  name: string;
  value: number;
}

interface SectorAllocationChartProps {
  data: SectorData[];
}

const COLORS = [
  "hsl(158, 64%, 52%)", // Primary green
  "hsl(45, 93%, 58%)",  // Accent gold
  "hsl(200, 70%, 50%)", // Blue
  "hsl(280, 60%, 55%)", // Purple
  "hsl(340, 65%, 50%)", // Pink
  "hsl(142, 71%, 45%)", // Success green
  "hsl(30, 80%, 55%)",  // Orange
  "hsl(190, 70%, 45%)", // Teal
];

export const SectorAllocationChart = ({ data }: SectorAllocationChartProps) => {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / totalValue) * 100).toFixed(1);
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-foreground">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            Rs. {item.value.toLocaleString("en-NP", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm font-mono text-primary">{percentage}%</p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="hsl(160, 20%, 95%)"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="glass-card p-4 h-[400px] opacity-0 animate-fade-in" style={{ animationDelay: "700ms" }}>
      <h3 className="text-lg font-semibold mb-4">Sector Allocation</h3>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            innerRadius={50}
            fill="#8884d8"
            dataKey="value"
            animationBegin={0}
            animationDuration={1000}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
