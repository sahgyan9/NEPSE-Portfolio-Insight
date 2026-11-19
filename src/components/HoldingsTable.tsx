import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Info, Loader2, Search, X, Gift, ChevronDown } from "lucide-react";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StockHolding } from "@/data/portfolioData";
import { fetchMultipleFundamentals } from "@/services/merolaganiApi";
import { StockSymbolLink } from "@/components/StockSymbolLink";
import { useT } from "@/i18n";
import { fmtMoney, fmtNumber, fmtPercent } from "@/i18n/format";
import { useViewMode } from "@/hooks/useViewMode";

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
  /** Previous trading day's closing price, from the live feed (absent when the feed had none). */
  previousClose?: number;
  /** quantity x (price now - previous close); null when either price is missing. */
  dayChange?: number | null;
  /** Percent move of the share price since the previous close. */
  dayChangePercent?: number | null;
}

/** Adds the one-day change for a holding. Same rule as the portfolio total in useLivePortfolio. */
const withDayChange = (h: EnhancedHolding): EnhancedHolding => {
  const prev = h.previousClose;
  if (!prev || prev <= 0 || !(h.currentPrice > 0)) return { ...h, dayChange: null, dayChangePercent: null };
  return {
    ...h,
    dayChange: h.quantity * (h.currentPrice - prev),
    dayChangePercent: ((h.currentPrice - prev) / prev) * 100,
  };
};

type SortKey = keyof StockHolding | "liveBookValue" | "livePbRatio" | "totalDividendValue" | "dayChange";
type SortOrder = "asc" | "desc";

/** Options for the single sort control shown above the phone card list. */
const MOBILE_SORTS: { value: string; key: SortKey; order: SortOrder; label: string }[] = [
  { value: "currentValue:desc", key: "currentValue", order: "desc", label: "holdings.sortValueDesc" },
  { value: "dayChange:asc", key: "dayChange", order: "asc", label: "holdings.sortTodayAsc" },
  { value: "dayChange:desc", key: "dayChange", order: "desc", label: "holdings.sortTodayDesc" },
  { value: "gainLoss:desc", key: "gainLoss", order: "desc", label: "holdings.sortGainDesc" },
  { value: "gainLossPercent:desc", key: "gainLossPercent", order: "desc", label: "holdings.sortGainPctDesc" },
  { value: "gainLossPercent:asc", key: "gainLossPercent", order: "asc", label: "holdings.sortGainPctAsc" },
  { value: "totalDividendValue:desc", key: "totalDividendValue", order: "desc", label: "holdings.sortDividendDesc" },
  { value: "quantity:desc", key: "quantity", order: "desc", label: "holdings.sortKittaDesc" },
  { value: "scrip:asc", key: "scrip", order: "asc", label: "holdings.sortSymbolAsc" },
];

/** Right edge of the pinned Symbol column, so scrolled columns visibly pass under it. */
const PIN_EDGE = "shadow-[inset_-1px_0_0_hsl(var(--border))]";

const bookValueOf = (h: EnhancedHolding): number | null =>
  h.liveBookValue !== null && h.liveBookValue !== undefined ? h.liveBookValue : h.bookValue ?? null;

const pbOf = (h: EnhancedHolding): number | null =>
  h.livePbRatio !== null && h.livePbRatio !== undefined ? h.livePbRatio : h.pbRatio ?? null;

const hasDividend = (h: EnhancedHolding) =>
  (!!h.latestDividendPercent && h.latestDividendPercent > 0) || !!h.latestBonusRatio;

/** Profit or loss with an icon and a word, so colour is never the only signal. */
const GainLoss = ({ holding, size = "sm" }: { holding: EnhancedHolding; size?: "sm" | "lg" }) => {
  const { t } = useT();
  const up = holding.gainLoss >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className={cn("flex items-center gap-1.5", up ? "text-success" : "text-destructive")}>
      <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
      <span className={cn("font-medium", size === "lg" ? "text-base" : "text-sm")}>
        {up ? t("holdings.gain") : t("holdings.loss")}
      </span>
      <span className={cn("font-mono font-medium", size === "lg" ? "text-base" : "text-sm")}>
        {fmtMoney(Math.abs(holding.gainLoss))}
      </span>
      <span className="font-mono text-xs">({fmtPercent(holding.gainLossPercent, 2)})</span>
    </div>
  );
};

