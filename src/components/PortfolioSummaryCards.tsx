import { TrendingUp, TrendingDown, Wallet, PieChart, Target, Award, Gift, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortfolioSummary } from "@/data/portfolioData";
import { DynamicGradientBorder } from "./DynamicGradientBorder";

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  delay,
  size = "normal",
  variant = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  delay: number;
  size?: "large" | "normal";
  variant?: "default" | "primary" | "accent" | "muted" | "dividend" | "netgrowth";
}) => {
  return (
    <div
      className={cn(
        "stat-card opacity-0 animate-fade-in relative overflow-hidden",
        trend === "up" && "hover:glow-profit",
        trend === "down" && "hover:glow-loss",
        size === "large" && "py-6",
        variant === "primary" && "border-blue-500/30 bg-blue-950/20",
        variant === "accent" && "border-emerald-500/30 bg-emerald-950/20",
        variant === "dividend" && "border-amber-500/30 bg-amber-950/20",
        variant === "netgrowth" && "border-purple-500/30 bg-purple-950/20"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <DynamicGradientBorder />
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <p className={cn(
            "font-medium text-muted-foreground",
            size === "large" ? "text-base" : "text-sm"
          )}>{title}</p>
          <p
            className={cn(
              "font-bold tracking-tight font-mono",
              size === "large" ? "text-3xl" : "text-2xl",
              variant === "primary" && "text-blue-400",
              variant === "accent" && "text-emerald-400",
              variant === "muted" && "text-muted-foreground",
              variant === "dividend" && "text-amber-400",
              variant === "netgrowth" && "text-purple-400",
              variant === "default" && trend === "up" && "text-success",
              variant === "default" && trend === "down" && "text-destructive",
              variant === "default" && trend === "neutral" && "text-foreground"
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p
              className={cn(
                size === "large" ? "text-base" : "text-sm",
                variant === "primary" && "text-blue-400/70",
                variant === "accent" && "text-emerald-400/70",
                variant === "muted" && "text-muted-foreground/70",
                variant === "dividend" && "text-amber-400/70",
                variant === "netgrowth" && "text-purple-400/70",
                variant === "default" && trend === "up" && "text-success/80",
                variant === "default" && trend === "down" && "text-destructive/80",
                variant === "default" && trend === "neutral" && "text-muted-foreground"
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={cn(
            "rounded-xl",
            size === "large" ? "p-4" : "p-3",
            variant === "primary" && "bg-blue-500/10 text-blue-400",
            variant === "accent" && "bg-emerald-500/10 text-emerald-400",
            variant === "muted" && "bg-muted/30 text-muted-foreground",
            variant === "dividend" && "bg-amber-500/10 text-amber-400",
            variant === "netgrowth" && "bg-purple-500/10 text-purple-400",
            variant === "default" && trend === "up" && "bg-success/10 text-success",
            variant === "default" && trend === "down" && "bg-destructive/10 text-destructive",
            variant === "default" && trend === "neutral" && "bg-primary/10 text-primary"
          )}
        >
          <Icon className={size === "large" ? "h-6 w-6" : "h-5 w-5"} />
        </div>
      </div>
    </div>
  );
};

export const PortfolioSummaryCards = ({ summary }: PortfolioSummaryCardsProps) => {
  const formatCurrency = (value: number) => {
    return `Rs. ${value.toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const hasDividendData = (summary.totalDividendIncome && summary.totalDividendIncome > 0) ||
    (summary.totalBonusValue && summary.totalBonusValue > 0);
  // Total Dividend Value shows only cash dividends (bonus shares already in portfolio value)
  const totalDividendValue = (summary.totalDividendIncome || 0);

  return (
    <div className="space-y-4">
      {/* Top row - 3 main cards (larger) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Invested"
          value={formatCurrency(summary.totalInvested)}
          icon={Wallet}
          trend="neutral"
          delay={0}
          size="large"
          variant="primary"
        />
        <StatCard
          title="Current Value"
          value={formatCurrency(summary.currentValue)}
          subtitle={formatPercent(summary.totalGainLossPercent)}
          icon={PieChart}
          trend={summary.totalGainLossPercent >= 0 ? "up" : "down"}
          delay={100}
          size="large"
        />
        <StatCard
          title="Capital Gain/Loss"
          value={formatCurrency(Math.abs(summary.totalGainLoss))}
          subtitle={summary.totalGainLoss >= 0 ? "Profit" : "Loss"}
          icon={summary.totalGainLoss >= 0 ? TrendingUp : TrendingDown}
          trend={summary.totalGainLoss >= 0 ? "up" : "down"}
          delay={200}
          size="large"
          variant="accent"
        />
      </div>

      {/* Dividend & Net Growth row */}
      {hasDividendData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Total Dividend Value"
            value={formatCurrency(totalDividendValue)}
            subtitle="Cash dividends received"
            icon={Gift}
            trend="up"
            delay={250}
            size="large"
            variant="dividend"
          />
          <StatCard
            title="Net Growth (with Dividends)"
            value={formatCurrency(summary.netGrowth || 0)}
            subtitle={summary.netGrowthPercent ? formatPercent(summary.netGrowthPercent) : undefined}
            icon={Sparkles}
            trend={(summary.netGrowth || 0) >= 0 ? "up" : "down"}
            delay={275}
            size="large"
            variant="netgrowth"
          />
        </div>
      )}

      {/* Bottom row - 3 secondary cards (smaller) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Holdings"
          value={summary.totalHoldings.toString()}
          subtitle="Unique stocks"
          icon={Target}
          trend="neutral"
          delay={300}
          variant="muted"
        />
        <StatCard
          title="Profitable"
          value={summary.profitableHoldings.toString()}
          subtitle={`${((summary.profitableHoldings / summary.totalHoldings) * 100).toFixed(0)}% of portfolio`}
          icon={TrendingUp}
          trend="up"
          delay={400}
          variant="muted"
        />
        <StatCard
          title="Underperforming"
          value={summary.unprofitableHoldings.toString()}
          subtitle={`${((summary.unprofitableHoldings / summary.totalHoldings) * 100).toFixed(0)}% of portfolio`}
          icon={TrendingDown}
          trend="down"
          delay={500}
        />
      </div>
    </div>
  );
};
