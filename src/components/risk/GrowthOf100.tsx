import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, CHART, TooltipBox, axisLine, axisTick, gridProps, legendStyle } from "@/components/charts";
import { fmtDate, fmtMoney, fmtMonthYear } from "@/i18n/format";
import { useT } from "@/i18n";
import type { RiskData } from "@/services/riskApi";

const MARGIN = { top: 6, right: 12, left: 0, bottom: 0 };
const Y_WIDTH = 48;

export const GrowthOf100 = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
  const { t } = useT();
  const data = useMemo(
    () =>
      (risk?.history ?? []).map((h) => ({
        date: h.date,
        portfolio: h.portfolio,
        market: h.market,
        drawdown: h.drawdown * 100,
      })),
    [risk]
  );
  const last = data[data.length - 1];
  const deepest = data.reduce<(typeof data)[number] | null>((w, d) => (!w || d.drawdown < w.drawdown ? d : w), null);
  const mixLabel = t("risk.growthMix");
  const marketLabel = t("risk.growthMarket");

  const subtitle = last
    ? [
        t("risk.growthSummary", { start: fmtMoney(100), mix: fmtMoney(last.portfolio), market: fmtMoney(last.market) }),
        deepest && deepest.drawdown < 0
          ? t("risk.growthDeepest", { pct: Math.abs(deepest.drawdown).toFixed(1), date: fmtMonthYear(deepest.date) })
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : undefined;

  return (
    <ChartCard
      title={t("risk.growthTitle")}
      subtitle={subtitle}
      explain="growthOf100"
      loading={loading}
      empty={data.length < 2}
      emptyMessage={t("risk.chartEmpty")}
      height={380}
      footer={t("risk.growthFooter")}
    >
      <div id="growth-chart">
        <div className="h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} syncId="growth" margin={MARGIN}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tick={false} axisLine={axisLine} tickLine={false} height={4} />
              <YAxis width={Y_WIDTH} tick={axisTick} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toFixed(0)} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={fmtDate(String(label))}
                      rows={payload.map((p) => ({
                        label: p.name === "portfolio" ? mixLabel : marketLabel,
                        value: (p.value as number).toFixed(1),
                        color: String(p.color),
                      }))}
                    />
                  ) : null
                }
              />
              <Legend wrapperStyle={legendStyle} iconType="plainline" formatter={(v) => (v === "portfolio" ? mixLabel : marketLabel)} />
              <Line type="monotone" dataKey="portfolio" stroke={CHART.accent} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="market" stroke={CHART.market} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mb-1 ml-12 text-xs font-medium text-muted-foreground">{t("risk.growthFallAxis")}</p>
        <div className="h-[110px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} syncId="growth" margin={MARGIN}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={48} tickFormatter={(v) => fmtMonthYear(String(v))} />
              <YAxis width={Y_WIDTH} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={["auto", 0]} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={fmtDate(String(label))}
                      rows={[{ label: t("risk.growthBelowHigh"), value: `${(payload[0].value as number).toFixed(1)}%`, color: CHART.loss }]}
                    />
                  ) : null
                }
              />
              <Area type="monotone" dataKey="drawdown" stroke={CHART.loss} fill={CHART.loss} fillOpacity={0.18} strokeWidth={1.5} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
};
