import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard, TooltipBox, makeSectorColorer } from "@/components/charts";
import { useT } from "@/i18n";
import { fmtMoney, fmtMoneyCompact } from "@/i18n/format";

interface SectorData {
  name: string;
  value: number;
}

interface SectorAllocationChartProps {
  data: SectorData[];
  loading?: boolean;
}

export const SectorAllocationChart = ({ data, loading }: SectorAllocationChartProps) => {
  const { t } = useT();
  const rows = useMemo(() => [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value), [data]);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const color = useMemo(() => makeSectorColorer(rows.map((r) => r.name)), [rows]);
  const top = rows[0];

  return (
    <ChartCard
      title={t("home.sacTitle")}
      subtitle={top ? t("home.sacSubtitle", { sector: top.name, percent: ((top.value / total) * 100).toFixed(0) }) : undefined}
      explain="weight"
      loading={loading}
      empty={rows.length === 0}
      emptyMessage={t("home.chartEmpty")}
      height={260}
    >
      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative mx-auto h-[180px] w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={1} stroke="hsl(var(--card))" strokeWidth={2} isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell key={r.name} fill={color(r.name)} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={payload[0].name}
                      rows={[
                        { label: t("home.tipValue"), value: fmtMoney(payload[0].value as number), color: payload[0].payload.fill },
                        { label: t("home.tipShare"), value: `${(((payload[0].value as number) / total) * 100).toFixed(1)}%` },
                      ]}
                    />
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">{t("home.sacTotal")}</span>
            <span className="font-mono text-sm font-semibold">{fmtMoneyCompact(total)}</span>
          </div>
        </div>
        <ul className="min-w-0 space-y-1.5">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(r.name) }} />
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="font-mono text-muted-foreground">{((r.value / total) * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
};
