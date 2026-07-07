import { useState, useEffect, useMemo } from "react";
import { Newspaper, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    });
  }, [newsDb, holdings, watchlistSymbols]);

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
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-lg flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Targeted News Feed
          <Badge variant="secondary" className="ml-auto font-mono">
            {activeNews.length} items
          </Badge>
        </CardTitle>
        <CardDescription>
          Latest news for your Portfolio and Watchlist stocks
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-thin">
        {activeNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
            <Newspaper className="w-12 h-12 mb-2 opacity-20" />
            <p>No news found for your active tracking list.</p>
            <p className="text-sm mt-1">
              Run <code className="bg-muted px-1 py-0.5 rounded">python tools/scrape_sharesansar_news.py SYMBOL</code> in your terminal to fetch news.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activeNews.map((item, i) => (
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
