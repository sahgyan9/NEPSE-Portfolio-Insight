import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PortfolioSummary } from "@/data/portfolioData";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtRs } from "@/components/charts";
import { cn } from "@/lib/utils";

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
  loading?: boolean;
}

const Tile = ({
  label,
  value,
  sub,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "gain" | "loss";
  loading?: boolean;
}) => (
  <div className="surface p-4">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    {loading ? (
      <>
        <Skeleton className="mt-2 h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-20" />
      </>
    ) : (
      <>
        <p
          className={cn(
            "mt-1 font-mono text-xl font-semibold tracking-tight sm:text-2xl",
            tone === "gain" && "text-success",
            tone === "loss" && "text-destructive"
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 flex min-h-[1.25rem] items-center gap-1 text-xs text-muted-foreground">
          {tone === "gain" && <ArrowUpRight className="h-3.5 w-3.5 text-success" aria-hidden="true" />}
          {tone === "loss" && <ArrowDownRight className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />}
          {sub}
        </p>
      </>
    )}
  </div>
);

export const PortfolioSummaryCards = ({ summary, loading }: PortfolioSummaryCardsProps) => {
  const gain = summary.totalGainLoss;
  const tone = gain >= 0 ? "gain" : "loss";
  const dividends = summary.totalDividendIncome || 0;
  const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "-" : "");

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Portfolio value" value={fmtRs(summary.currentValue)} sub={`${summary.totalHoldings} holdings`} loading={loading} />
      <Tile label="Money invested" value={fmtRs(summary.totalInvested)} sub="Total purchase cost" loading={loading} />
      <Tile
        label="Gain or loss on holdings"
        value={`${sign(gain)}${fmtRs(Math.abs(gain))}`}
        sub={`${sign(summary.totalGainLossPercent)}${Math.abs(summary.totalGainLossPercent).toFixed(1)}% on cost`}
        tone={tone}
        loading={loading}
      />
      <Tile
        label="Cash dividends received"
        value={fmtRs(dividends)}
        sub={
          summary.netGrowth !== undefined && dividends > 0
            ? `With dividends: ${sign(summary.netGrowth)}${fmtRs(Math.abs(summary.netGrowth))}`
            : "After 5% tax"
        }
        loading={loading}
      />
    </div>
  );
};
