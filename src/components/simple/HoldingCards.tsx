import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CircleCheck, Minus, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n";
import { fmtMoney, fmtNumber, fmtPercent } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StockHolding } from "@/data/portfolioData";
import { getHoldingStatus, type HoldingStatusLevel } from "@/lib/holdingStatus";
import { cn } from "@/lib/utils";

/** How many cards show before "See more". */
const INITIAL_COUNT = 8;

const LEVEL_STYLE: Record<HoldingStatusLevel, { icon: LucideIcon; tone: string; chip: string; key: string }> = {
  ok: { icon: CircleCheck, tone: "text-success", chip: "border-success/30 bg-success/10", key: "simple.statusOk" },
  watch: { icon: TriangleAlert, tone: "text-warning", chip: "border-warning/30 bg-warning/10", key: "simple.statusWatch" },
  problem: { icon: OctagonAlert, tone: "text-destructive", chip: "border-destructive/30 bg-destructive/10", key: "simple.statusProblem" },
};

interface Props {
  holdings: StockHolding[];
  loading?: boolean;
}

/** One card per holding, biggest first, each with a status chip and one sentence explaining it. */
export const HoldingCards = ({ holdings, loading }: Props) => {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + (h.currentValue || 0), 0);
    return [...holdings]
      .sort((a, b) => b.currentValue - a.currentValue)
      .map((h) => ({ h, status: getHoldingStatus(h, { totalValue }) }));
  }, [holdings]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  const shown = expanded ? rows : rows.slice(0, INITIAL_COUNT);

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {shown.map(({ h, status }) => {
          const st = LEVEL_STYLE[status.level];
          const StatusIcon = st.icon;
          const dir = h.gainLoss > 0 ? "up" : h.gainLoss < 0 ? "down" : "flat";
          const DirIcon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;
          const dirTone = dir === "up" ? "text-success" : dir === "down" ? "text-destructive" : "text-muted-foreground";
          const hasPrice = h.currentPrice > 0;
          const pct = h.totalCost > 0 && Number.isFinite(h.gainLossPercent) ? fmtPercent(Math.abs(h.gainLossPercent), 1, false) : "-";
          return (
            <li key={h.scrip} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{h.scrip}</p>
                  {h.fullName && h.fullName !== h.scrip && (
                    <p className="truncate text-sm text-muted-foreground">{h.fullName}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                    st.chip,
                    st.tone,
                  )}
                >
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t(st.key)}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("simple.cardKitta")}</dt>
                  <dd className="font-mono">
                    {fmtNumber(h.quantity)} {t("common.kitta")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("simple.cardWorth")}</dt>
                  <dd className="font-mono font-semibold">{hasPrice ? fmtMoney(h.currentValue) : "-"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">{t("simple.cardGain")}</dt>
                  <dd className={cn("flex flex-wrap items-center gap-1 font-mono", hasPrice && dirTone)}>
                    {hasPrice ? (
                      <>
                        <DirIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="font-sans">
                          {t(dir === "up" ? "simple.gainWord" : dir === "down" ? "simple.lossWord" : "simple.flatWord")}
                        </span>
                        <span>
                          {fmtMoney(Math.abs(h.gainLoss))} ({pct})
                        </span>
                      </>
                    ) : (
                      <span className="font-sans text-muted-foreground">{t("simple.noPriceShort")}</span>
                    )}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                {t(status.reasonKey, status.vars)}
              </p>
            </li>
          );
        })}
      </ul>

      {rows.length > INITIAL_COUNT && (
        <Button variant="outline" className="h-11 w-full" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t("common.seeLess") : t("simple.seeMoreCount", { count: rows.length - INITIAL_COUNT })}
        </Button>
      )}
    </div>
  );
};
