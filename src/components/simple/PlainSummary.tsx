import { Fragment, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useT } from "@/i18n";
import { fmtMoney, fmtPercent } from "@/i18n/format";
import { Explain } from "@/components/Explain";
import { Skeleton } from "@/components/ui/skeleton";
import type { LivePortfolioSummary } from "@/types";
import type { RiskData } from "@/services/riskApi";
import { cn } from "@/lib/utils";

interface Props {
  summary: LivePortfolioSummary;
  /** Same object the advanced view's ReturnVsMarket reads. Omitted line when missing. */
  performance?: RiskData["performance"];
  loading?: boolean;
}

/**
 * Put a large amount inside a translated sentence. The template keeps its
 * "{amount}" placeholder (t() without vars leaves placeholders untouched),
 * so word order stays natural in both languages.
 */
const withAmount = (template: string, amount: ReactNode): ReactNode => {
  const parts = template.split("{amount}");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && amount}
    </Fragment>
  ));
};

const Big = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("whitespace-nowrap font-mono text-2xl font-semibold tracking-tight text-foreground", className)}>
    {children}
  </span>
);

/** Three plain sentences: what went in, what it is worth, the gain or loss. Then the index comparison. */
export const PlainSummary = ({ summary, performance, loading }: Props) => {
  const { t } = useT();

  if (loading) {
    return (
      <section className="surface space-y-4 p-4 sm:p-5" aria-busy="true">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-8 w-4/5" />
      </section>
    );
  }

  const gain = summary.totalGainLoss;
  const pct = summary.totalGainLossPercent;
  const direction = gain > 0 ? "up" : gain < 0 ? "down" : "flat";
  const DirIcon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const tone = direction === "up" ? "text-success" : direction === "down" ? "text-destructive" : "text-muted-foreground";

  // The live feed carries no trading date, so the wording is always "last trading day".
  const today = summary.todayChange;
  const todayDir: "up" | "down" | "flat" | null =
    today === undefined || today === null || Number.isNaN(today) ? null : Math.abs(today) < 1 ? "flat" : today > 0 ? "up" : "down";
  const TodayIcon = todayDir === "up" ? ArrowUp : todayDir === "down" ? ArrowDown : Minus;
  const todayTone = todayDir === "up" ? "text-success" : todayDir === "down" ? "text-destructive" : "text-muted-foreground";

  // Index comparison: read exactly as dashboard/ReturnVsMarket does.
  const x = performance?.xirr;
  const b = performance?.benchmarkXirr;
  const hasComparison = x !== null && x !== undefined && b !== null && b !== undefined;
  const per100 = (v: number) => Math.abs(v * 100).toFixed(1);

  return (
    <section className="surface space-y-4 p-4 sm:p-5" aria-label={t("simple.summaryLabel")}>
      <p className="text-base leading-relaxed">
        {withAmount(t("simple.investedSentence"), <Big>{fmtMoney(summary.totalInvested)}</Big>)}{" "}
        <Explain title={t("simple.investedTitle")} text={t("simple.investedExplain")} className="h-6 w-6" />
      </p>

      <p className="text-base leading-relaxed">
        {withAmount(t("simple.worthSentence"), <Big>{fmtMoney(summary.currentValue)}</Big>)}{" "}
        <Explain title={t("simple.worthTitle")} text={t("simple.worthExplain")} className="h-6 w-6" />
      </p>

      <div className="flex items-start gap-2">
        <span
          className={cn("mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted", tone)}
          aria-hidden="true"
        >
          <DirIcon className="h-4 w-4" />
        </span>
        <p className="text-base leading-relaxed">
          {withAmount(
            t(direction === "up" ? "simple.upSentence" : direction === "down" ? "simple.downSentence" : "simple.flatSentence", {
              percent: fmtPercent(Math.abs(pct), 1, false),
            }),
            <Big className={tone}>{fmtMoney(Math.abs(gain))}</Big>,
          )}{" "}
          <Explain title={t("simple.gainTitle")} text={t("simple.gainExplain")} className="h-6 w-6" />
        </p>
      </div>

      {todayDir && (
        <div className="flex items-start gap-2">
          <span className={cn("mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted", todayTone)} aria-hidden="true">
            <TodayIcon className="h-4 w-4" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {todayDir === "flat"
              ? t("simple.todayFlat")
              : withAmount(
                  t(todayDir === "up" ? "simple.todayUp" : "simple.todayDown"),
                  <span className="whitespace-nowrap font-mono font-semibold text-foreground">{fmtMoney(Math.abs(today as number))}</span>,
                )}
          </p>
        </div>
      )}

      {hasComparison && (
        <div className="space-y-1 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
          <p className="text-foreground">
            {t((x as number) >= 0 ? "simple.perfMineGain" : "simple.perfMineLoss", { amount: per100(x as number) })}{" "}
            {t((b as number) >= 0 ? "simple.perfIndexGain" : "simple.perfIndexLoss", { amount: per100(b as number) })}{" "}
            <Explain term="benchmarkXirr" className="h-6 w-6" />
          </p>
          <p>{t("simple.perfNote")}</p>
        </div>
      )}
    </section>
  );
};
