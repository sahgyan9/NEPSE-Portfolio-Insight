import { useMemo, useState } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, CHART, TooltipBox, axisLine, axisTick, fmtFrac, legendStyle } from "@/components/charts";
import { Button } from "@/components/ui/button";
import type { RiskData } from "@/services/riskApi";

type Mode = "sector" | "holding";

export const MoneyVsRisk = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
  const [mode, setMode] = useState<Mode>("sector");

  const rows = useMemo(() => {
    if (!risk) return [];
    const base =
      mode === "sector"
        ? risk.sectors.map((s) => ({ name: s.sector, weight: s.weight, riskShare: s.riskShare }))
        : risk.holdings.map((h) => ({ name: h.symbol, weight: h.weight, riskShare: h.riskShare }));
    return base.sort((a, b) => b.riskShare - a.riskShare).slice(0, mode === "holding" ? 14 : 12);
  }, [risk, mode]);

  // Flag rows where risk share is clearly larger than the share of money.
  const heavy = rows.filter((r) => r.riskShare - r.weight >= 0.03 && r.riskShare >= r.weight * 1.2);

  return (
    <ChartCard
      title="Where is my risk out of proportion to my money?"
      subtitle={
        heavy.length
          ? `${heavy.map((h) => h.name).join(", ")} ${heavy.length === 1 ? "carries" : "carry"} more risk than ${heavy.length === 1 ? "its" : "their"} share of money`
          : "Each pair compares the share of money with the share of risk. Equal bars mean risk matches size."
      }
      explain="riskShare"
      loading={loading}
      empty={rows.length === 0}
      height={280}
      actions={
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Group by">
          {(["sector", "holding"] as Mode[]).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "ghost"}
              className="h-7 px-3 text-xs"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
            >
              {m === "sector" ? "Sectors" : "Holdings"}
            </Button>
          ))}
        </div>
      }
    >
      <div id="money-vs-risk-chart" style={{ height: Math.max(240, rows.length * 44 + 50) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barGap={2} barCategoryGap={10}>
            <XAxis type="number" tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="name" width={mode === "sector" ? 112 : 62} tick={{ ...axisTick, fill: CHART.text }} axisLine={false} tickLine={false} interval={0} />
            <Tooltip
              cursor={{ fill: "hsl(var(--chart-cursor))" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={payload[0].payload.name}
                    rows={[
                      { label: "Share of money", value: fmtFrac(payload[0].payload.weight), color: CHART.accentSoft },
                      { label: "Share of risk", value: fmtFrac(payload[0].payload.riskShare), color: CHART.accent },
                    ]}
                  />
                ) : null
              }
            />
            <Legend wrapperStyle={legendStyle} iconType="square" />
            <Bar dataKey="weight" name="Share of money" fill={CHART.accentSoft} radius={[0, 3, 3, 0]} isAnimationActive={false} />
            <Bar dataKey="riskShare" name="Share of risk" fill={CHART.accent} radius={[0, 3, 3, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
