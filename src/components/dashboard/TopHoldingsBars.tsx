import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, TooltipBox, axisLine, axisTick, fmtAxisCompact, makeSectorColorer, CHART } from "@/components/charts";
import type { StockHolding } from "@/data/portfolioData";
import { useT } from "@/i18n";
import { fmtMoney } from "@/i18n/format";

interface Props {
  holdings: StockHolding[];
  loading?: boolean;
  limit?: number;
}

export const TopHoldingsBars = ({ holdings, loading, limit = 8 }: Props) => {
  const { t } = useT();
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
      title={t("home.thbTitle")}
      subtitle={rows.length ? t("home.thbSubtitle", { percent: (topShare * 100).toFixed(0) }) : undefined}
      loading={loading}
      empty={rows.length === 0}
      emptyMessage={t("home.chartEmpty")}
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
                      { label: t("home.tipValue"), value: fmtMoney(payload[0].value as number) },
                      { label: t("home.tipShare"), value: `${(payload[0].payload.share * 100).toFixed(1)}%` },
                      { label: t("home.tipSector"), value: payload[0].payload.sector, color: color(payload[0].payload.sector) },
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
      <p className="mt-1 text-xs text-muted-foreground">{t("home.thbFooter", { total: fmtMoney(total) })}</p>
    </ChartCard>
  );
};
