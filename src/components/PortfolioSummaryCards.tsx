import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PortfolioSummary } from "@/data/portfolioData";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";
import { fmtMoney, fmtMoneyCompact, fmtPercent } from "@/i18n/format";
import { cn } from "@/lib/utils";

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
  loading?: boolean;
}

/** Full amount from the sm breakpoint up; compact (lakh/crore) on narrow phones so nothing clips. */
const Amount = ({ value, signed }: { value: number; signed?: boolean }) => {
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "-" : "") : "";
  const v = signed ? Math.abs(value) : value;
  return (
    <>
      <span className="sm:hidden">{sign}{fmtMoneyCompact(v)}</span>
      <span className="hidden sm:inline">{sign}{fmtMoney(v)}</span>
    </>
  );
};

const Tile = ({
  label,
  value,
  sub,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "neutral" | "gain" | "loss";
  loading?: boolean;
}) => (
  <div className="surface min-w-0 p-3 sm:p-4">
    <p className="text-xs font-medium leading-snug text-muted-foreground">{label}</p>
    {loading ? (
      <>
        <Skeleton className="mt-2 h-7 w-24 sm:w-32" />
        <Skeleton className="mt-2 h-4 w-16 sm:w-20" />
      </>
    ) : (
      <>
        <p
          className={cn(
            "mt-1 break-words font-mono text-lg font-semibold tracking-tight sm:text-2xl",
            tone === "gain" && "text-success",
            tone === "loss" && "text-destructive"
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 flex min-h-[1.25rem] items-center gap-1 text-xs leading-snug text-muted-foreground">
          {tone === "gain" && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />}
          {tone === "loss" && <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />}
          <span className="min-w-0">{sub}</span>
        </p>
      </>
    )}
  </div>
);

export const PortfolioSummaryCards = ({ summary, loading }: PortfolioSummaryCardsProps) => {
  const { t } = useT();
  const gain = summary.totalGainLoss;
  const tone = gain >= 0 ? "gain" : "loss";
  const dividends = summary.totalDividendIncome || 0;
  const netSign = (v: number) => (v > 0 ? "+" : v < 0 ? "-" : "");

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label={t("home.cardValue")}
        value={<Amount value={summary.currentValue} />}
        sub={t("home.cardValueSub", { count: summary.totalHoldings })}
        loading={loading}
      />
      <Tile
        label={t("home.cardInvested")}
        value={<Amount value={summary.totalInvested} />}
        sub={t("home.cardInvestedSub")}
        loading={loading}
      />
      <Tile
        label={t("home.cardGain")}
        value={<Amount value={gain} signed />}
        sub={t(gain >= 0 ? "home.cardGainSubUp" : "home.cardGainSubDown", {
          percent: fmtPercent(Math.abs(summary.totalGainLossPercent), 1, false),
        })}
        tone={tone}
        loading={loading}
      />
      <Tile
        label={t("home.cardDividends")}
        value={<Amount value={dividends} />}
        sub={
          summary.netGrowth !== undefined && dividends > 0
            ? t("home.cardDividendsWith", { amount: `${netSign(summary.netGrowth)}${fmtMoneyCompact(Math.abs(summary.netGrowth))}` })
            : t("home.cardDividendsSub")
        }
        loading={loading}
      />
    </div>
  );
};
