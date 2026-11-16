import { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchMultipleFundamentals, MerolaganiFundamentals } from "@/services/merolaganiApi";
import { StockSymbolLink } from "@/components/StockSymbolLink";
import { toast } from "@/hooks/use-toast";
import { getCachedStockData } from "@/services/sharebazaarApi";
import { Link } from "react-router-dom";
import { translate, useT } from "@/i18n";
import { fmtDate, fmtMoney, fmtNumber } from "@/i18n/format";

interface WatchlistEntry {
  symbol: string;
  company: string;
  dateAdded: string;
}

// A price is only meaningful if somebody actually traded at it recently. NEPSE
// has many thinly-traded names whose "last price" is months old and often set by
// a single-share trade -- their P/E and P/B are arithmetically correct and
// economically meaningless, and they sweep any cheapness screen. 5 calendar days
// ~= one full NEPSE trading week (Sun-Thu), which also absorbs viewing the table
// on a Friday or Saturday. Kept in sync with STALE_PRICE_DAYS in
// tools/archive_fundamentals.py.
const STALE_PRICE_DAYS = 5;

/** Days between the last actual trade and today, or null if unknown. */
const daysSinceTrade = (lastTradeDate?: string | null): number | null => {
  if (!lastTradeDate) return null;
  const then = Date.parse(`${lastTradeDate}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const today = new Date();
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - then) / 86_400_000);
};

/**
 * "Old price" chip shown beside the LTP when the last actual trade is older
 * than STALE_PRICE_DAYS. Renders nothing for normally-traded stocks, so the
 * table stays quiet and the badge means something when it does appear.
 * Opens on tap (Popover) so it works on phones.
 */
const StalePriceBadge = ({ fundamentals }: { fundamentals?: MerolaganiFundamentals | null }) => {
  const { t } = useT();
  const days = daysSinceTrade(fundamentals?.lastTradeDate);
  if (days === null || days <= STALE_PRICE_DAYS) return null;

  const volume = fundamentals?.tradeVolume;
  const turnover = fundamentals?.tradeTurnover;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex min-h-[44px] items-center md:min-h-0" aria-label={t("watchlist.staleTitle", { days })}>
          <Badge variant="outline" className="h-5 gap-1 border-warning/40 bg-warning/10 px-1.5 text-[11px] font-medium text-warning">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {t("watchlist.stale")}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm leading-relaxed" align="start">
        <p className="font-medium">
          {t("watchlist.staleTitle", { days })} ({fmtDate(fundamentals?.lastTradeDate)})
        </p>
        {volume != null && (
          <p className="mt-1 text-muted-foreground">
            {t("watchlist.staleVolume", { n: fmtNumber(volume) })}
            {turnover != null && ` ${t("watchlist.staleTurnover", { amount: fmtMoney(turnover) })}`}
          </p>
        )}
        <p className="mt-1 text-muted-foreground">{t("watchlist.staleNote")}</p>
      </PopoverContent>
    </Popover>
  );
};

interface EnhancedWatchlistEntry extends WatchlistEntry {
  fundamentals?: MerolaganiFundamentals | null;
  ltp?: number;
  isLoading: boolean;
}

const fmtRatio = (v?: number | null) => (v === undefined || v === null || Number.isNaN(v) ? "-" : v.toFixed(2));
const fmtPrice = (v?: number | null) => (v === undefined || v === null ? "-" : fmtMoney(v, true));

/** One watchlist entry as a card, used below the md breakpoint. */
const WatchlistCard = ({ item, onRemove }: { item: EnhancedWatchlistEntry; onRemove: (s: string) => void }) => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const detailsId = `watch-more-${item.symbol}`;
  const f = item.fundamentals;

  return (
    <li className="surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <StockSymbolLink symbol={item.symbol} className="font-semibold text-primary text-base" />
          <Link
            to={`/quarterly?symbol=${item.symbol}`}
            className="block truncate text-sm text-muted-foreground hover:text-primary"
            title={item.company}
          >
            {item.company}
          </Link>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(item.symbol)}
          className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t("watchlist.remove", { symbol: item.symbol })}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2">
        <p className="text-xs text-muted-foreground">{t("watchlist.colLtp")}</p>
        {item.isLoading ? (
          <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" aria-label={t("common.loading")} />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xl font-bold">{fmtPrice(item.ltp ?? f?.lastTradedPrice)}</span>
            <StalePriceBadge fundamentals={f} />
          </div>
        )}
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
            <dt className="text-muted-foreground">{t("watchlist.colEps")}</dt>
            <dd className="font-mono">{item.isLoading ? "-" : fmtRatio(f?.eps)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("watchlist.colBookValue")}</dt>
            <dd className="font-mono">{item.isLoading ? "-" : fmtPrice(f?.bookValue)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("watchlist.colPb")}</dt>
            <dd className="font-mono">{item.isLoading ? "-" : fmtRatio(f?.pbRatio)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("watchlist.colPe")}</dt>
            <dd className="font-mono">{item.isLoading ? "-" : fmtRatio(f?.peRatio)}</dd>
          </div>
        </dl>
      )}
    </li>
  );
};

export const WatchlistTable = () => {
  const { t } = useT();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [enhancedWatchlist, setEnhancedWatchlist] = useState<EnhancedWatchlistEntry[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [newSymbol, setNewSymbol] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch watchlist from DB
  const fetchWatchlist = async () => {
    try {
      setIsLoadingDB(true);
      const url = import.meta.env.DEV
        ? '/api/portfolio-db/api/watchlist'
        : 'http://localhost:5001/api/watchlist';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.watchlist || []);
      }
    } catch (e) {
      console.error("Failed to load watchlist", e);
    } finally {
      setIsLoadingDB(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  // Fetch fundamentals for watchlist symbols
  useEffect(() => {
    const fetchFundamentals = async () => {
      if (watchlist.length === 0) {
        setEnhancedWatchlist([]);
        return;
      }

      setEnhancedWatchlist(watchlist.map(w => ({ ...w, isLoading: true })));

      try {
        const symbols = watchlist.map(w => w.symbol);
        const fundamentalsMap = await fetchMultipleFundamentals(symbols, true);
        const ltpMap = await getCachedStockData(symbols);

        setEnhancedWatchlist(watchlist.map(w => ({
          ...w,
          fundamentals: fundamentalsMap.get(w.symbol) || null,
          ltp: ltpMap.get(w.symbol)?.ltp,
          isLoading: false
        })));
      } catch (e) {
        console.error("Failed to fetch fundamentals for watchlist", e);
        setEnhancedWatchlist(watchlist.map(w => ({ ...w, isLoading: false })));
      }
    };

    fetchFundamentals();
  }, [watchlist]);

  // Re-scrape fundamentals for watchlist symbols (direct NepseAlpha fetch,
  // no API key) then reload the table.
  const handleRefreshFundamentals = async () => {
    if (watchlist.length === 0 || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const url = import.meta.env.DEV
        ? '/api/portfolio-db/api/fundamentals/refresh'
        : 'http://localhost:5001/api/fundamentals/refresh';
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: watchlist.map(w => w.symbol) })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast({ title: translate("watchlist.toastRefreshed"), description: translate("watchlist.toastRefreshedBody") });
        await fetchWatchlist(); // retriggers the fundamentals fetch effect
      } else if (res.ok && data.partial) {
        toast({
          title: translate("watchlist.toastPartial"),
          description: translate("watchlist.toastPartialBody", {
            symbols: (data.failed_symbols || []).join(", ") || translate("watchlist.unknown"),
          }),
        });
        await fetchWatchlist(); // still show what succeeded
      } else {
        toast({
          title: translate("watchlist.toastRefreshFailed"),
          description: data.error
            || (data.failed_symbols?.length
              ? translate("watchlist.toastFailedSymbols", { symbols: data.failed_symbols.join(", ") })
              : translate("watchlist.toastServerDown")),
          variant: "destructive"
        });
      }
    } catch (e) {
      toast({ title: translate("watchlist.toastRefreshFailed"), description: translate("watchlist.toastServerUnreachable"), variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;

    const symbol = newSymbol.trim().toUpperCase();
    setIsAdding(true);

    try {
      const url = import.meta.env.DEV
        ? '/api/portfolio-db/api/watchlist/add'
        : 'http://localhost:5001/api/watchlist/add';
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.action === "exists") {
          toast({ title: translate("watchlist.toastExists"), description: translate("watchlist.toastExistsBody", { symbol }) });
        } else {
          toast({ title: translate("watchlist.toastAdded"), description: translate("watchlist.toastAddedBody", { symbol }) });
          setWatchlist(data.watchlist);
          setNewSymbol("");
        }
      }
    } catch (e) {
      toast({ title: translate("watchlist.toastError"), description: translate("watchlist.toastAddFailed"), variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    try {
      const url = import.meta.env.DEV
        ? `/api/portfolio-db/api/watchlist?symbol=${symbol}`
        : `http://localhost:5001/api/watchlist?symbol=${symbol}`;
      const res = await fetch(url, {
        method: "DELETE"
      });

      if (res.ok) {
        const data = await res.json();
        toast({ title: translate("watchlist.toastRemoved"), description: translate("watchlist.toastRemovedBody", { symbol }) });
        setWatchlist(data.watchlist);
      }
    } catch (e) {
      toast({ title: translate("watchlist.toastError"), description: translate("watchlist.toastRemoveFailed"), variant: "destructive" });
    }
  };

  const loader = <Loader2 className="h-4 w-4 animate-spin" aria-label={t("common.loading")} />;

  return (
    <div className="surface overflow-hidden mt-6">
      <div className="p-4 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {t("watchlist.title")}
          <Badge variant="secondary" className="font-mono">
            {t("watchlist.count", { n: watchlist.length })}
          </Badge>
          {isLoadingDB && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t("common.loading")} />}
        </h3>

        <div className="flex gap-2 w-full md:w-auto items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshFundamentals}
                disabled={isRefreshing || watchlist.length === 0}
                className="shrink-0 h-11 md:h-9"
                aria-label={t("watchlist.refreshHint")}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
                <span className="hidden sm:inline ml-1">{isRefreshing ? t("watchlist.refreshing") : t("common.refresh")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("watchlist.refreshHint")}</TooltipContent>
          </Tooltip>
          <form onSubmit={handleAddSymbol} className="flex gap-2 w-full md:w-auto">
            <Input
              placeholder={t("watchlist.addPlaceholder")}
              aria-label={t("watchlist.addPlaceholder")}
              value={newSymbol}
              onChange={e => setNewSymbol(e.target.value)}
              className="w-full md:w-48 h-11 md:h-9 uppercase text-base md:text-sm"
              maxLength={10}
            />
            <Button type="submit" size="sm" disabled={isAdding || !newSymbol.trim()} className="shrink-0 h-11 md:h-9">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4 mr-1" aria-hidden="true" />}
              {t("watchlist.add")}
            </Button>
          </form>
        </div>
      </div>

      {/* Phones: one card per stock */}
      <div className="md:hidden p-3">
        {enhancedWatchlist.length === 0 ? (
          <p className="py-8 text-center text-sm leading-relaxed text-muted-foreground">{t("watchlist.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {enhancedWatchlist.map((item) => (
              <WatchlistCard key={item.symbol} item={item} onRemove={handleRemoveSymbol} />
            ))}
          </ul>
        )}
      </div>

      {/* Tablets and desktops: table */}
      <div className="hidden md:block max-h-[500px] overflow-auto scrollbar-thin relative">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 bg-card z-10 shadow-sm [&_tr]:border-b">
            <tr className="border-b transition-colors bg-card">
              <TableHead className="w-12 text-muted-foreground">#</TableHead>
              <TableHead className="font-semibold text-foreground">{t("watchlist.colSymbol")}</TableHead>
              <TableHead className="hidden lg:table-cell font-semibold text-foreground">{t("watchlist.colCompany")}</TableHead>
              <TableHead className="font-semibold text-foreground">{t("watchlist.colLtp")}</TableHead>
              <TableHead className="font-semibold text-foreground">{t("watchlist.colEps")}</TableHead>
              <TableHead className="font-semibold text-foreground">{t("watchlist.colBookValue")}</TableHead>
              <TableHead className="font-semibold text-foreground">{t("watchlist.colPb")}</TableHead>
              <TableHead className="font-semibold text-foreground">{t("watchlist.colPe")}</TableHead>
              <TableHead className="w-12 text-right"><span className="sr-only">{t("watchlist.actions")}</span></TableHead>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {enhancedWatchlist.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                  {t("watchlist.empty")}
                </TableCell>
              </TableRow>
            ) : (
              enhancedWatchlist.map((item, index) => (
                <TableRow key={item.symbol} className="table-row-hover">
                  <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <StockSymbolLink symbol={item.symbol} className="font-semibold text-primary" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm max-w-[200px] truncate">
                    <Link
                      to={`/quarterly?symbol=${item.symbol}`}
                      className="text-muted-foreground border-b border-dashed border-muted-foreground/45 hover:border-solid hover:border-primary hover:text-primary transition-colors cursor-pointer inline-block max-w-full"
                    >
                      {item.company}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {item.isLoading ? loader : (
                      <span className="inline-flex items-center gap-1.5">
                        {fmtPrice(item.ltp ?? item.fundamentals?.lastTradedPrice)}
                        <StalePriceBadge fundamentals={item.fundamentals} />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {item.isLoading ? loader : fmtRatio(item.fundamentals?.eps)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {item.isLoading ? loader : fmtPrice(item.fundamentals?.bookValue)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {item.isLoading ? loader : fmtRatio(item.fundamentals?.pbRatio)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {item.isLoading ? loader : fmtRatio(item.fundamentals?.peRatio)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSymbol(item.symbol)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={t("watchlist.remove", { symbol: item.symbol })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
