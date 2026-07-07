import { useState, useEffect, useMemo } from "react";
import { Newspaper, ExternalLink, Loader2, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { StockSymbolLink } from "@/components/StockSymbolLink";
import { StockHolding } from "@/data/portfolioData";

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
        const newsUrl = import.meta.env.DEV
          ? '/api/nepse-server/api/news'
          : 'http://localhost:8000/api/news';
        const newsRes = await fetch(newsUrl);
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
      title: "Fetching News",
      description: `Fetching news for ${selectedSymbols.length} stocks. This might take a few minutes...`,
    });
    
    let successCount = 0;
    for (const symbol of selectedSymbols) {
      try {
        const url = import.meta.env.DEV
          ? `/api/nepse-server/api/news/fetch/${symbol}`
          : `http://localhost:8000/api/news/fetch/${symbol}`;
        const res = await fetch(url, { method: "POST" });
        if (res.ok) successCount++;
      } catch (e) {
        console.error("Failed to fetch", symbol, e);
      }
    }
    
    // Refresh DB
    try {
      const newsUrl = import.meta.env.DEV
        ? '/api/nepse-server/api/news'
        : 'http://localhost:8000/api/news';
      const newsRes = await fetch(newsUrl);
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setNewsDb(newsData);
      }
    } catch(e) {}
    
    toast({
      title: "Fetch Complete",
      description: `Successfully updated news for ${successCount}/${selectedSymbols.length} stocks.`,
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
    return allNews.sort((a, b) => {
      const dateA = new Date(a.news.date).getTime();
      const dateB = new Date(b.news.date).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0; // Fallback if date is weird
      return dateB - dateA;
    }).slice(0, 50); // limit total rendered to prevent extreme lag
  }, [newsDb, holdings, watchlistSymbols]);

  const allActiveSymbolsArray = useMemo(() => Array.from(new Set([
    ...holdings.map(h => h.scrip),
    ...watchlistSymbols
  ])).sort(), [holdings, watchlistSymbols]);

  const filteredActiveNews = useMemo(() => {
    if (!searchQuery.trim()) return activeNews;
    const query = searchQuery.toLowerCase();
    return activeNews.filter(item => 
      item.symbol.toLowerCase().includes(query) || 
      item.news.headline.toLowerCase().includes(query)
    );
  }, [activeNews, searchQuery]);

  if (isLoading) {
    return (
      <Card className="glass-card opacity-0 animate-fade-in" style={{ animationDelay: "800ms" }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            Targeted News Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card opacity-0 animate-fade-in h-[500px] flex flex-col" style={{ animationDelay: "800ms" }}>
      <CardHeader className="pb-3 border-b border-border space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            Targeted News Feed
          </CardTitle>
          <Badge variant="secondary" className="font-mono">
            {activeNews.length} items
          </Badge>
        </div>
        
        <div className="flex flex-col gap-3 pt-2">
          {/* Badge selection row */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {allActiveSymbolsArray.map(sym => (
              <Badge 
                key={sym} 
                variant={selectedSymbols.includes(sym) ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap hover:bg-primary/80 transition-colors"
                onClick={() => toggleSymbol(sym)}
              >
                {sym}
              </Badge>
            ))}
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="default" 
              size="sm"
              className="h-8"
              disabled={selectedSymbols.length === 0 || isFetching !== null}
              onClick={handleFetchSelected}
            >
              {isFetching === 'MULTIPLE' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              Fetch Selected ({selectedSymbols.length})
            </Button>
            
            <Button 
              variant="secondary" 
              size="sm"
              className="h-8"
              onClick={selectAllNonMutual}
              disabled={isFetching !== null}
            >
              Select All (Stocks)
            </Button>

            <Button 
              variant="ghost" 
              size="sm"
              className="h-8"
              onClick={clearSelection}
              disabled={isFetching !== null || selectedSymbols.length === 0}
            >
              Clear
            </Button>
          </div>
          
          {/* Search/Filter Input */}
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Filter news by company or keyword..."
              className="flex h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-thin">
        {filteredActiveNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
            <Newspaper className="w-12 h-12 mb-2 opacity-20" />
            {searchQuery ? (
              <p className="mb-4">No news matches your search.</p>
            ) : (
              <>
                <p className="mb-4">No news found for your active tracking list.</p>
                <p className="text-sm">Use the controls above to fetch the latest news.</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredActiveNews.map((item, i) => (
              <a 
                key={`${item.symbol}-${i}`}
                href={item.news.link}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col p-4 hover:bg-muted/50 transition-colors gap-2 group block"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StockSymbolLink symbol={item.symbol} />
                    <span className="text-xs text-muted-foreground">{item.news.date}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h4 className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                  {item.news.headline}
                </h4>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
