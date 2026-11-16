import { useMemo } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartCard, CHART, TooltipBox, axisLine, axisTick, fmtFrac, fmtFracSigned, makeSectorColorer } from "@/components/charts";
import { useT } from "@/i18n";
import { sectorLabel } from "@/lib/findingText";
import type { RiskData } from "@/services/riskApi";

interface Point {
  symbol: string;
  sector: string;
  x: number;
  y: number;
  w: number;
  measured: boolean;
  color: string;
}

/** Custom dot: filled when measured, hollow when estimated; label the bigger holdings. */
const Dot = (props: { cx?: number; cy?: number; payload?: Point; size?: number }) => {
  const { cx, cy, payload, size } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const r = Math.max(4, Math.sqrt((size ?? 80) / Math.PI));
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={payload.measured ? payload.color : "hsl(var(--card))"}
        fillOpacity={payload.measured ? 0.8 : 1}
        stroke={payload.color}
        strokeWidth={payload.measured ? 1 : 2}
        strokeDasharray={payload.measured ? undefined : "3 2"}
      />
      {payload.w >= 0.04 && (
        <text x={cx} y={cy - r - 3} textAnchor="middle" fontSize={10} fill={CHART.text}>
          {payload.symbol}
        </text>
      )}
    </g>
  );
};

export const RiskReturnScatter = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
  const { t } = useT();
  const { points, hidden, sectors, color } = useMemo(() => {
    const color = makeSectorColorer((risk?.holdings ?? []).map((h) => h.sector));
    const pts: Point[] = [];
    let hidden = 0;
    (risk?.holdings ?? []).forEach((h) => {
      if (h.volatility === null || h.return1y === null || h.volatility === undefined || h.return1y === undefined) {
        hidden += 1;
        return;
      }
      pts.push({ symbol: h.symbol, sector: h.sector, x: h.volatility, y: h.return1y, w: h.weight, measured: h.measured, color: color(h.sector) });
    });
    const sectors = Array.from(new Set(pts.map((p) => p.sector))).sort();
    return { points: pts, hidden, sectors, color };
  }, [risk]);

  // Plain summary: how many holdings gained over the year, and which gained most for its swing.
  const summary = (() => {
    if (points.length === 0) return undefined;
    const up = points.filter((p) => p.y > 0).length;
    const best = [...points].sort((a, b) => b.y / Math.max(b.x, 0.01) - a.y / Math.max(a.x, 0.01))[0];
    const first = t("risk.scatterSummary", { up, total: points.length });
    return best && best.y > 0 ? `${first} ${t("risk.scatterBest", { symbol: best.symbol })}` : first;
  })();
  return (
    <ChartCard
      title={t("risk.scatterTitle")}
      subtitle={summary ? `${summary} ${t("risk.scatterHowTo")}` : t("risk.scatterHowTo")}
      explainText={t("risk.scatterExplain")}
      loading={loading}
      empty={points.length === 0}
      emptyMessage={t("risk.chartEmpty")}
      height={360}
      footer={
        <>
          {hidden > 0 && `${t("risk.scatterHidden", { count: hidden })} `}
          {t("risk.scatterFooter")}
        </>
      }
    >
      <div id="scatter-chart" className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 20, left: 0, bottom: 24 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="Volatility" tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} label={{ value: t("risk.scatterXAxis"), position: "insideBottom", offset: -14, fontSize: 11, fill: CHART.axis }} />
            <YAxis type="number" dataKey="y" name="Return" width={52} tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} label={{ value: t("risk.scatterYAxis"), angle: -90, position: "insideLeft", fontSize: 11, fill: CHART.axis }} />
            <ZAxis type="number" dataKey="w" range={[70, 700]} />
            <ReferenceLine y={0} stroke={CHART.axis} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Point | undefined;
                return active && p ? (
                  <TooltipBox
                    title={p.measured ? p.symbol : `${p.symbol} (${t("risk.estimated")})`}
                    rows={[
                      { label: t("risk.colSector"), value: sectorLabel(p.sector), color: p.color },
                      { label: t("risk.colVolatility"), value: fmtFrac(p.x) },
                      { label: t("risk.colReturn1y"), value: fmtFracSigned(p.y) },
                      { label: t("risk.shareOfMoney"), value: fmtFrac(p.w) },
                    ]}
                  />
                ) : null;
              }}
            />
            <Scatter data={points} shape={<Dot />} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {sectors.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color(s) }} />
            {sectorLabel(s)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed" style={{ borderColor: CHART.market }} />
          {t("risk.estimated")}
        </li>
      </ul>
    </ChartCard>
  );
};
