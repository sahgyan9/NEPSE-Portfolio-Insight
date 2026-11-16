import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { Info, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { dedupeNews } from "@/lib/newsDedupe";
import { useT } from "@/i18n";
import { fmtDate } from "@/i18n/format";

interface NewsItem {
  headline: string;
  link: string;
  date: string;
  source: string;
}

const IMPORTANT_KEYWORDS = [
  "dividend", "bonus", "cash", "yield",
  "profit", "loss", "q1", "q2", "q3", "q4", "quarterly", "net worth",
  "merger", "acquisition", "right share", "auction", "demerger",
];

const MAX_SYMBOLS_SHOWN = 3;
/** Scroll speed in pixels per second: slow enough to read a headline as it passes. */
const SPEED_PX_PER_SEC = 60;
/** Below this many unique items a loop would look like repeated news, so show a static row. */
const MIN_ITEMS_TO_SCROLL = 4;

/** Top strip of recent company notices. Each article appears once, with all its symbols. */
export const NewsTicker = () => {
  const { t } = useT();
  const [newsDb, setNewsDb] = useState<Record<string, NewsItem[]>>({});

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const url = import.meta.env.DEV ? "/api/nepse-server/api/news" : "http://localhost:8002/api/news";
        const res = await fetch(url);
        if (res.ok) setNewsDb(await res.json());
        else console.warn("[NewsTicker] Failed to fetch news:", res.statusText);
      } catch (e) {
        console.warn("[NewsTicker] Error fetching news:", e);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const items = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const matched: { symbol: string; news: NewsItem }[] = [];
    Object.entries(newsDb).forEach(([symbol, list]) => {
      list.forEach((news) => {
        if (new Date(news.date) < cutoff) return;
        const h = news.headline.toLowerCase();
        if (IMPORTANT_KEYWORDS.some((kw) => h.includes(kw))) matched.push({ symbol, news });
      });
    });
    matched.sort((a, b) => new Date(b.news.date).getTime() - new Date(a.news.date).getTime());
    return dedupeNews(matched);
  }, [newsDb]);


  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const scrolling = items.length >= MIN_ITEMS_TO_SCROLL;

  // Duration follows the real content width, so speed stays constant however many items there are.
  useLayoutEffect(() => {
    if (!scrolling || !trackRef.current) return;
    const half = trackRef.current.scrollWidth / 2;
    setDuration(Math.max(10, half / SPEED_PX_PER_SEC));
  }, [items, scrolling]);

  if (items.length === 0) return null;

  const renderItems = (hidden: boolean) =>
    items.map((item, i) => {
      const hl = item.news.headline.toLowerCase();
      let Icon = Info;
      let tone = "text-muted-foreground";
      if (hl.includes("profit") || hl.includes("dividend") || hl.includes("bonus") || hl.includes("upgrade")) {
        Icon = TrendingUp;
        tone = "text-success";
      } else if (hl.includes("loss") || hl.includes("downgrade") || hl.includes("lock-in") || hl.includes("locking")) {
        Icon = TrendingDown;
        tone = "text-destructive";
      } else if (hl.includes("merger") || hl.includes("right") || hl.includes("auction")) {
        Icon = AlertCircle;
        tone = "text-warning";
      }
      const shown = item.symbols.slice(0, MAX_SYMBOLS_SHOWN).join(", ");
      const extra = item.symbols.length - MAX_SYMBOLS_SHOWN;
      const body = (
        <>
          <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden="true" />
          <span className="font-semibold">
            {shown}
            {extra > 0 ? ` +${extra}` : ""}
          </span>
          <span>{item.news.headline}</span>
          <span className="text-muted-foreground">({fmtDate(item.news.date)})</span>
        </>
      );
      const cls = "flex shrink-0 items-center gap-1.5 pr-8 text-foreground";
      return item.url ? (
        <a
          key={`${hidden ? "b" : "a"}-${i}`}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={hidden ? -1 : undefined}
          className={`${cls} hover:underline`}
        >
          {body}
        </a>
      ) : (
        <span key={`${hidden ? "b" : "a"}-${i}`} className={cls}>
          {body}
        </span>
      );
    });

  return (
    <div className="w-full border-b border-border bg-card text-xs">
      <div className="container flex items-center gap-3 px-4 py-2">
        <span className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">{t("nav.tickerLabel")}</span>
        {scrolling ? (
          <div className="ticker-viewport min-w-0 flex-1 overflow-hidden" role="region" aria-label={t("nav.tickerRegion")}>
            <div
              ref={trackRef}
              className="ticker-track flex w-max whitespace-nowrap"
              style={duration ? { animationDuration: `${duration}s` } : { animation: "none" }}
            >
              <div className="flex shrink-0 items-center">{renderItems(false)}</div>
              <div className="flex shrink-0 items-center" aria-hidden="true">
                {renderItems(true)}
              </div>
            </div>
          </div>
        ) : (
          <div className="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap">{renderItems(false)}</div>
        )}
      </div>
    </div>
  );
};
