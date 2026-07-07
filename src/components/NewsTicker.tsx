import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface NewsItem {
  headline: string;
  date: string;
  link: string;
}

export const NewsTicker = () => {
  const [newsDb, setNewsDb] = useState<Record<string, NewsItem[]>>({});
  
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const url = import.meta.env.DEV
          ? '/api/nepse-server/api/news'
          : 'http://localhost:8000/api/news';
        const res = await fetch(url);
        if (res.ok) {
          setNewsDb(await res.json());
        }
      } catch(e) {}
    };
    fetchNews();
    
    // Refresh ticker every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const importantNews = useMemo(() => {
    const IMPORTANT_KEYWORDS = [
      'dividend', 'bonus', 'cash', 'yield',
      'profit', 'loss', 'q1', 'q2', 'q3', 'q4', 'quarterly', 'net worth',
      'right share', 'rights', 'auction', 'merger', 'acquisition', 'agm', 'sgm', 'book closure',
      'lock-in', 'lock in', 'locking', 'ipo', 'fpo',
      'rating', 'downgrade', 'upgrade', 'icra', 'care'
    ];
    
    // 15 days ago limit
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 15);
    
    const matched: { symbol: string; news: NewsItem }[] = [];
    
    Object.entries(newsDb).forEach(([symbol, items]) => {
      items.forEach(item => {
        const d = new Date(item.date);
        if (isNaN(d.getTime()) || d < cutoff) return;
        
        const headlineLower = item.headline.toLowerCase();
        const isImportant = IMPORTANT_KEYWORDS.some(kw => headlineLower.includes(kw));
        
        if (isImportant) {
          matched.push({ symbol, news: item });
        }
      });
    });
    
    // Sort by date newest first
    return matched.sort((a, b) => new Date(b.news.date).getTime() - new Date(a.news.date).getTime());
  }, [newsDb]);

  if (importantNews.length === 0) return null;

  // Duplicate items to ensure smooth infinite scrolling for marquee
  // We repeat it 5 times to ensure it covers even ultrawide monitors
  const contentToRender = [
    ...importantNews, ...importantNews, ...importantNews, ...importantNews, ...importantNews
  ];

  return (
    <div className="w-full bg-slate-950 text-slate-300 py-2 overflow-hidden border-b border-slate-800 flex relative group text-sm shadow-inner">
      <div className="absolute left-0 top-0 bottom-0 z-20 w-32 bg-gradient-to-r from-slate-950 via-slate-950 to-transparent flex items-center pl-4 pr-8 font-bold text-xs tracking-widest text-slate-100 uppercase border-r border-slate-800/50 shadow-[10px_0_20px_rgba(0,0,0,0.8)]">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-2 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        LIVE
      </div>
      
      <div className="flex w-full overflow-hidden">
        <div className="flex animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap pl-32 items-center">
          {contentToRender.map((item, i) => {
            const hl = item.news.headline.toLowerCase();
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
                  href={item.news.link} 
                  target="_blank" 
                  rel="noreferrer"
                  className={`flex items-center gap-2 ${textColorClass} ${glowClass} transition-all duration-300`}
                >
                  <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                  <span className="font-bold tracking-wide bg-white/10 text-white px-1.5 py-0.5 rounded text-[10px] leading-none">{item.symbol}</span>
                  <span className="font-medium">{item.news.headline}</span>
                  <span className="text-[10px] opacity-50 ml-1">({item.news.date})</span>
                </a>
                <span className="text-slate-700 mx-6 select-none">•</span>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="absolute right-0 top-0 bottom-0 z-10 w-24 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
    </div>
  );
};
