import { useState, useEffect, useMemo } from "react";
import { dedupeNews } from "@/lib/newsDedupe";
import { Newspaper, ExternalLink, Loader2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { StockSymbolLink } from "@/components/StockSymbolLink";
import { StockHolding } from "@/data/portfolioData";
import { useT } from "@/i18n";
import { fmtDate } from "@/i18n/format";
import { normalizeUrl } from "@/lib/newsDedupe";
import { useNewsEvents, type NewsEvent } from "@/services/newsEventsApi";
import { EVENT_ICON, eventLabel, isInterpreted } from "@/components/news/eventText";

// nepse_server.py listens on 8002; the dev proxy targets the same port.
const NEPSE_BASE = import.meta.env.DEV ? "/api/nepse-server" : "http://localhost:8002";

interface NewsItem {
  headline: string;
  date: string;
  link: string;
}

interface NewsDB {
  [symbol: string]: NewsItem[];
}

interface PortfolioNewsFeedProps {
  holdings: StockHolding[];
}

export const PortfolioNewsFeed = ({ holdings }: PortfolioNewsFeedProps) => {
  const { t } = useT();
  const { data: eventsData, refetch: refetchEvents } = useNewsEvents();

  // Article URL -> event record, preferring one that can be interpreted.
  const eventByUrl = useMemo(() => {
    const map = new Map<string, NewsEvent>();
    for (const ev of eventsData?.events ?? []) {
      const key = normalizeUrl(ev.link);
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || (!isInterpreted(prev) && isInterpreted(ev))) map.set(key, ev);
    }
    return map;
  }, [eventsData]);
  const [newsDb, setNewsDb] = useState<NewsDB>({});
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // Fetch Watchlist
        const wlUrl = import.meta.env.DEV
          ? '/api/portfolio-db/api/watchlist'
          : 'http://localhost:5001/api/watchlist';
        const wlRes = await fetch(wlUrl);
        if (wlRes.ok) {
          const wlData = await wlRes.json();
          setWatchlistSymbols((wlData.watchlist || []).map((w: any) => w.symbol));
        }

        // Fetch News
        const newsRes = await fetch(`${NEPSE_BASE}/api/news`);
        if (newsRes.ok) {
          const newsData = await newsRes.json();
          setNewsDb(newsData);
        }
      } catch (e) {
        console.error("Failed to fetch news feed data", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [holdings]);

  const [isFetching, setIsFetching] = useState<string | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Heuristics to exclude mutual funds even if from watchlist without sector info
  const isMutualFund = (symbol: string) => {
    const mutualFundHoldings = new Set(holdings.filter(h => h.sector === 'Mutual Fund').map(h => h.scrip));
    if (mutualFundHoldings.has(symbol)) return true;
    if (symbol.endsWith('SF') || symbol.endsWith('Y') || symbol.match(/F[1-9]$/) || symbol.endsWith('BE')) return true;
    return false;
  };

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols(prev => 
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const selectAllNonMutual = () => {
    const allSymbols = Array.from(new Set([
      ...holdings.map(h => h.scrip),
      ...watchlistSymbols
    ]));
    setSelectedSymbols(allSymbols.filter(s => !isMutualFund(s)));
  };

  const clearSelection = () => setSelectedSymbols([]);

  const handleFetchSelected = async () => {
    if (selectedSymbols.length === 0) return;
    setIsFetching('MULTIPLE');
    
    toast({
      title: t("news.toastFetchingTitle"),
      description: t("news.toastFetchingDesc", { n: selectedSymbols.length }),
    });
    
    let successCount = 0;
    for (const symbol of selectedSymbols) {
      try {
        const res = await fetch(`${NEPSE_BASE}/api/news/fetch/${symbol}`, { method: "POST" });
        if (res.ok) successCount++;
      } catch (e) {
        console.error("Failed to fetch", symbol, e);
      }
    }
    
    // Refresh DB
    try {
      const newsRes = await fetch(`${NEPSE_BASE}/api/news`);
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setNewsDb(newsData);
      }
    } catch (e) {
      console.error("Failed to refresh news", e);
    }
    // The server re-extracts events in the background after each fetch.
    refetchEvents();

    toast({
      title: t("news.toastDoneTitle"),
      description: t("news.toastDoneDesc", { ok: successCount, total: selectedSymbols.length }),
    });
    setIsFetching(null);
    setSelectedSymbols([]); // clear selection after fetch
  };

  // Combine and sort all news for active symbols
  const activeNews = useMemo(() => {
    const activeSymbols = new Set([
      ...holdings.map(h => h.scrip),
      ...watchlistSymbols
    ]);

    const allNews: { symbol: string; news: NewsItem }[] = [];

    Object.entries(newsDb).forEach(([symbol, items]) => {
      if (activeSymbols.has(symbol)) {
        items.forEach(item => {
          allNews.push({ symbol, news: item });
        });
      }
    });

    // Sort by date (newest first). Sharesansar dates might be strings like "May 10, 2024" or "2024-05-10"
    const sorted = allNews.sort((a, b) => {
      const dateA = new Date(a.news.date).getTime();
      const dateB = new Date(b.news.date).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0; // Fallback if date is weird
      return dateB - dateA;
    });
    // One row per article, listing every symbol it is attached to
    return dedupeNews(sorted).slice(0, 50); // limit total rendered to prevent extreme lag
  }, [newsDb, holdings, watchlistSymbols]);

  const allActiveSymbolsArray = useMemo(() => Array.from(new Set([
    ...holdings.map(h => h.scrip),
    ...watchlistSymbols
  ])).sort(), [holdings, watchlistSymbols]);

  const filteredActiveNews = useMemo(() => {
    if (!searchQuery.trim()) return activeNews;
    const query = searchQuery.toLowerCase();
    return activeNews.filter(item => 
      item.symbols.some(sym => sym.toLowerCase().includes(query)) || 
      item.news.headline.toLowerCase().includes(query)
    );
  }, [activeNews, searchQuery]);

  const feedTitle = (
    <CardTitle className="text-lg flex items-center gap-2">
      <Newspaper className="w-5 h-5 text-primary" aria-hidden="true" />
      {t("news.feedTitle")}
    </CardTitle>
  );

  if (isLoading) {
    return (
      <Card className="surface">
        <CardHeader>{feedTitle}</CardHeader>
        <CardContent className="flex justify-center py-8" role="status" aria-label={t("common.loading")}>
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface h-[500px] flex flex-col">
      <CardHeader className="pb-3 border-b border-border space-y-4">
        <div className="flex items-center justify-between gap-2">
          {feedTitle}
          <Badge variant="secondary" className="font-mono shrink-0">
            {t("news.feedItems", { n: activeNews.length })}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          {/* Symbol selection row */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {allActiveSymbolsArray.map(sym => {
              const on = selectedSymbols.includes(sym);
              return (
                <button
                  key={sym}
                  type="button"
                  aria-pressed={on}
                  aria-label={t("news.symbolToggleAria", { symbol: sym })}
                  onClick={() => toggleSymbol(sym)}
                  className={
                    "min-h-[44px] sm:min-h-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors " +
                    (on ? "border-transparent bg-primary text-primary-foreground" : "border-border hover:bg-muted")
                  }
                >
                  {sym}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="min-h-[44px] sm:min-h-0 sm:h-8"
              disabled={selectedSymbols.length === 0 || isFetching !== null}
              onClick={handleFetchSelected}
            >
              {isFetching === 'MULTIPLE' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" /> : null}
              {t("news.fetchSelected", { n: selectedSymbols.length })}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className="min-h-[44px] sm:min-h-0 sm:h-8"
              onClick={selectAllNonMutual}
              disabled={isFetching !== null}
            >
              {t("news.selectAllStocks")}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] sm:min-h-0 sm:h-8"
              onClick={clearSelection}
              disabled={isFetching !== null || selectedSymbols.length === 0}
            >
              {t("news.clear")}
            </Button>
          </div>

          {/* Search/Filter Input */}
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              aria-label={t("news.filterAria")}
              placeholder={t("news.filterPlaceholder")}
              className="flex h-11 sm:h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-thin">
        {filteredActiveNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
            <Newspaper className="w-12 h-12 mb-2 opacity-20" aria-hidden="true" />
            {searchQuery ? (
              <p className="mb-4 text-sm leading-relaxed">{t("news.noMatch")}</p>
            ) : (
              <>
                <p className="mb-4 text-sm leading-relaxed">{t("news.noNews")}</p>
                <p className="text-sm leading-relaxed">{t("news.noNewsHint")}</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredActiveNews.map((item, i) => {
              const ev = eventByUrl.get(normalizeUrl(item.news.link) ?? "");
              const showLabel = ev && (isInterpreted(ev) || ev.is_roundup);
              const Icon = ev ? EVENT_ICON[ev.event_type] : Newspaper;
              return (
                <div key={`${item.symbols.join('-')}-${i}`} className="flex flex-col p-4 gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {item.symbols.map(sym => (
                        <StockSymbolLink key={sym} symbol={sym} />
                      ))}
                      <span className="text-xs text-muted-foreground">{fmtDate(item.news.date)}</span>
                      {showLabel && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {eventLabel(t, ev)}
                        </span>
                      )}
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("news.openArticle")}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-primary sm:min-h-0 sm:min-w-0"
                      >
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium leading-relaxed hover:text-primary hover:underline">
                      {item.news.headline}
                    </a>
                  ) : (
                    <h4 className="text-sm font-medium leading-relaxed">{item.news.headline}</h4>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
