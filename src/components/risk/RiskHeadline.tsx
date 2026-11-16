import type { ReactNode } from "react";
import { Explain } from "@/components/Explain";
import type { GlossaryKey } from "@/lib/glossary";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtFrac } from "@/components/charts";
import { fmtMoney } from "@/i18n/format";
import { useT } from "@/i18n";
import type { RiskData } from "@/services/riskApi";
import { cn } from "@/lib/utils";
import { riskLevelKey } from "./riskText";

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
  const { t } = useT();
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
        label={t("risk.tileLevel")}
        term="volatilityVsMarket"
        value={t(riskLevelKey(risk.riskLevel))}
        tone={tone}
        sub={
          p.volatilityVsMarket === null || p.volatilityVsMarket === undefined
            ? t("risk.tileLevelSubNone")
            : t("risk.tileLevelSub", { ratio: p.volatilityVsMarket.toFixed(2) })
        }
      />
      <Tile
        label={t("risk.tileVol")}
        term="volatility"
        value={fmtFrac(p.volatility)}
        sub={t("risk.tileMarketValue", { value: fmtFrac(m.volatility) })}
      />
      <Tile
        label={t("risk.tileDrawdown")}
        term="maxDrawdown"
        value={`-${fmtFrac(Math.abs(p.maxDrawdown))}`}
        tone="loss"
        sub={t("risk.tileDrawdownSub", { value: `-${fmtFrac(Math.abs(m.maxDrawdown))}` })}
      />
      <Tile
        label={t("risk.tileVar")}
        term="var95"
        value={t("risk.about", { value: fmtMoney(p.weeklyVar95Amount) })}
        sub={t("risk.tileVarSub", { pct: fmtFrac(p.weeklyVar95) })}
      />
    </div>
  );
};
