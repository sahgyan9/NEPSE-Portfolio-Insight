import { useState, useEffect, useMemo } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Info, Loader2, Search, X, Gift } from "lucide-react";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StockHolding } from "@/data/portfolioData";
import { fetchMultipleFundamentals, MerolaganiFundamentals } from "@/services/merolaganiApi";
import { StockSymbolLink } from "@/components/StockSymbolLink";

import { Link } from "react-router-dom";

interface HoldingsTableProps {
  holdings: StockHolding[];
  dividendFiscalYear?: string;
  onDividendFiscalYearChange?: (fy: string) => void;
}

interface EnhancedHolding extends StockHolding {
  liveBookValue?: number | null;
  livePbRatio?: number | null;
  isLoading?: boolean;
}

type SortKey = keyof StockHolding | "liveBookValue" | "livePbRatio" | "totalDividendValue";
type SortOrder = "asc" | "desc";

export const HoldingsTable = ({
  holdings,
  dividendFiscalYear = "082-083",
  onDividendFiscalYearChange,
}: HoldingsTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("currentValue");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [enhancedHoldings, setEnhancedHoldings] = useState<EnhancedHolding[]>([]);
  const [isLoadingFundamentals, setIsLoadingFundamentals] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch real-time fundamentals for all holdings
  useEffect(() => {
    const fetchFundamentals = async () => {
      if (holdings.length === 0) return;

      setIsLoadingFundamentals(true);

      // Initialize enhanced holdings with loading state
      setEnhancedHoldings(holdings.map(h => ({ ...h, isLoading: true })));

      try {
        const symbols = holdings.map(h => h.scrip);
        const fundamentalsMap = await fetchMultipleFundamentals(symbols);

        setEnhancedHoldings(holdings.map(holding => {
          const fundamentals = fundamentalsMap.get(holding.scrip);
          if (fundamentals) {
            // Calculate live P/B ratio using current price and live book value
            const liveBookValue = fundamentals.bookValue;
            const livePbRatio = liveBookValue && liveBookValue > 0
              ? holding.currentPrice / liveBookValue
              : null;

            return {
              ...holding,
              liveBookValue,
              livePbRatio,
              isLoading: false,
            };
          }
          return { ...holding, isLoading: false };
        }));
      } catch (error) {
        console.error("Failed to fetch fundamentals:", error);
        setEnhancedHoldings(holdings.map(h => ({ ...h, isLoading: false })));
      } finally {
        setIsLoadingFundamentals(false);
      }
    };

    fetchFundamentals();
  }, [holdings]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  // Filter holdings based on search query (including dividend keywords)
  const filteredHoldings = useMemo(() => {
    if (!searchQuery.trim()) return enhancedHoldings;

    const query = searchQuery.toLowerCase().trim();
    return enhancedHoldings.filter(holding => {
      const matchesText =
        holding.scrip.toLowerCase().includes(query) ||
        holding.fullName.toLowerCase().includes(query) ||
        holding.sector.toLowerCase().includes(query);
      if (matchesText) return true;

      // Allow quick filtering by dividend keywords
      if (query === "dividend" || query === "dividends") {
        return (
          (holding.dividendIncome && holding.dividendIncome > 0) ||
          (holding.bonusShareValue && holding.bonusShareValue > 0) ||
          (holding.latestDividendPercent && holding.latestDividendPercent > 0) ||
          !!holding.latestBonusRatio ||
          (holding.totalDividendValue && holding.totalDividendValue > 0)
        );
      }
      if (query === "bonus") {
        return (
          (holding.bonusShares && holding.bonusShares > 0) ||
          (holding.bonusShareValue && holding.bonusShareValue > 0) ||
          !!holding.latestBonusRatio
        );
      }
      if (query === "cash" || query === "cash dividend") {
        return (
          (holding.dividendIncome && holding.dividendIncome > 0) ||
          (holding.latestDividendPercent && holding.latestDividendPercent > 0)
        );
      }

      return false;
    });
  }, [enhancedHoldings, searchQuery]);

  const sortedHoldings = useMemo(() => {
    return [...filteredHoldings].sort((a, b) => {
      let aVal: any = (a as any)[sortKey] ?? 0;
      let bVal: any = (b as any)[sortKey] ?? 0;

      // Unified dividend sorting: evaluate both cash income and bonus share value
      if (sortKey === "dividendIncome" || sortKey === "totalDividendValue") {
        const getDividendScore = (h: EnhancedHolding): number => {
          // 1. Total monetary value (cash income + bonus share value)
          const val = h.totalDividendValue ?? ((h.dividendIncome || 0) + (h.bonusShareValue || 0));
          if (val > 0) return val;

          // 2. If monetary value is 0 (e.g. price missing or fractional share), evaluate via bonus shares / percentage
          if (h.bonusShares && h.bonusShares > 0) {
            const price = h.currentPrice > 0 ? h.currentPrice : (h.waccRate > 0 ? h.waccRate : 100);
            return h.bonusShares * price;
          }
          if (h.totalDividendPercent && h.totalDividendPercent > 0) {
            const price = h.currentPrice > 0 ? h.currentPrice : (h.waccRate > 0 ? h.waccRate : 100);
            return (h.quantity * (h.totalDividendPercent / 100)) * price;
          }
          if (h.latestBonusRatio) {
            const pct = parseFloat(h.latestBonusRatio.replace("%", "")) || 0;
            if (pct > 0) {
              const price = h.currentPrice > 0 ? h.currentPrice : (h.waccRate > 0 ? h.waccRate : 100);
              return (h.quantity * (pct / 100)) * price;
            }
          }
          return 0;
        };

        aVal = getDividendScore(a);
        bVal = getDividendScore(b);
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredHoldings, sortKey, sortOrder]);

  const formatCurrency = (value: number) => `Rs. ${value.toLocaleString("en-NP", { maximumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  // Color scheme for different columns (avoiding green which is used for Gain/Loss)
  const columnColors = {
    index: "text-slate-400",
    symbol: "text-primary",
    company: "text-muted-foreground",
    qty: "text-cyan-500",
    avgCost: "text-amber-500",
    ltp: "text-violet-500",
    value: "text-blue-500",
    gainLoss: "", // Uses success/destructive based on value
    dividend: "text-amber-400",
    bookVal: "text-pink-500",
    pb: "text-orange-500",
    sector: "text-teal-500",
  };

  const SortableHeader = ({
    label,
    sortKeyName,
    colorClass,
    children,
  }: {
    label: string;
    sortKeyName: SortKey;
    colorClass?: string;
    children?: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => handleSort(sortKeyName)}
      className={cn("flex items-center gap-1 hover:opacity-80 transition-colors font-semibold", colorClass)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
      {children}
    </button>
  );

  const getPBRatioColor = (pb: number | null) => {
    if (!pb) return "text-muted-foreground";
    if (pb < 1) return "text-success"; // Undervalued
    if (pb < 1.5) return "text-primary"; // Fair value
    if (pb < 2.5) return "text-accent"; // Slightly overvalued
    return "text-destructive"; // Overvalued
  };

  return (
    <div className="glass-card overflow-hidden opacity-0 animate-fade-in" style={{ animationDelay: "600ms" }}>
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Portfolio Holdings
            <Badge variant="secondary" className="font-mono">
              {holdings.length} stocks
            </Badge>
            {isLoadingFundamentals && (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading fundamentals...
              </Badge>
            )}
          </h3>

          {onDividendFiscalYearChange && (
            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border text-xs self-start sm:self-auto">
              <span className="text-muted-foreground font-semibold px-2 uppercase tracking-wider text-[11px]">
                Dividend FY
              </span>
              <button
                type="button"
                onClick={() => onDividendFiscalYearChange("082-083")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-mono text-xs font-medium transition-all outline-none",
                  dividendFiscalYear === "082-083"
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                082-083 (Current)
              </button>
              <button
                type="button"
                onClick={() => onDividendFiscalYearChange("081-082")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-mono text-xs font-medium transition-all outline-none",
                  dividendFiscalYear === "081-082"
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                081-082
              </button>
              <select
                value={["082-083", "081-082"].includes(dividendFiscalYear) ? "" : dividendFiscalYear}
                onChange={(e) => {
                  if (e.target.value) onDividendFiscalYearChange(e.target.value);
                }}
                className={cn(
                  "h-7 px-2 text-xs rounded-md border border-input bg-background font-mono focus:outline-none cursor-pointer",
                  !["082-083", "081-082"].includes(dividendFiscalYear)
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Select other fiscal years"
              >
                <option value="" disabled className="bg-background text-foreground">
                  More FYs...
                </option>
                <option value="080-081" className="bg-background text-foreground">
                  080-081
                </option>
                <option value="079-080" className="bg-background text-foreground">
                  079-080
                </option>
                <option value="latest" className="bg-background text-foreground">
                  All-Time Latest
                </option>
              </select>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by symbol, company, or sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Search Results Count */}
        {searchQuery && (
          <p className="mt-2 text-xs text-muted-foreground">
            Found {filteredHoldings.length} of {holdings.length} stocks
          </p>
        )}
      </div>
      <div className="max-h-[500px] overflow-auto scrollbar-thin relative">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 bg-card z-10 shadow-sm [&_tr]:border-b">
            <tr className="border-b transition-colors bg-card">
              <TableHead className={cn("w-12", columnColors.index)}>#</TableHead>
              <TableHead><SortableHeader label="Symbol" sortKeyName="scrip" colorClass={columnColors.symbol} /></TableHead>
              <TableHead className={cn("hidden lg:table-cell", columnColors.company)}>Company</TableHead>
              <TableHead><SortableHeader label="Qty" sortKeyName="quantity" colorClass={columnColors.qty} /></TableHead>
              <TableHead><SortableHeader label="Avg. Cost" sortKeyName="waccRate" colorClass={columnColors.avgCost} /></TableHead>
              <TableHead><SortableHeader label="LTP" sortKeyName="currentPrice" colorClass={columnColors.ltp} /></TableHead>
              <TableHead><SortableHeader label="Value" sortKeyName="currentValue" colorClass={columnColors.value} /></TableHead>
              <TableHead><SortableHeader label="Gain/Loss" sortKeyName="gainLossPercent" colorClass="text-emerald-500" /></TableHead>
              <TableHead>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SortableHeader
                      label={dividendFiscalYear === "latest" ? "Dividend (Latest)" : `Dividend (${dividendFiscalYear})`}
                      sortKeyName="totalDividendValue"
                      colorClass={columnColors.dividend}
                    >
                      <Gift className="h-3 w-3" />
                    </SortableHeader>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">
                      <strong>FY {dividendFiscalYear} Dividend:</strong><br />
                      Shows declared cash and bonus dividends for FY {dividendFiscalYear}. Click the Dividend FY toggle buttons above the table to switch between current (082-083) and past years.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SortableHeader label="Book Val" sortKeyName="liveBookValue" colorClass={columnColors.bookVal}>
                      <Info className="h-3 w-3" />
                    </SortableHeader>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Book Value per Share:</strong><br />
                      Net asset value divided by outstanding shares.
                      Compare with LTP to assess if stock is undervalued.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SortableHeader label="P/B" sortKeyName="livePbRatio" colorClass={columnColors.pb}>
                      <Info className="h-3 w-3" />
                    </SortableHeader>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Price-to-Book Ratio:</strong><br />
                      &lt; 1.0 = Potentially undervalued<br />
                      1.0-1.5 = Fair value<br />
                      1.5-2.5 = Slightly overvalued<br />
                      &gt; 2.5 = May be overvalued
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className={cn("hidden md:table-cell font-semibold", columnColors.sector)}>Sector</TableHead>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {sortedHoldings.map((holding, index) => (
              <TableRow key={holding.scrip} className="table-row-hover">
                <TableCell className={cn("font-mono", columnColors.index)}>{index + 1}</TableCell>
                <TableCell>
                  <StockSymbolLink
                    symbol={holding.scrip}
                    className={cn("font-semibold", columnColors.symbol)}
                  />
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm max-w-[200px] truncate">
                  <Link
                    to={`/quarterly?symbol=${holding.scrip}`}
                    className={cn(
                      columnColors.company,
                      "border-b border-dashed border-muted-foreground/45 hover:border-solid hover:border-primary hover:text-primary transition-all cursor-pointer inline-block max-w-full"
                    )}
                  >
                    {holding.fullName}
                  </Link>
                </TableCell>
                <TableCell className={cn("font-mono", columnColors.qty)}>{holding.quantity.toLocaleString()}</TableCell>
                <TableCell className={cn("font-mono text-sm", columnColors.avgCost)}>{formatCurrency(holding.waccRate)}</TableCell>
                <TableCell className={cn("font-mono", columnColors.ltp)}>{formatCurrency(holding.currentPrice)}</TableCell>
                <TableCell className={cn("font-mono font-medium", columnColors.value)}>{formatCurrency(holding.currentValue)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {holding.gainLoss >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <span
                      className={cn(
                        "font-mono font-medium",
                        holding.gainLoss >= 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {formatPercent(holding.gainLossPercent)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {(holding.latestDividendPercent && holding.latestDividendPercent > 0) || holding.latestBonusRatio ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-start gap-0.5">
                          {holding.latestDividendPercent && holding.latestDividendPercent > 0 && (
                            <>
                              <span className={cn("font-mono font-medium text-xs", columnColors.dividend)}>
                                Cash: {holding.latestDividendPercent.toFixed(1)}%
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                Rs. {holding.dividendIncome?.toLocaleString("en-NP", { maximumFractionDigits: 0 }) || 0}
                              </span>
                            </>
                          )}
                          {holding.latestBonusRatio && (
                            <>
                              <span className="font-mono font-medium text-xs text-emerald-400">
                                Bonus: {holding.latestBonusRatio}
                              </span>
                              {(!holding.latestDividendPercent || holding.latestDividendPercent === 0) && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {holding.bonusShares
                                    ? `+${holding.bonusShares} sh (${formatCurrency(holding.bonusShareValue || 0)})`
                                    : (holding.bonusShareValue ? formatCurrency(holding.bonusShareValue) : "")}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs space-y-1">
                          {holding.latestDividendFiscalYear && (
                            <div className="font-semibold text-primary pb-0.5 border-b border-border/50">
                              FY {holding.latestDividendFiscalYear} Dividend
                            </div>
                          )}
                          {holding.latestDividendPercent && holding.latestDividendPercent > 0 && (
                            <div>
                              <strong>Cash: {holding.latestDividendPercent}%</strong><br />
                              Estimated income: Rs. {holding.dividendIncome?.toLocaleString("en-NP") || 0}
                            </div>
                          )}
                          {holding.latestBonusRatio && (
                            <div>
                              <strong>Bonus: {holding.latestBonusRatio}</strong><br />
                              Bonus shares: {holding.bonusShares || 0}<br />
                              Value: Rs. {holding.bonusShareValue?.toLocaleString("en-NP") || 0}
                            </div>
                          )}
                          {(holding.totalDividendValue || 0) > 0 && (
                            <div className="pt-1 border-t border-border/50 font-semibold text-foreground">
                              Total Dividend Value: Rs. {(holding.totalDividendValue || ((holding.dividendIncome || 0) + (holding.bonusShareValue || 0))).toLocaleString("en-NP", { maximumFractionDigits: 0 })}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {holding.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "font-mono font-medium",
                          columnColors.bookVal
                        )}>
                          {holding.liveBookValue !== null && holding.liveBookValue !== undefined
                            ? `Rs. ${holding.liveBookValue.toFixed(2)}`
                            : holding.bookValue
                              ? `Rs. ${holding.bookValue.toFixed(2)}`
                              : "N/A"
                          }
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">
                          {holding.liveBookValue !== null && holding.liveBookValue !== undefined
                            ? "Live book value from Merolagani"
                            : "Fallback data"
                          }
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>
                  {holding.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <span className={cn(
                      "font-mono font-medium",
                      columnColors.pb
                    )}>
                      {holding.livePbRatio !== null && holding.livePbRatio !== undefined
                        ? holding.livePbRatio.toFixed(2)
                        : holding.pbRatio?.toFixed(2) || "N/A"
                      }
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className={cn("text-xs", columnColors.sector)}>
                    {holding.sector}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