/** One-day change in rupees and percent, with an icon so colour is not the only signal. */
const DayChange = ({ holding, size = "sm" }: { holding: EnhancedHolding; size?: "sm" | "lg" }) => {
  const { t } = useT();
  const v = holding.dayChange;
  if (v === null || v === undefined) return <span className="text-xs text-muted-foreground">-</span>;
  const flat = Math.abs(v) < 0.5;
  const up = v > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className={cn("flex items-center gap-1.5 whitespace-nowrap", flat ? "text-muted-foreground" : up ? "text-success" : "text-destructive")}>
      {!flat && <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />}
      {!flat && <span className="sr-only">{up ? t("holdings.gain") : t("holdings.loss")}</span>}
      <span className={cn("font-mono font-medium", size === "lg" ? "text-base" : "text-sm")}>
        {flat ? "" : up ? "+" : "-"}
        {fmtMoney(Math.abs(v))}
      </span>
      {holding.dayChangePercent !== null && holding.dayChangePercent !== undefined && (
        <span className="font-mono text-xs">({fmtPercent(holding.dayChangePercent, 2)})</span>
      )}
    </div>
  );
};

/** Short dividend summary (cash % and amount, bonus ratio and kitta). */
const DividendLines = ({ holding }: { holding: EnhancedHolding }) => {
  const { t } = useT();
  if (!hasDividend(holding)) return <span className="text-xs text-muted-foreground">-</span>;
  const hasCash = !!holding.latestDividendPercent && holding.latestDividendPercent > 0;
  return (
    <div className="flex flex-col items-start gap-0.5">
      {hasCash && (
        <>
          <span className="font-mono font-medium text-xs text-foreground">
            {t("holdings.cashShort", { pct: fmtPercent(holding.latestDividendPercent, 1, false) })}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{fmtMoney(holding.dividendIncome ?? 0)}</span>
        </>
      )}
      {holding.latestBonusRatio && (
        <>
          <span className="font-mono font-medium text-xs text-foreground">
            {t("holdings.bonusShort", { ratio: holding.latestBonusRatio })}
          </span>
          {!hasCash && (
            <span className="font-mono text-xs text-muted-foreground">
              {holding.bonusShares
                ? t("holdings.bonusKitta", { n: fmtNumber(holding.bonusShares), value: fmtMoney(holding.bonusShareValue || 0) })
                : holding.bonusShareValue
                  ? fmtMoney(holding.bonusShareValue)
                  : ""}
            </span>
          )}
        </>
      )}
    </div>
  );
};

/** One holding as a card, used below the md breakpoint. */
const HoldingCard = ({ holding, isSimple }: { holding: EnhancedHolding; isSimple: boolean }) => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const detailsId = `holding-more-${holding.scrip}`;
  const book = bookValueOf(holding);
  const pb = pbOf(holding);

  return (
    <li className="surface p-4">
      <div className="flex items-baseline gap-2 min-w-0">
        <StockSymbolLink symbol={holding.scrip} className="font-semibold text-primary text-base shrink-0" />
        <Link
          to={`/quarterly?symbol=${holding.scrip}`}
          className="truncate text-sm text-muted-foreground hover:text-primary"
          title={holding.fullName}
        >
          {holding.fullName}
        </Link>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm leading-relaxed">
        <div>
          <dt className="text-muted-foreground">{t("holdings.colKitta")}</dt>
          <dd className="font-mono">{fmtNumber(holding.quantity)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("holdings.colAvgCost")}</dt>
          <dd className="font-mono">{fmtMoney(holding.waccRate, true)}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="text-xs text-muted-foreground">{t("holdings.colValue")}</p>
        <p className="font-mono text-2xl font-bold text-foreground">{fmtMoney(holding.currentValue)}</p>
      </div>

      <div className="mt-1">
        <GainLoss holding={holding} size="lg" />
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("holdings.colToday")}</span>
        <DayChange holding={holding} />
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailsId}
        className="mt-2 -mx-1 flex min-h-[44px] w-full items-center justify-between rounded-md px-1 text-sm font-medium text-primary"
      >
        {open ? t("common.seeLess") : t("common.seeMore")}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <dl id={detailsId} className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-sm leading-relaxed">
          <div>
            <dt className="text-muted-foreground">{t("holdings.colLtp")}</dt>
            <dd className="font-mono">{fmtMoney(holding.currentPrice, true)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("holdings.colSector")}</dt>
            <dd>{holding.sector}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">{t("holdings.dividendHeading")}</dt>
            <dd>
              <DividendLines holding={holding} />
            </dd>
          </div>
          {!isSimple && (
            <>
              <div>
                <dt className="text-muted-foreground">{t("holdings.colBookValue")}</dt>
                <dd className="font-mono">
                  {holding.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : book !== null ? fmtMoney(book, true) : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("holdings.colPb")}</dt>
                <dd className="font-mono">
                  {holding.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : pb !== null ? pb.toFixed(2) : "-"}
                </dd>
              </div>
            </>
          )}
        </dl>
      )}
    </li>
  );
};

