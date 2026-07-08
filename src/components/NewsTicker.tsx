import { useState, useEffect, useMemo } from "react";
import { Info, TrendingUp, TrendingDown, AlertCircle, Award } from "lucide-react";
import { Link } from "react-router-dom";

interface NewsItem {
  headline: string;
  link: string;
  date: string;
  source: string;
}

interface NewsMapItem {
  symbol: string;
  news: NewsItem;
}

interface PerformerItem {
  symbol: string;
  score: number;
  roe: number;
  eps: number;
  epsGrowth: number;
  profitGrowth: number;
  sector: string;
  rank: number;
}

type TickerItem = 
  | { type: 'news'; symbol: string; headline: string; link: string; date: string }
  | { type: 'performer'; symbol: string; sector: string; roe: number; epsGrowth: number; rank: number; score: number };

export const NewsTicker = () => {
  const [newsDb, setNewsDb] = useState<Record<string, NewsItem[]>>({});
  const [topPerformers, setTopPerformers] = useState<PerformerItem[]>([]);
  
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const url = import.meta.env.DEV
          ? '/api/nepse-server/api/news'
          : 'http://localhost:8000/api/news';
        const res = await fetch(url);
        if (res.ok) {
          setNewsDb(await res.json());
        } else {
          console.warn('[NewsTicker] Failed to fetch news:', res.statusText);
        }
      } catch(e) {
        console.warn('[NewsTicker] Error fetching news:', e);
      }
    };

    const fetchTopPerformers = async () => {
      try {
        const url = import.meta.env.DEV
          ? '/api/nepse-server/api/quarterly/top-performers'
          : 'http://localhost:8000/api/quarterly/top-performers';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const latestPeriod = data.latestPeriod;
          const periodData = data.periods?.[latestPeriod] || {};
          const list: PerformerItem[] = [];
          
          Object.entries(periodData).forEach(([sector, stocks]: [string, any]) => {
            stocks.slice(0, 1).forEach((stock: any, index: number) => {
              list.push({
                ...stock,
                sector,
                rank: index + 1
              });
            });
          });
          setTopPerformers(list);
        }
      } catch (e) {
        console.warn('[NewsTicker] Error fetching top performers:', e);
      }
    };

    fetchNews();
    fetchTopPerformers();
    
    // Refresh ticker every 5 minutes
    const interval = setInterval(() => {
      fetchNews();
      fetchTopPerformers();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const importantNews = useMemo(() => {
    const IMPORTANT_KEYWORDS = [
      'dividend', 'bonus', 'cash', 'yield',
      'profit', 'loss', 'q1', 'q2', 'q3', 'q4', 'quarterly', 'net worth',
      'merger', 'acquisition', 'right share', 'auction', 'demerger'
    ];

    // Only show news from the last 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    
    const matched: NewsMapItem[] = [];
    Object.entries(newsDb).forEach(([symbol, items]) => {
      items.forEach(news => {
        const newsDate = new Date(news.date);
        if (newsDate < cutoff) return; // skip old news

        const headlineLower = news.headline.toLowerCase();
        const isImportant = IMPORTANT_KEYWORDS.some(kw => headlineLower.includes(kw));
        if (isImportant) {
          matched.push({ symbol, news });
        }
      });
    });
    
    // Sort by date newest first
    return matched.sort((a, b) => new Date(b.news.date).getTime() - new Date(a.news.date).getTime());
  }, [newsDb]);

  const tickerItems = useMemo(() => {
    const items: TickerItem[] = [];
    
    // Create performer items
    topPerformers.forEach(p => {
      items.push({
        type: 'performer',
        symbol: p.symbol,
        sector: p.sector,
        roe: p.roe,
        epsGrowth: p.epsGrowth,
        rank: p.rank,
        score: p.score
      });
    });

    // Create news items
    importantNews.forEach(item => {
      items.push({
        type: 'news',
        symbol: item.symbol,
        headline: item.news.headline,
        link: item.news.link,
        date: item.news.date
      });
    });

    // Interleave news and performers
    const interleaved: TickerItem[] = [];
    const maxLen = Math.max(topPerformers.length, importantNews.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < topPerformers.length) {
        interleaved.push(items[i]);
      }
      if (i < importantNews.length) {
        interleaved.push(items[topPerformers.length + i]);
      }
    }
    
    return interleaved;
  }, [topPerformers, importantNews]);

  if (tickerItems.length === 0) return null;

  // Duplicate items 2 times to ensure smooth infinite scrolling for marquee
  const contentToRender = [...tickerItems, ...tickerItems];

  return (
    <div className="w-full bg-slate-950 text-slate-300 py-2.5 overflow-hidden border-b border-slate-800 flex relative group text-xs shadow-inner select-none">
      {/* Live Badge */}
      <div className="absolute left-0 top-0 bottom-0 z-20 w-28 bg-gradient-to-r from-slate-950 via-slate-950 to-transparent flex items-center pl-4 pr-8 font-bold tracking-widest text-slate-100 uppercase border-r border-slate-800/50 shadow-[10px_0_20px_rgba(0,0,0,0.8)]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        MARKET
      </div>
      
      <div className="flex w-full overflow-hidden">
        <div className="flex animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap pl-28 items-center">
          {contentToRender.map((item, i) => {
            if (item.type === 'performer') {
              return (
                <div key={i} className="flex items-center mx-4 transition-all duration-300 hover:scale-[1.02]">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Award className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                    <span className="bg-amber-400/20 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider leading-none">
                      🏆 {item.sector} #1
                    </span>
                    <Link
                      to={`/quarterly?symbol=${item.symbol}`}
                      className="font-extrabold tracking-wide bg-amber-400/10 text-amber-300 hover:text-amber-200 px-1.5 py-0.5 rounded text-[10px] leading-none border-b border-dashed border-amber-300/30 hover:border-solid transition-all cursor-pointer"
                      title={`Analyze ${item.symbol} quarterly details`}
                    >
                      {item.symbol}
                    </Link>
                    <span className="font-medium text-slate-200">
                      Top Quarterly Health (ROE: {item.roe}%, Growth: {item.epsGrowth >= 0 ? "+" : ""}{item.epsGrowth.toFixed(1)}%)
                    </span>
                  </div>
                  <span className="text-slate-700 mx-6 select-none font-bold">•</span>
                </div>
              );
            } else {
              const hl = item.headline.toLowerCase();
              let Icon = Info;
              let textColorClass = "text-slate-300";
              let glowClass = "hover:text-blue-400 hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]";
              let iconClass = "text-blue-500";
              
              if (hl.includes('profit') || hl.includes('dividend') || hl.includes('bonus') || hl.includes('upgrade')) {
                Icon = TrendingUp;
                textColorClass = "text-emerald-400";
                glowClass = "hover:text-emerald-300 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]";
                iconClass = "text-emerald-500";
              } else if (hl.includes('loss') || hl.includes('downgrade') || hl.includes('lock-in') || hl.includes('locking')) {
                Icon = TrendingDown;
                textColorClass = "text-rose-400";
                glowClass = "hover:text-rose-300 hover:drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]";
                iconClass = "text-rose-500";
              } else if (hl.includes('merger') || hl.includes('right') || hl.includes('auction')) {
                Icon = AlertCircle;
                textColorClass = "text-amber-400";
                glowClass = "hover:text-amber-300 hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]";
                iconClass = "text-amber-500";
              }
              
              return (
                <div key={i} className="flex items-center mx-4 opacity-80 hover:opacity-100 transition-opacity">
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className={`flex items-center gap-2 ${textColorClass} ${glowClass} transition-all duration-300`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                    <span className="font-bold tracking-wide bg-white/10 text-white px-1.5 py-0.5 rounded text-[10px] leading-none">
                      {item.symbol}
                    </span>
                    <span className="font-medium">{item.headline}</span>
                    <span className="text-[9px] opacity-50 ml-1">({item.date})</span>
                  </a>
                  <span className="text-slate-700 mx-6 select-none font-bold">•</span>
                </div>
              );
            }
          })}
        </div>
      </div>
      
      <div className="absolute right-0 top-0 bottom-0 z-10 w-24 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
    </div>
  );
};
