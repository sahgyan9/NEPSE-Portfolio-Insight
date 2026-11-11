import { useState } from "react";
import { ChartCard, correlationColor } from "@/components/charts";
import type { RiskData } from "@/services/riskApi";

const CELL = 24;
const LABEL_W = 64;

export const CorrelationHeatmap = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
  const [hover, setHover] = useState<{ a: string; b: string; v: number } | null>(null);
  const symbols = risk?.correlation.symbols ?? [];
  const matrix = risk?.correlation.matrix ?? [];
  const n = symbols.length;
  const showValues = n <= 12;

  return (
    <ChartCard
      title="Do my holdings move together?"
      subtitle="Strongly coloured cells mean two holdings rise and fall together, so owning both diversifies less."
      explain="correlation"
      loading={loading}
      empty={n < 2}
      height={320}
    >
      <div id="correlation-chart">
        <div className="max-h-[560px] overflow-auto rounded-md border border-border">
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
                      aria-label={`${a} and ${b}: ${v.toFixed(2)}`}
                      onMouseEnter={() => setHover({ a, b, v })}
                      className="flex items-center justify-center border border-card text-[9px] font-mono"
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
            <span>Move opposite</span>
            <span
              className="h-2.5 w-32 rounded-sm border border-border"
              style={{ background: `linear-gradient(to right, ${correlationColor(-1)}, ${correlationColor(0)}, ${correlationColor(1)})` }}
              aria-hidden="true"
            />
            <span>Move together</span>
          </div>
          <span className="min-h-[1rem] font-mono text-foreground">
            {hover ? (hover.a === hover.b ? hover.a : `${hover.a} and ${hover.b}: ${hover.v.toFixed(2)}`) : "Hover a cell to read it"}
          </span>
        </div>
      </div>
    </ChartCard>
  );
};