export const HoldingsTable = ({
  holdings,
  dividendFiscalYear = "082-083",
  onDividendFiscalYearChange,
}: HoldingsTableProps) => {
  const { t } = useT();
  const { isSimple } = useViewMode();
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
      setEnhancedHoldings(holdings.map(h => withDayChange({ ...h, isLoading: true })));

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

            return withDayChange({
              ...holding,
              liveBookValue,
              livePbRatio,
              isLoading: false,
            });
          }
          return withDayChange({ ...holding, isLoading: false });
        }));
      } catch (error) {
        console.error("Failed to fetch fundamentals:", error);
        setEnhancedHoldings(holdings.map(h => withDayChange({ ...h, isLoading: false })));
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
      // Shares with no day change (no price today) always sort to the bottom.
      if (sortKey === "dayChange") {
        const av = a.dayChange, bv = b.dayChange;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortOrder === "asc" ? av - bv : bv - av;
      }
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

  // forwardRef and prop spreading let Radix TooltipTrigger asChild attach its ref and handlers.
  const SortableHeader = React.forwardRef<
    HTMLButtonElement,
    {
      label: string;
      sortKeyName: SortKey;
      children?: React.ReactNode;
    } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">
  >(({ label, sortKeyName, children, className, onClick, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        handleSort(sortKeyName);
      }}
      className={cn(
        "flex items-center gap-1 text-left font-semibold text-foreground hover:text-primary transition-colors",
        sortKey === sortKeyName && "text-primary",
        className
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3 shrink-0" aria-hidden="true" />
      {children}
    </button>
  ));
  SortableHeader.displayName = "SortableHeader";

  const fyButton = (fy: string, label: string) => (
    <button
      type="button"
      onClick={() => onDividendFiscalYearChange?.(fy)}
      aria-pressed={dividendFiscalYear === fy}
      className={cn(
        "min-h-[44px] md:min-h-0 md:h-7 px-2.5 rounded-md font-mono text-xs font-medium transition-colors outline-none",
        dividendFiscalYear === fy
          ? "bg-primary text-primary-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      )}
    >
      {label}
    </button>
  );

  const isOtherFy = !["082-083", "081-082"].includes(dividendFiscalYear);
  const dividendHeader =
    dividendFiscalYear === "latest"
      ? t("holdings.colDividendLatest")
      : t("holdings.colDividend", { fy: dividendFiscalYear });
  const mobileSortValue = `${String(sortKey)}:${sortOrder}`;

  return (
    <div className="surface overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h3 className="text-lg font-semibold flex flex-wrap items-center gap-2">
            {t("holdings.title")}
            <Badge variant="secondary" className="font-mono">
              {t("holdings.stocksCount", { n: holdings.length })}
            </Badge>
            {isLoadingFundamentals && (
              <Badge variant="outline" className="gap-1 font-normal">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                {t("holdings.loadingFundamentals")}
              </Badge>
            )}
          </h3>

          {onDividendFiscalYearChange && (
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border text-xs self-stretch md:self-auto">
              <span className="text-muted-foreground font-semibold px-2 text-xs">
                {t("holdings.dividendFy")}
              </span>
              {fyButton("082-083", t("holdings.fyCurrent", { fy: "082-083" }))}
              {fyButton("081-082", "081-082")}
              <select
                value={isOtherFy ? dividendFiscalYear : ""}
                onChange={(e) => {
                  if (e.target.value) onDividendFiscalYearChange(e.target.value);
                }}
                className={cn(
                  "min-h-[44px] md:min-h-0 md:h-7 px-2 text-xs rounded-md border border-input bg-background font-mono focus:outline-none cursor-pointer",
                  isOtherFy ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
                title={t("holdings.moreFysTitle")}
                aria-label={t("holdings.moreFysTitle")}
              >
                <option value="" disabled className="bg-background text-foreground">
                  {t("holdings.moreFys")}
                </option>
                <option value="080-081" className="bg-background text-foreground">080-081</option>
                <option value="079-080" className="bg-background text-foreground">079-080</option>
                <option value="latest" className="bg-background text-foreground">
                  {t("holdings.allTimeLatest")}
                </option>
              </select>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={t("holdings.searchPlaceholder")}
            aria-label={t("holdings.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-11 h-11 md:h-9 text-base md:text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-10 w-10 md:h-7 md:w-7"
              onClick={() => setSearchQuery("")}
              aria-label={t("holdings.clearSearch")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Search Results Count */}
        {searchQuery && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("holdings.foundCount", { shown: filteredHoldings.length, total: holdings.length })}
          </p>
        )}

        {/* Phone sort control */}
        <div className="mt-3 md:hidden">
          <label htmlFor="holdings-sort" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("holdings.sortLabel")}
          </label>
          <select
            id="holdings-sort"
            value={MOBILE_SORTS.some((s) => s.value === mobileSortValue) ? mobileSortValue : ""}
            onChange={(e) => {
              const opt = MOBILE_SORTS.find((s) => s.value === e.target.value);
              if (opt) {
                setSortKey(opt.key);
                setSortOrder(opt.order);
              }
            }}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {!MOBILE_SORTS.some((s) => s.value === mobileSortValue) && <option value="" disabled>-</option>}
            {MOBILE_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Phones: one card per holding */}
      <div className="md:hidden p-3">
        {sortedHoldings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {searchQuery ? t("holdings.emptySearch") : t("holdings.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {sortedHoldings.map((holding) => (
              <HoldingCard key={holding.scrip} holding={holding} isSimple={isSimple} />
            ))}
          </ul>
        )}
      </div>

      {/* Tablets and desktops: table */}
      <div className="hidden md:block max-h-[500px] overflow-auto scrollbar-thin relative">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 bg-card z-10 shadow-sm [&_tr]:border-b">
            <tr className="border-b transition-colors bg-card">
              <TableHead className="sticky left-0 z-20 w-12 min-w-12 bg-card text-muted-foreground">#</TableHead>
              <TableHead className={cn("sticky left-12 z-20 bg-card", PIN_EDGE)}>
                <SortableHeader label={t("holdings.colSymbol")} sortKeyName="scrip" />
              </TableHead>
              {!isSimple && <TableHead className="hidden lg:table-cell text-muted-foreground">{t("holdings.colCompany")}</TableHead>}
              <TableHead><SortableHeader label={t("holdings.colKitta")} sortKeyName="quantity" /></TableHead>
              <TableHead><SortableHeader label={t("holdings.colAvgCost")} sortKeyName="waccRate" /></TableHead>
              <TableHead><SortableHeader label={t("holdings.colLtp")} sortKeyName="currentPrice" /></TableHead>
              <TableHead><SortableHeader label={t("holdings.colValue")} sortKeyName="currentValue" /></TableHead>
              <TableHead><SortableHeader label={t("holdings.colGainLoss")} sortKeyName="gainLossPercent" /></TableHead>
              <TableHead>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SortableHeader label={t("holdings.colToday")} sortKeyName="dayChange">
                      <Info className="h-3 w-3" aria-hidden="true" />
                    </SortableHeader>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs leading-relaxed">{t("holdings.todayTip")}</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SortableHeader label={dividendHeader} sortKeyName="totalDividendValue">
                      <Gift className="h-3 w-3" aria-hidden="true" />
                    </SortableHeader>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs leading-relaxed">
                      <strong>{t("holdings.dividendTipTitle", { fy: dividendFiscalYear })}</strong>
                      <br />
                      {t("holdings.dividendTipBody", { fy: dividendFiscalYear })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              {!isSimple && (
                <>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SortableHeader label={t("holdings.colBookValue")} sortKeyName="liveBookValue">
                          <Info className="h-3 w-3" aria-hidden="true" />
                        </SortableHeader>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs leading-relaxed">
                          <strong>{t("holdings.bookValueTipTitle")}</strong>
                          <br />
                          {t("holdings.bookValueTipBody")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SortableHeader label={t("holdings.colPb")} sortKeyName="livePbRatio">
                          <Info className="h-3 w-3" aria-hidden="true" />
                        </SortableHeader>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs leading-relaxed">
                          <strong>{t("holdings.pbTipTitle")}</strong>
                          <br />
                          {t("holdings.pbTipBody")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">{t("holdings.colSector")}</TableHead>
                </>
              )}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {sortedHoldings.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSimple ? 9 : 13} className="h-20 text-center text-muted-foreground">
                  {searchQuery ? t("holdings.emptySearch") : t("holdings.empty")}
                </TableCell>
              </TableRow>
            )}
            {sortedHoldings.map((holding, index) => (
              <TableRow key={holding.scrip} className="table-row-hover">
                <TableCell className="sticky left-0 z-[1] w-12 min-w-12 bg-card font-mono text-muted-foreground">{index + 1}</TableCell>
                <TableCell className={cn("sticky left-12 z-[1] bg-card", PIN_EDGE)}>
                  <StockSymbolLink symbol={holding.scrip} className="font-semibold text-primary" />
                </TableCell>
                {!isSimple && (
                  <TableCell className="hidden lg:table-cell text-sm max-w-[200px] truncate">
                    <Link
                      to={`/quarterly?symbol=${holding.scrip}`}
                      className="text-muted-foreground border-b border-dashed border-muted-foreground/45 hover:border-solid hover:border-primary hover:text-primary transition-colors cursor-pointer inline-block max-w-full"
                    >
                      {holding.fullName}
                    </Link>
                  </TableCell>
                )}
                <TableCell className="font-mono">{fmtNumber(holding.quantity)}</TableCell>
                <TableCell className="font-mono text-sm">{fmtMoney(holding.waccRate, true)}</TableCell>
                <TableCell className="font-mono">{fmtMoney(holding.currentPrice, true)}</TableCell>
                <TableCell className="font-mono font-medium">{fmtMoney(holding.currentValue)}</TableCell>
                <TableCell>
                  <GainLoss holding={holding} />
                </TableCell>
                <TableCell>
                  <DayChange holding={holding} />
                </TableCell>
                <TableCell>
                  {hasDividend(holding) ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <DividendLines holding={holding} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs space-y-1 leading-relaxed">
                          {holding.latestDividendFiscalYear && (
                            <div className="font-semibold text-primary pb-0.5 border-b border-border/50">
                              {t("holdings.dividendTipTitle", { fy: holding.latestDividendFiscalYear })}
                            </div>
                          )}
                          {!!holding.latestDividendPercent && holding.latestDividendPercent > 0 && (
                            <div>
                              <strong>{t("holdings.cashShort", { pct: fmtPercent(holding.latestDividendPercent, 2, false) })}</strong>
                              <br />
                              {t("holdings.tipEstIncome", { amount: fmtMoney(holding.dividendIncome ?? 0) })}
                            </div>
                          )}
                          {holding.latestBonusRatio && (
                            <div>
                              <strong>{t("holdings.bonusShort", { ratio: holding.latestBonusRatio })}</strong>
                              <br />
                              {t("holdings.tipBonusShares", { n: fmtNumber(holding.bonusShares || 0) })}
                              <br />
                              {t("holdings.tipValue", { amount: fmtMoney(holding.bonusShareValue ?? 0) })}
                            </div>
                          )}
                          {(holding.totalDividendValue || 0) > 0 && (
                            <div className="pt-1 border-t border-border/50 font-semibold text-foreground">
                              {t("holdings.tipTotal", {
                                amount: fmtMoney(holding.totalDividendValue || ((holding.dividendIncome || 0) + (holding.bonusShareValue || 0))),
                              })}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                {!isSimple && (
                  <>
                    <TableCell>
                      {holding.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t("common.loading")} />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono font-medium">
                              {bookValueOf(holding) !== null ? fmtMoney(bookValueOf(holding), true) : "-"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">
                              {holding.liveBookValue !== null && holding.liveBookValue !== undefined
                                ? t("holdings.liveBookValue")
                                : t("holdings.fallbackBookValue")}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      {holding.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t("common.loading")} />
                      ) : (
                        <span className="font-mono font-medium">
                          {pbOf(holding) !== null ? (pbOf(holding) as number).toFixed(2) : "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {holding.sector}
                      </Badge>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
