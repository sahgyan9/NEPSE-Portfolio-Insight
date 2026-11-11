import type { ReactNode } from "react";
import { Explain } from "@/components/Explain";
import type { GlossaryKey } from "@/lib/glossary";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtFrac, fmtRs } from "@/components/charts";
import type { RiskData } from "@/services/riskApi";
import { cn } from "@/lib/utils";

const Tile = ({
  label,
  term,
  value,
  sub,
  tone,
}: {
  label: string;
  term: GlossaryKey;
  value: ReactNode;
  sub: ReactNode;
  tone?: "gain" | "warn" | "loss";
}) => (
  <div className="surface p-4">
    <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Explain term={term} />
    </p>
    <p
      className={cn(
        "mt-1 text-xl font-semibold leading-tight tracking-tight sm:text-2xl",
        tone === "gain" && "text-success",
        tone === "warn" && "text-warning",
        tone === "loss" && "text-destructive"
      )}
    >
      {value}
    </p>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sub}</p>
  </div>
);

export const RiskHeadline = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
  if (loading || !risk) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }
  const p = risk.portfolio;
  const m = risk.market;
  const tone = risk.riskLevel.startsWith("Lower") ? "gain" : risk.riskLevel.startsWith("Higher") ? "warn" : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Overall risk level"
        term="volatilityVsMarket"
        value={risk.riskLevel}
        tone={tone}
        sub={`Your swings are ${p.volatilityVsMarket.toFixed(2)}x those of the market index`}
      />
      <Tile
        label="Yearly volatility"
        term="volatility"
        value={fmtFrac(p.volatility)}
        sub={`Market index: ${fmtFrac(m.volatility)}`}
      />
      <Tile
        label="Worst historical drop"
        term="maxDrawdown"
        value={`-${fmtFrac(Math.abs(p.maxDrawdown))}`}
        tone="loss"
        sub={`Market index: -${fmtFrac(Math.abs(m.maxDrawdown))} over the same period`}
      />
      <Tile
        label="A bad week (1 in 20)"
        term="var95"
        value={`about ${fmtRs(p.weeklyVar95Amount)}`}
        sub={`${fmtFrac(p.weeklyVar95)} of today's value. Worse weeks are possible.`}
      />
    </div>
  );
};
