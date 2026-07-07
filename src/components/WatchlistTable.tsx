import { useState, useEffect, useMemo } from "react";
import { ArrowUpDown, Info, Loader2, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchMultipleFundamentals, MerolaganiFundamentals } from "@/services/merolaganiApi";
import { StockSymbolLink } from "@/components/StockSymbolLink";
import { toast } from "@/hooks/use-toast";
import { getCachedStockData } from "@/services/sharebazaarApi";
import { Link } from "react-router-dom";

interface WatchlistEntry {
  symbol: string;
  company: string;
  dateAdded: string;
}

interface EnhancedWatchlistEntry extends WatchlistEntry {
  fundamentals?: MerolaganiFundamentals | null;
  ltp?: number;
  isLoading: boolean;
}

export const WatchlistTable = () => {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [enhancedWatchlist, setEnhancedWatchlist] = useState<EnhancedWatchlistEntry[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [newSymbol, setNewSymbol] = useState("");
  const [isAdding, setIsAdding] = useState(false);

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
          toast({ title: "Already exists", description: `${symbol} is already in your watchlist.` });
        } else {
          toast({ title: "Added", description: `${symbol} added to watchlist.` });
          setWatchlist(data.watchlist);
          setNewSymbol("");
        }
      }
    } catch (e) {
      toast({ title: "Error", description: "Could not add to watchlist.", variant: "destructive" });
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
        toast({ title: "Removed", description: `${symbol} removed from watchlist.` });
        setWatchlist(data.watchlist);
      }
    } catch (e) {
      toast({ title: "Error", description: "Could not remove from watchlist.", variant: "destructive" });
    }
  };

  const formatCurrency = (value?: number | null) => {
    if (value === undefined || value === null) return "N/A";
    return `Rs. ${value.toLocaleString("en-NP", { maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="glass-card overflow-hidden opacity-0 animate-fade-in mt-6" style={{ animationDelay: "700ms" }}>
      <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Watchlist
          <Badge variant="secondary" className="font-mono">
            {watchlist.length} tracking
          </Badge>
          {isLoadingDB && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </h3>
        
        <form onSubmit={handleAddSymbol} className="flex gap-2 w-full sm:w-auto">
          <Input 
            placeholder="Symbol (e.g. NICA)" 
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value)}
            className="w-full sm:w-48 h-9 text-transform-uppercase"
            maxLength={10}
          />
          <Button type="submit" size="sm" disabled={isAdding || !newSymbol.trim()} className="shrink-0 h-9">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add
          </Button>
        </form>
      </div>
      
      <div className="max-h-[500px] overflow-auto scrollbar-thin relative">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 bg-card z-10 shadow-sm [&_tr]:border-b">
            <tr className="border-b transition-colors bg-card">
              <TableHead className="w-12 text-slate-400">#</TableHead>
              <TableHead className="text-primary font-semibold">Symbol</TableHead>
              <TableHead className="hidden lg:table-cell text-muted-foreground font-semibold">Company</TableHead>
              <TableHead className="text-violet-500 font-semibold">LTP</TableHead>
              <TableHead className="text-teal-500 font-semibold">EPS</TableHead>
              <TableHead className="text-pink-500 font-semibold">Book Val</TableHead>
              <TableHead className="text-orange-500 font-semibold">P/B</TableHead>
              <TableHead className="text-blue-500 font-semibold hidden md:table-cell">P/E</TableHead>
              <TableHead className="w-12 text-right"></TableHead>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {enhancedWatchlist.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                  Your watchlist is empty. Add a symbol above to start tracking.
                </TableCell>
              </TableRow>
            ) : (
              enhancedWatchlist.map((item, index) => (
                <TableRow key={item.symbol} className="table-row-hover">
                  <TableCell className="font-mono text-slate-400">{index + 1}</TableCell>
                  <TableCell>
                    <StockSymbolLink symbol={item.symbol} className="font-semibold text-primary" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm max-w-[200px] truncate">
                    <Link
                      to={`/quarterly?symbol=${item.symbol}`}
                      className={cn(
                        "text-muted-foreground",
                        "border-b border-dashed border-muted-foreground/45 hover:border-solid hover:border-primary hover:text-primary transition-all cursor-pointer inline-block max-w-full"
                      )}
                    >
                      {item.company}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-violet-500 font-medium">
                    {item.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : formatCurrency(item.ltp ?? item.fundamentals?.lastTradedPrice)}
                  </TableCell>
                  <TableCell className="font-mono text-teal-500">
                    {item.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (item.fundamentals?.eps ?? "N/A")}
                  </TableCell>
                  <TableCell className="font-mono text-pink-500">
                    {item.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : formatCurrency(item.fundamentals?.bookValue)}
                  </TableCell>
                  <TableCell className="font-mono text-orange-500">
                    {item.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (item.fundamentals?.pbRatio?.toFixed(2) ?? "N/A")}
                  </TableCell>
                  <TableCell className="font-mono text-blue-500 hidden md:table-cell">
                    {item.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (item.fundamentals?.peRatio?.toFixed(2) ?? "N/A")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSymbol(item.symbol)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
