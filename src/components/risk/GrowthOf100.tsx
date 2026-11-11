import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, CHART, TooltipBox, axisLine, axisTick, fmtDateLong, fmtDateShort, gridProps, legendStyle } from "@/components/charts";
import type { RiskData } from "@/services/riskApi";

const MARGIN = { top: 6, right: 12, left: 0, bottom: 0 };
const Y_WIDTH = 48;

export const GrowthOf100 = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
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

  return (
    <ChartCard
      title="How would today's holdings have grown, and how deep were the falls?"
      subtitle={
        last
          ? `100 rupees became about ${last.portfolio.toFixed(0)} in this mix and ${last.market.toFixed(0)} in the market index`
          : undefined
      }
      explain="growthOf100"
      loading={loading}
      empty={data.length < 2}
      height={380}
      footer="A what-if built from past prices of the holdings you own today. It is not your actual record and ignores dividends and fees."
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
                      title={fmtDateLong(String(label))}
                      rows={payload.map((p) => ({
                        label: p.name === "portfolio" ? "Today's mix" : "Market index",
                        value: (p.value as number).toFixed(1),
                        color: String(p.color),
                      }))}
                    />
                  ) : null
                }
              />
              <Legend wrapperStyle={legendStyle} iconType="plainline" formatter={(v) => (v === "portfolio" ? "Today's mix" : "Market index")} />
              <Line type="monotone" dataKey="portfolio" stroke={CHART.accent} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="market" stroke={CHART.market} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mb-1 ml-12 text-xs font-medium text-muted-foreground">Fall from the previous high (%)</p>
        <div className="h-[110px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} syncId="growth" margin={MARGIN}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={40} tickFormatter={fmtDateShort} />
              <YAxis width={Y_WIDTH} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={["auto", 0]} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={fmtDateLong(String(label))}
                      rows={[{ label: "Below previous high", value: `${(payload[0].value as number).toFixed(1)}%`, color: CHART.loss }]}
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
