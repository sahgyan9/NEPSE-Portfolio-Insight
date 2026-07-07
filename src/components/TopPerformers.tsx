import { TrendingUp, TrendingDown, Crown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StockHolding } from "@/data/portfolioData";
import { StockSymbolLink } from "@/components/StockSymbolLink";

interface TopPerformersProps {
  topPerformers: StockHolding[];
  worstPerformers: StockHolding[];
}

const PerformerCard = ({
  holding,
  rank,
  isTop,
}: {
  holding: StockHolding;
  rank: number;
  isTop: boolean;
}) => {
  const formatCurrency = (value: number) =>
    `Rs. ${value.toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
  const formatPercent = (value: number) =>
    `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02]",
        isTop
          ? "bg-success/5 border-success/20 hover:border-success/40"
          : "bg-destructive/5 border-destructive/20 hover:border-destructive/40"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
          isTop ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
        )}
      >
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <StockSymbolLink
            symbol={holding.scrip}
            className="font-semibold text-foreground"
          />
          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
            {holding.sector}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{holding.fullName}</p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "font-mono font-bold",
            isTop ? "text-success" : "text-destructive"
          )}
        >
          {formatPercent(holding.gainLossPercent)}
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          {formatCurrency(holding.gainLoss)}
        </p>
      </div>
    </div>
  );
};

export const TopPerformers = ({
  topPerformers,
  worstPerformers,
}: TopPerformersProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Performers */}
      <div
        className="glass-card p-4 opacity-0 animate-fade-in"
        style={{ animationDelay: "1000ms" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-success/10">
            <Crown className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold">Top Performers</h3>
            <p className="text-xs text-muted-foreground">Best gains in your portfolio</p>
          </div>
        </div>
        <div className="space-y-2">
          {topPerformers.map((holding, index) => (
            <PerformerCard
              key={holding.scrip}
              holding={holding}
              rank={index + 1}
              isTop={true}
            />
          ))}
        </div>
      </div>

      {/* Worst Performers */}
      <div
        className="glass-card p-4 opacity-0 animate-fade-in"
        style={{ animationDelay: "1100ms" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold">Underperformers</h3>
            <p className="text-xs text-muted-foreground">Stocks needing attention</p>
          </div>
        </div>
        <div className="space-y-2">
          {worstPerformers.map((holding, index) => (
            <PerformerCard
              key={holding.scrip}
              holding={holding}
              rank={index + 1}
              isTop={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
