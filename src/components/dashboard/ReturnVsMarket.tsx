import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { ChartCard, CHART, TooltipBox, axisTick, axisLine, fmtFracSigned } from "@/components/charts";
import { Explain } from "@/components/Explain";
import type { RiskData } from "@/services/riskApi";
import { useT } from "@/i18n";

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
  const { t } = useT();
  const x = performance?.xirr;
  const b = performance?.benchmarkXirr;
  const ready = x !== null && x !== undefined && b !== null && b !== undefined;
  const data = ready
    ? [
        { name: t("home.rvmMine"), value: x as number, color: CHART.accent },
        { name: t("home.rvmIndex"), value: b as number, color: CHART.market },
      ]
    : [];
  const diff = ready ? (x as number) - (b as number) : 0;

  // The method note: built from its template in the current language; the server's English
  // text is the fallback for older reports or an unknown code.
  const noteKey = performance?.noteCode ? `home.rvmNote_${performance.noteCode}` : null;
  const noteFromKey = noteKey ? t(noteKey, performance?.noteParams) : null;
  const note = noteFromKey && noteFromKey !== noteKey && !/\{\w+\}/.test(noteFromKey) ? noteFromKey : performance?.note;

  return (
    <ChartCard
      title={t("home.rvmTitle")}
      subtitle={t("home.rvmSubtitle")}
      explain="xirr"
      loading={loading}
      empty={!ready}
      emptyMessage={t("home.rvmEmpty")}
      height={200}
      footer={
        note ? (
          <span className="flex items-start gap-1.5">
            <Explain term="benchmarkXirr" />
            <span>{note}</span>
          </span>
        ) : undefined
      }
    >
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }} barCategoryGap={14}>
            <XAxis type="number" domain={[(min: number) => Math.min(0, min) - 0.08, (max: number) => Math.max(0, max) + 0.08]} tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="name" width={112} tick={{ ...axisTick, fill: CHART.text }} axisLine={false} tickLine={false} />
            <ReferenceLine x={0} stroke={CHART.axis} />
            <Tooltip
              cursor={{ fill: "hsl(var(--chart-cursor))" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={payload[0].payload.name}
                    rows={[{ label: t("home.rvmPerYear"), value: fmtFracSigned(payload[0].value as number) }]}
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
        <p className="mt-1 text-sm leading-relaxed">
          {t(diff >= 0 ? "home.rvmAhead" : "home.rvmBehind", { points: Math.abs(diff * 100).toFixed(1) })}
        </p>
      )}
    </ChartCard>
  );
};
