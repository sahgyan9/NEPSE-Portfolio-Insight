import { ArrowRight } from "lucide-react";
import { Explain } from "@/components/Explain";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";
import { fmtMoney, fmtPercent } from "@/i18n/format";
import { useRealizedGains, type RealizedTotal } from "@/services/realizedApi";
import { cn } from "@/lib/utils";

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmtMoney(Math.abs(v))}`;
const tone = (v: number) => (v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-foreground");

const Figure = ({ label, total, emptyText }: { label: string; total: RealizedTotal; emptyText?: string }) => {
  const { t } = useT();
  const counted = total.sales - total.uncounted;
  const pct = total.cost > 0 ? (total.profit / total.cost) * 100 : null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {total.sales === 0 && emptyText ? (
        <p className="mt-1 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <p className={cn("mt-1 font-mono text-lg font-semibold tracking-tight sm:text-xl", tone(total.profit))}>
            {counted > 0 ? signed(total.profit) : "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("realized.stripSales", { count: total.sales })}
            {pct !== null && ` · ${fmtPercent(pct)}`}
          </p>
        </>
      )}
    </div>
  );
};

/** One row under the summary cards: profit already taken by selling, this fiscal year and all time. */
export const RealizedStrip = () => {
  const { t } = useT();
  const { data, isLoading, isError } = useRealizedGains();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError) return <p className="text-xs text-muted-foreground">{t("realized.errLoad")}</p>;
  if (!data || data.allTime.sales === 0) return null;

  const { thisYear, allTime } = data;
  return (
    <section className="surface space-y-3 p-3 sm:p-4" aria-labelledby="realized-strip-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="realized-strip-title" className="flex items-center gap-1 text-sm font-semibold">
          {t("realized.stripTitle")}
          <Explain title={t("realized.stripTitle")} text={t("realized.explain")} />
        </h3>
        <a href="#sold" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary hover:underline">
          {t("realized.stripSee")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Figure
          label={t("realized.stripThisYear", { fy: data.currentFiscalYear })}
          total={thisYear}
          emptyText={t("realized.stripNone")}
        />
        <Figure label={t("realized.stripAllTime")} total={allTime} />
      </div>
      {(allTime.feesMissing > 0 || allTime.uncounted > 0) && (
        <div className="space-y-1 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
          {allTime.feesMissing > 0 && <p>{t("realized.feesNote", { count: allTime.feesMissing })}</p>}
          {allTime.uncounted > 0 && <p>{t("realized.uncountedNote", { count: allTime.uncounted })}</p>}
        </div>
      )}
    </section>
  );
};
