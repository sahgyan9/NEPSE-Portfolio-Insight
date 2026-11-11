import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, TooltipBox, axisLine, axisTick, fmtAxisCompact, fmtRs, makeSectorColorer, CHART } from "@/components/charts";
import type { StockHolding } from "@/data/portfolioData";

interface Props {
  holdings: StockHolding[];
  loading?: boolean;
  limit?: number;
}

export const TopHoldingsBars = ({ holdings, loading, limit = 8 }: Props) => {
  const { rows, total } = useMemo(() => {
    const total = holdings.reduce((s, h) => s + h.currentValue, 0);
    const rows = [...holdings]
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, limit)
      .map((h) => ({ name: h.scrip, value: h.currentValue, sector: h.sector, share: total ? h.currentValue / total : 0 }));
    return { rows, total };
  }, [holdings, limit]);
  const color = useMemo(() => makeSectorColorer(holdings.map((h) => h.sector)), [holdings]);
  const topShare = rows.slice(0, 3).reduce((s, r) => s + r.share, 0);

  return (
    <ChartCard
      title="Which stocks matter most?"
      subtitle={rows.length ? `The top 3 make up ${(topShare * 100).toFixed(0)}% of the portfolio` : undefined}
      loading={loading}
      empty={rows.length === 0}
      height={260}
    >
      <div style={{ height: Math.max(180, rows.length * 30 + 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
            <XAxis type="number" tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={fmtAxisCompact} />
            <YAxis type="category" dataKey="name" width={62} tick={{ ...axisTick, fill: CHART.text }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--chart-cursor))" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={payload[0].payload.name}
                    rows={[
                      { label: "Value", value: fmtRs(payload[0].value as number) },
                      { label: "Share", value: `${(payload[0].payload.share * 100).toFixed(1)}%` },
                      { label: "Sector", value: payload[0].payload.sector, color: color(payload[0].payload.sector) },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.name} fill={color(r.sector)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Bar colour matches the sector colours in the chart beside it. Total {fmtRs(total)}.</p>
    </ChartCard>
  );
};
