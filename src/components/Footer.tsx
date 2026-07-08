import { Link } from 'react-router-dom';
import { TrendingUp, Activity, MoreHorizontal, ShieldCheck } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="w-full border-t border-border/40 bg-background/30 py-8 mt-12 text-sm">
      <div className="container px-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>NEPSE Portfolio Insight</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Value investing and portfolio health metrics inspired by Benjamin Graham's *The Intelligent Investor*.
            Disclaimer: This is not official financial advice. Always verify with official sources.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <span className="text-muted-foreground select-none">Additional Modules:</span>
          <Link 
            to="/fundamentals" 
            className="flex items-center gap-1 text-muted-foreground hover:text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-primary/20 transition-all"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Fundamentals</span>
          </Link>
          <Link 
            to="/market" 
            className="flex items-center gap-1 text-muted-foreground hover:text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-primary/20 transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span>Market</span>
          </Link>
          <Link 
            to="/misc" 
            className="flex items-center gap-1 text-muted-foreground hover:text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-primary/20 transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span>Misc</span>
          </Link>
        </div>
      </div>
    </footer>
  );
};
