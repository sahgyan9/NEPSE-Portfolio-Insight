import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { ChartCard, CHART, TooltipBox, axisTick, axisLine, fmtFracSigned } from "@/components/charts";
import { Explain } from "@/components/Explain";
import type { RiskData } from "@/services/riskApi";

/** Value label placed just beyond the end of the bar, on the correct side for negatives. */
const BarValueLabel = (props: { x?: number; y?: number; width?: number; height?: number; value?: number }) => {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props;
  const neg = value < 0;
  return (
    <text
      x={neg ? x - 6 : x + width + 6}
      y={y + height / 2}
      dominantBaseline="central"
      textAnchor={neg ? "end" : "start"}
      style={{ fontSize: 12, fill: CHART.text, fontFamily: "JetBrains Mono, monospace" }}
    >
      {fmtFracSigned(value)}
    </text>
  );
};

interface Props {
  performance?: RiskData["performance"];
  loading?: boolean;
}

/** Two bars: your money-weighted yearly return against the same deposits in the market index. */
export const ReturnVsMarket = ({ performance, loading }: Props) => {
  const x = performance?.xirr;
  const b = performance?.benchmarkXirr;
  const ready = x !== null && x !== undefined && b !== null && b !== undefined;
  const data = ready
    ? [
        { name: "Your purchases", value: x as number, color: CHART.accent },
        { name: "Same money in the index", value: b as number, color: CHART.market },
      ]
    : [];
  const diff = ready ? (x as number) - (b as number) : 0;

  return (
    <ChartCard
      title="Did my buying beat just holding the market?"
      subtitle="Yearly return on the money you put in, allowing for when you bought"
      explain="xirr"
      loading={loading}
      empty={!ready}
      emptyMessage="Not enough purchase history to compare yet."
      height={200}
      footer={
        performance?.note ? (
          <span className="flex items-start gap-1.5">
            <Explain term="benchmarkXirr" />
            <span>{performance.note}</span>
          </span>
        ) : undefined
      }
    >
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }} barCategoryGap={14}>
            <XAxis type="number" domain={[(min: number) => Math.min(0, min) - 0.08, (max: number) => Math.max(0, max) + 0.08]} tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="name" width={130} tick={{ ...axisTick, fill: CHART.text }} axisLine={false} tickLine={false} />
            <ReferenceLine x={0} stroke={CHART.axis} />
            <Tooltip
              cursor={{ fill: "hsl(var(--chart-cursor))" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={payload[0].payload.name}
                    rows={[{ label: "Per year", value: fmtFracSigned(payload[0].value as number) }]}
                  />
                ) : null
              }
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
              <LabelList dataKey="value" content={BarValueLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {ready && (
        <p className="mt-1 text-sm">
          {diff >= 0 ? "Ahead of" : "Behind"} the index by{" "}
          <span className="font-mono font-semibold">{Math.abs(diff * 100).toFixed(1)} points</span> a year over this period.
        </p>
      )}
    </ChartCard>
  );
};
