import { useMemo, useState } from "react";
import { ChartCard, correlationColor } from "@/components/charts";
import { useT } from "@/i18n";
import type { RiskData } from "@/services/riskApi";
import { topPairs } from "./riskText";

const CELL = 24;
const LABEL_W = 64;

export const CorrelationHeatmap = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
  const { t } = useT();
  const [hover, setHover] = useState<{ a: string; b: string; v: number } | null>(null);
  const symbols = useMemo(() => risk?.correlation.symbols ?? [], [risk]);
  const matrix = useMemo(() => risk?.correlation.matrix ?? [], [risk]);
  const n = symbols.length;
  const showValues = n <= 12;
  const pairs = useMemo(() => topPairs(symbols, matrix, 3), [symbols, matrix]);
  const avg = risk?.portfolio.averageCorrelation;

  const summary =
    pairs.length > 0
      ? t(pairs[0].v >= 0.6 ? "risk.corrSummaryHigh" : "risk.corrSummaryLow", {
          a: pairs[0].a,
          b: pairs[0].b,
          v: pairs[0].v.toFixed(2),
        })
      : t("risk.corrHowTo");

  return (
    <ChartCard
      title={t("risk.corrTitle")}
      subtitle={summary}
      explain="correlation"
      loading={loading}
      empty={n < 2}
      emptyMessage={t("risk.chartEmpty")}
      height={320}
    >
      <div id="correlation-chart" className="min-w-0">
        {pairs.length > 0 && (
          <div className="mb-3 text-sm">
            <p className="font-medium">{t("risk.corrTopPairs")}</p>
            <ol className="mt-1 space-y-1">
              {pairs.map((p) => (
                <li key={`${p.a}-${p.b}`} className="flex items-baseline justify-between gap-3 border-b border-border py-1 last:border-0">
                  <span className="min-w-0 font-medium">
                    {p.a} <span className="font-normal text-muted-foreground">{t("risk.and")}</span> {p.b}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {p.v.toFixed(2)} ({t(p.v >= 0.75 ? "risk.corrStrong" : p.v >= 0.5 ? "risk.corrModerate" : "risk.corrWeak")})
                  </span>
                </li>
              ))}
            </ol>
            {typeof avg === "number" && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("risk.corrAverage", { v: avg.toFixed(2) })}</p>
            )}
          </div>
        )}

        <p className="mb-1 text-xs text-muted-foreground">{t("risk.corrHowTo")}</p>
        <div className="max-h-[560px] max-w-full overflow-auto overscroll-x-contain rounded-md border border-border">
          <div
            className="grid w-max p-2"
            style={{ gridTemplateColumns: `${LABEL_W}px repeat(${n}, ${CELL}px)` }}
            onMouseLeave={() => setHover(null)}
          >
            <div />
            {symbols.map((s) => (
              <div
                key={`c-${s}`}
                className="flex items-end justify-center pb-1 text-[10px] font-medium text-muted-foreground"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 52 }}
              >
                {s}
              </div>
            ))}
            {symbols.map((a, i) => (
              <div key={`r-${a}`} className="contents">
                <div className="sticky left-0 flex items-center bg-card pr-1.5 text-[10px] font-medium text-muted-foreground">{a}</div>
                {symbols.map((b, j) => {
                  const v = matrix[i]?.[j] ?? 0;
                  const diag = i === j;
                  return (
                    <div
                      key={`${a}-${b}`}
                      role="img"
                      aria-label={t("risk.corrCell", { a, b, v: v.toFixed(2) })}
                      onMouseEnter={() => setHover({ a, b, v })}
                      onClick={() => setHover({ a, b, v })}
                      className="flex items-center justify-center border border-card font-mono text-[9px]"
                      style={{
                        width: CELL,
                        height: CELL,
                        background: diag ? "hsl(var(--muted))" : correlationColor(v),
                        color: Math.abs(v) > 0.55 && !diag ? "hsl(var(--card))" : "hsl(var(--foreground))",
                      }}
                    >
                      {showValues && !diag ? v.toFixed(1) : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{t("risk.corrOpposite")}</span>
            <span
              className="h-2.5 w-24 rounded-sm border border-border sm:w-32"
              style={{ background: `linear-gradient(to right, ${correlationColor(-1)}, ${correlationColor(0)}, ${correlationColor(1)})` }}
              aria-hidden="true"
            />
            <span>{t("risk.corrTogether")}</span>
          </div>
          <span className="min-h-[1rem] font-mono text-foreground" aria-live="polite">
            {hover
              ? hover.a === hover.b
                ? hover.a
                : t("risk.corrCell", { a: hover.a, b: hover.b, v: hover.v.toFixed(2) })
              : t("risk.corrTapHint")}
          </span>
        </div>
      </div>
    </ChartCard>
  );
};
