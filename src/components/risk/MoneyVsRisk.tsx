import { useMemo, useState } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, CHART, TooltipBox, axisLine, axisTick, fmtFrac, legendStyle } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { sectorLabel } from "@/lib/findingText";
import type { RiskData } from "@/services/riskApi";
import { topRiskSentence, type RiskGrouping as Mode } from "./riskText";

export const MoneyVsRisk = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("sector");

  const rows = useMemo(() => {
    if (!risk) return [];
    const base =
      mode === "sector"
        ? risk.sectors.map((s) => ({ name: sectorLabel(s.sector), weight: s.weight, riskShare: s.riskShare }))
        : risk.holdings.map((h) => ({ name: h.symbol, weight: h.weight, riskShare: h.riskShare }));
    return base.sort((a, b) => b.riskShare - a.riskShare).slice(0, mode === "holding" ? 14 : 12);
  }, [risk, mode]);

  // Flag rows where risk share is clearly larger than the share of money.
  const heavy = rows.filter((r) => r.riskShare - r.weight >= 0.03 && r.riskShare >= r.weight * 1.2);
  const summary = topRiskSentence(risk, mode, t);
  const subtitle = [
    summary,
    heavy.length ? t(heavy.length === 1 ? "risk.mvrHeavyOne" : "risk.mvrHeavyMany", { names: heavy.map((h) => h.name).join(", ") }) : t("risk.mvrHowTo"),
  ]
    .filter(Boolean)
    .join(" ");
  const money = t("risk.shareOfMoney");
  const riskLabel = t("risk.shareOfRisk");

  return (
    <ChartCard
      title={t("risk.mvrTitle")}
      subtitle={subtitle}
      explain="riskShare"
      loading={loading}
      empty={rows.length === 0}
      emptyMessage={t("risk.chartEmpty")}
      height={280}
      actions={
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label={t("risk.groupBy")}>
          {(["sector", "holding"] as Mode[]).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "ghost"}
              className="h-10 px-3 text-sm sm:h-7 sm:text-xs"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
            >
              {m === "sector" ? t("risk.bySector") : t("risk.byHolding")}
            </Button>
          ))}
        </div>
      }
    >
      <div id="money-vs-risk-chart" style={{ height: Math.max(240, rows.length * 44 + 50) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barGap={2} barCategoryGap={10}>
            <XAxis type="number" tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="name" width={mode === "sector" ? 104 : 62} tick={{ ...axisTick, fill: CHART.text }} axisLine={false} tickLine={false} interval={0} />
            <Tooltip
              cursor={{ fill: "hsl(var(--chart-cursor))" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={payload[0].payload.name}
                    rows={[
                      { label: money, value: fmtFrac(payload[0].payload.weight), color: CHART.accentSoft },
                      { label: riskLabel, value: fmtFrac(payload[0].payload.riskShare), color: CHART.accent },
                    ]}
                  />
                ) : null
              }
            />
            <Legend wrapperStyle={legendStyle} iconType="square" />
            <Bar dataKey="weight" name={money} fill={CHART.accentSoft} radius={[0, 3, 3, 0]} isAnimationActive={false} />
            <Bar dataKey="riskShare" name={riskLabel} fill={CHART.accent} radius={[0, 3, 3, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
