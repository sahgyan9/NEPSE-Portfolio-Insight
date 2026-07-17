// src/pages/QuarterlyPage.tsx
// Main quarterly financial reports page
// Features: stock selector, PDF upload zone, trend charts, data table, delete quarters

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, RefreshCw, Trash2,
  TrendingUp, BarChart2, Table2, Upload,
  AlertCircle, Building2, Calendar, Loader2, Search, Download, X, Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QuarterlyUploadZone } from '@/components/QuarterlyUploadZone';
import { QuarterlyTrendChart } from '@/components/QuarterlyTrendChart';
import { QuarterlyDataTable } from '@/components/QuarterlyDataTable';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import { DynamicGradientBorder } from '@/components/DynamicGradientBorder';
import {
  listQuarterlyStocks,
  getQuarterlyData,
  deleteQuarter,
  fetchQuarterlyData,
} from '@/services/quarterlyApi';
import type {
  SymbolListItem,
  SymbolQuarterlyData,
  UploadSuccessResponse,
  QuarterRecord,
} from '@/types/quarterly';
import { useApiKey } from '@/hooks/useApiKey';

// ── Sector badge colours & labels ─────────────────────────────────────────────
const getSectorStyle = (sector: string = '') => {
  const s = (sector || '').toLowerCase();
  if (s.includes('bank')) return { color: 'bg-green-500/10 text-green-600 border-green-500/20', label: '🏦 ' + sector };
  if (s.includes('hydro')) return { color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: '⚡ ' + sector };
  if (s.includes('microfinance')) return { color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', label: '🌱 ' + sector };
  if (s.includes('manufacturing') || s.includes('processing')) return { color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', label: '🏭 ' + sector };
  if (s.includes('insurance')) return { color: 'bg-pink-500/10 text-pink-600 border-pink-500/20', label: '🛡️ ' + sector };
  if (s.includes('finance')) return { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', label: '💵 ' + sector };
  if (s.includes('hotel') || s.includes('tourism')) return { color: 'bg-teal-500/10 text-teal-600 border-teal-500/20', label: '🏨 ' + sector };
  if (s.includes('investment')) return { color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', label: '📈 ' + sector };
  if (s.includes('trading')) return { color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20', label: '🔄 ' + sector };
  return { color: 'bg-slate-500/10 text-slate-600 border-slate-500/20', label: '📦 ' + (sector || 'Others') };
};

// ── Mini KPI Card ─────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="p-4 rounded-xl border border-border bg-card relative overflow-hidden">
    <DynamicGradientBorder />
    <div className="relative z-10">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold font-mono mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const QuarterlyPage = () => {
  const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();
  const [stocks, setStocks] = useState<SymbolListItem[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const symbolParam = searchParams.get('symbol');
  const [selectedSymbol, setSelectedSymbol] = useState<string>(symbolParam?.toUpperCase() || '');
  const [symbolData, setSymbolData] = useState<SymbolQuarterlyData | null>(null);
  const [dividendHistory, setDividendHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'trends');
  const [unfetchedSymbols, setUnfetchedSymbols] = useState<string[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      if (!stock || !stock.symbol) return false;
      const sym = (stock.symbol || '').toLowerCase();
      const name = (stock.company_name || '').toLowerCase();
      const q = stockSearchQuery.toLowerCase();
      const matchesSearch = sym.includes(q) || name.includes(q);

      let matchesSector = true;
      if (sectorFilter !== 'all') {
        const sector = (stock.sector || '').toLowerCase();
        matchesSector = sector.includes(sectorFilter);
      }

      return matchesSearch && matchesSector;
    });
  }, [stocks, stockSearchQuery, sectorFilter]);

  // Load stock list
  const loadStocks = useCallback(async () => {
    const list = await listQuarterlyStocks();
    setStocks(list);
    
    // Auto-select based on query param, or first stock
    if (symbolParam && list.some(s => s && s.symbol === symbolParam.toUpperCase())) {
      setSelectedSymbol(symbolParam.toUpperCase());
    } else if (!selectedSymbol && list.length > 0) {
      setSelectedSymbol(list[0].symbol);
    }
  }, [selectedSymbol, symbolParam]);

  // Synchronize selectedSymbol to query parameters
  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedSymbol) params.symbol = selectedSymbol;
    if (activeTab) params.tab = activeTab;
    setSearchParams(params);
  }, [selectedSymbol, activeTab, setSearchParams]);

  // Check which watchlist/portfolio symbols are missing quarterly data
  useEffect(() => {
    const checkUnfetched = async () => {
      try {
        const holdingsRes = await fetch(import.meta.env.DEV ? '/api/portfolio-db/api/holdings' : 'http://localhost:5001/api/holdings');
        const watchlistRes = await fetch(import.meta.env.DEV ? '/api/portfolio-db/api/watchlist' : 'http://localhost:5001/api/watchlist');
        
        let allSyms: string[] = [];
        if (holdingsRes.ok) {
          const data = await holdingsRes.json();
          allSyms.push(...(data.holdings || []).map((h: any) => h?.symbol).filter(Boolean));
        }
        if (watchlistRes.ok) {
          const data = await watchlistRes.json();
          allSyms.push(...(data.watchlist || []).map((w: any) => w?.symbol).filter(Boolean));
        }
        
        const uniqueSyms = Array.from(new Set(allSyms));
        const fetchedSyms = new Set(stocks.filter(s => s && s.symbol).map(s => s.symbol));
        const missing = uniqueSyms.filter(sym => !fetchedSyms.has(sym));
        setUnfetchedSymbols(missing);
      } catch (e) {
        console.error("Failed to check unfetched symbols", e);
      }
    };
    if (stocks.length > 0) {
      checkUnfetched();
    }
  }, [stocks]);

  // Load data for selected symbol
  const loadSymbolData = useCallback(async (symbol: string) => {
    if (!symbol) return;
    setIsLoading(true);
    try {
      const data = await getQuarterlyData(symbol);
      setSymbolData(data);
      
      try {
        const divUrl = import.meta.env.DEV ? `/api/nepse-server/api/dividends/history/${symbol}` : `http://localhost:8000/api/dividends/history/${symbol}`;
        const res = await fetch(divUrl);
        if (res.ok) {
            const divData = await res.json();
            setDividendHistory(divData.history || []);
        } else {
            setDividendHistory([]);
        }
      } catch (err) {
        console.error("Failed to fetch dividend history", err);
        setDividendHistory([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadStocks(); }, []);
  useEffect(() => {
    if (selectedSymbol) {
      loadSymbolData(selectedSymbol);
    }
  }, [selectedSymbol]);

  const handleFetchNepseAlpha = async (sym: string) => {
    if (!sym) return;
    setIsFetching(true);
    try {
      const res = await fetchQuarterlyData(sym);
      toast({
        title: `✅ Fetched ${sym}`,
        description: 'Successfully scraped data from NepseAlpha',
      });
      await loadStocks();
      if (selectedSymbol === sym.toUpperCase()) {
        await loadSymbolData(sym.toUpperCase());
      } else {
        setSelectedSymbol(sym.toUpperCase());
      }
      setNewSymbol('');
    } catch (err: any) {
      toast({
        title: `❌ Failed to fetch ${sym}`,
        description: err.message || 'Quarterly data might not be published yet.',
        variant: 'destructive',
      });
    } finally {
      setIsFetching(false);
    }
  };

  // Handle successful upload (fallback)
  const handleUploadSuccess = async (result: UploadSuccessResponse) => {
    toast({
      title: `✅ ${result.quarter_label} saved via fallback`,
      description: `${result.company_name} — EPS TTM: Rs ${result.computed.eps_ttm ?? '—'}`,
    });
    await loadStocks();
    setSelectedSymbol(result.symbol);
  };

  // Delete a quarter
  const handleDelete = async (q: QuarterRecord) => {
    const ok = await deleteQuarter(q.symbol, q.fy, q.quarter);
    if (ok) {
      toast({ title: `Deleted ${q.quarter_label}`, variant: 'default' });
      const list = await listQuarterlyStocks();
      setStocks(list);
      
      const hasStillData = list.some(s => s.symbol === selectedSymbol);
      if (hasStillData) {
        await loadSymbolData(selectedSymbol);
      } else {
        if (list.length > 0) {
          setSelectedSymbol(list[0].symbol);
        } else {
          setSelectedSymbol('');
          setSymbolData(null);
        }
      }
    } else {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const quarters = symbolData?.quarters ?? [];
  const latestQ: QuarterRecord | undefined = quarters[quarters.length - 1];

  return (
    <div className="min-h-screen bg-background">
      <Header
        onRefresh={() => { loadStocks(); if (selectedSymbol) loadSymbolData(selectedSymbol); }}
        isRefreshing={isLoading}
      />

      <main className="container px-4 py-6 max-w-7xl">
        {/* Back nav */}
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Quarterly Reports
          </h1>
          <p className="text-muted-foreground">
            Fetch quarterly reports directly from NepseAlpha. Track financial trends, analyze balance sheets, and review metrics.
          </p>
        </div>

        <div className="space-y-6">
          {/* ── Top Control Bar (Search & Filter) ─────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col md:flex-row gap-4 items-start md:items-center relative z-20">
            <Search className="w-5 h-5 text-muted-foreground hidden md:block ml-2" />
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Search stocks to view or fetch new data (e.g. SAHAS)..."
                value={stockSearchQuery}
                onChange={(e) => { setStockSearchQuery(e.target.value.toUpperCase()); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setShowSuggestions(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && stockSearchQuery.trim()) {
                    const exactMatch = stocks.find(s => s.symbol === stockSearchQuery.trim());
                    if (exactMatch) {
                      setSelectedSymbol(exactMatch.symbol);
                      setShowSuggestions(false);
                      setStockSearchQuery('');
                    } else {
                      handleFetchNepseAlpha(stockSearchQuery.trim());
                      setShowSuggestions(false);
                      setStockSearchQuery('');
                    }
                  }
                }}
                className="w-full pl-4 pr-10 h-12 flex rounded-lg border border-input bg-background px-4 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              {stockSearchQuery && (
                <button 
                  onMouseDown={(e) => { e.preventDefault(); setStockSearchQuery(''); }}
                  className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <Select value={sectorFilter} onValueChange={(val) => { setSectorFilter(val); setShowSuggestions(true); }}>
              <SelectTrigger className="w-full md:w-[200px] h-12 bg-background">
                <SelectValue placeholder="All Sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                <SelectItem value="bank">Commercial Banks</SelectItem>
                <SelectItem value="hydro">Hydro Power</SelectItem>
                <SelectItem value="microfinance">Microfinance</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="hotel">Hotels &amp; Tourism</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
              </SelectContent>
            </Select>

            {/* Auto-suggest dropdown */}
            {showSuggestions && (
              <div className="absolute top-[110%] left-0 right-0 bg-card border border-border rounded-xl shadow-xl max-h-[450px] overflow-y-auto scrollbar-thin flex flex-col z-50">
                {/* 1. Show existing fetched stocks */}
                {filteredStocks.length > 0 && (
                  <div className="p-2 space-y-1">
                    {filteredStocks.map(stock => (
                      <button
                        key={stock.symbol}
                        onMouseDown={(e) => { 
                          e.preventDefault(); 
                          setSelectedSymbol(stock.symbol);
                          setShowSuggestions(false);
                          setStockSearchQuery('');
                        }}
                        className={`w-full text-left p-3 rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-between
                          ${selectedSymbol === stock.symbol ? 'bg-primary/10' : ''}`}
                      >
                        <div>
                          <span className="font-mono font-bold">{stock.symbol}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{stock.company_name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getSectorStyle(stock.sector).color}`}>
                            {getSectorStyle(stock.sector).label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" /> {stock.quarter_count} Qs
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 2. Show option to fetch new stock or update existing if typed */}
                {stockSearchQuery.trim() && (
                  <div className="p-2 border-t border-border/50 bg-primary/5">
                    <button
                      onMouseDown={(e) => { 
                        e.preventDefault(); 
                        handleFetchNepseAlpha(stockSearchQuery.trim()); 
                        setShowSuggestions(false); 
                        setStockSearchQuery('');
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-primary/15 transition-colors flex items-center gap-3 text-primary"
                    >
                      {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                      <div>
                        <span className="font-bold block">
                          {stocks.some(s => s.symbol === stockSearchQuery.trim()) 
                            ? `Update "${stockSearchQuery.trim()}" Data` 
                            : `Fetch "${stockSearchQuery.trim()}"`}
                        </span>
                        <span className="text-xs opacity-80">Download latest quarterly data from NepseAlpha</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* 3. Show missing watchlist items */}
                {unfetchedSymbols.filter(sym => sym.includes(stockSearchQuery.trim())).length > 0 && (
                  <div className="p-2 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase px-3 py-2 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5" /> Missing Watchlist Data
                    </p>
                    <div className="space-y-1">
                      {unfetchedSymbols.filter(sym => sym.includes(stockSearchQuery.trim())).map(sym => (
                        <button
                          key={sym}
                          onMouseDown={(e) => { 
                            e.preventDefault(); 
                            handleFetchNepseAlpha(sym); 
                            setShowSuggestions(false);
                            setStockSearchQuery('');
                          }}
                          className="w-full text-left p-3 rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-between group"
                        >
                          <span className="font-mono font-bold text-muted-foreground group-hover:text-foreground">{sym}</span>
                          <span className="text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Download className="w-3 h-3" /> Fetch
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No results fallback */}
                {filteredStocks.length === 0 && !stockSearchQuery.trim() && unfetchedSymbols.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground text-center">No stocks match your search or filter.</div>
                )}
              </div>
            )}
          </div>



          {/* ── Main Content (Company Details) ─────────────────────── */}
          <div>
            {!selectedSymbol ? (
              <div className="flex flex-col items-center justify-center h-[500px] rounded-xl border border-dashed border-border text-muted-foreground gap-3 p-6 text-center">
                <Download className="w-12 h-12 opacity-30" />
                <p className="font-medium text-lg">Select or fetch a stock to begin</p>
                <p className="text-sm">Use the control bar above to search for your stocks or fetch new data from NepseAlpha.</p>
              </div>
            ) : (
              <>
                {/* Company header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <StockSymbolLink symbol={selectedSymbol} className="text-2xl font-bold font-mono" />
                      <Badge variant="outline" className={getSectorStyle(symbolData?.sector).color}>
                        {getSectorStyle(symbolData?.sector).label}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-0.5">{symbolData?.company_name}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleFetchNepseAlpha(selectedSymbol)}
                    disabled={isFetching}
                    className="font-mono text-xs gap-2"
                  >
                    {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Update Latest
                  </Button>
                </div>

                {/* KPI summary from latest quarter */}
                {latestQ && (
                  <ErrorBoundary label="KPI Cards">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <KpiCard
                      label="EPS TTM"
                      value={latestQ.computed?.eps_ttm != null ? `Rs ${Number(latestQ.computed.eps_ttm).toFixed(2)}` : '—'}
                      sub={latestQ.quarter_label}
                    />
                    <KpiCard
                      label="BVPS"
                      value={latestQ.computed?.bvps != null ? `Rs ${Number(latestQ.computed.bvps).toFixed(2)}` : '—'}
                      sub="Book Value / Share"
                    />
                    <KpiCard
                      label="ROE TTM"
                      value={latestQ.computed?.roe_ttm != null ? `${Number(latestQ.computed.roe_ttm).toFixed(2)}%` : '—'}
                      sub="Return on Equity"
                    />
                    <KpiCard
                      label="Net Margin"
                      value={latestQ.computed?.net_margin != null ? `${Number(latestQ.computed.net_margin).toFixed(2)}%` : '—'}
                      sub="Net Profit / Revenue"
                    />
                  </div>
                  </ErrorBoundary>
                )}

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-5 mb-4">
                    <TabsTrigger value="trends" className="gap-1.5 text-xs sm:text-sm">
                      <TrendingUp className="w-4 h-4" /><span className="hidden sm:inline">Trends</span>
                    </TabsTrigger>
                    <TabsTrigger value="screen2" className="gap-1.5 text-xs sm:text-sm">
                      <Table2 className="w-4 h-4" /><span className="hidden sm:inline">Balance Sheet</span>
                    </TabsTrigger>
                    <TabsTrigger value="screen1" className="gap-1.5 text-xs sm:text-sm">
                      <BarChart2 className="w-4 h-4" /><span className="hidden sm:inline">Ratios</span>
                    </TabsTrigger>
                    <TabsTrigger value="dividends" className="gap-1.5 text-xs sm:text-sm">
                      <Coins className="w-4 h-4" /><span className="hidden sm:inline">Dividends</span>
                    </TabsTrigger>
                    <TabsTrigger value="manage" className="gap-1.5 text-xs sm:text-sm">
                      <AlertCircle className="w-4 h-4" /><span className="hidden sm:inline">Manage</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Trends tab */}
                  <TabsContent value="trends" className="rounded-xl border border-border bg-card p-5 relative overflow-hidden">
                    <DynamicGradientBorder />
                    <div className="relative z-10">
                      <h3 className="font-semibold mb-4">Quarterly Trends — All Years</h3>
                      {isLoading ? (
                        <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>
                      ) : (
                        <ErrorBoundary label="Quarterly Chart">
                          <QuarterlyTrendChart quarters={quarters} companyName={symbolData?.company_name} />
                        </ErrorBoundary>
                      )}
                    </div>
                  </TabsContent>

                  {/* Balance Sheet table */}
                  <TabsContent value="screen2" className="rounded-xl border border-border bg-card p-5 relative overflow-hidden">
                    <DynamicGradientBorder />
                    <div className="relative z-10">
                      <h3 className="font-semibold mb-4">Balance Sheet + P&L (Rs Crore)</h3>
                      <QuarterlyDataTable quarters={quarters} mode="screen2" />
                    </div>
                  </TabsContent>

                  {/* Ratios table */}
                  <TabsContent value="screen1" className="rounded-xl border border-border bg-card p-5 relative overflow-hidden">
                    <DynamicGradientBorder />
                    <div className="relative z-10">
                      <h3 className="font-semibold mb-4">Ratio Metrics</h3>
                      <QuarterlyDataTable quarters={quarters} mode="screen1" />
                    </div>
                  </TabsContent>

                  {/* Dividends tab */}
                  <TabsContent value="dividends" className="rounded-xl border border-border bg-card p-5 relative overflow-hidden">
                    <DynamicGradientBorder />
                    <div className="relative z-10">
                      <h3 className="font-semibold mb-4">Dividend History</h3>
                      {dividendHistory.length > 0 ? (
                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-muted-foreground text-xs uppercase">
                              <tr>
                                <th className="px-4 py-3 font-medium">Fiscal Year</th>
                                <th className="px-4 py-3 font-medium text-right">Bonus %</th>
                                <th className="px-4 py-3 font-medium text-right">Cash %</th>
                                <th className="px-4 py-3 font-medium text-right">Total %</th>
                                <th className="px-4 py-3 font-medium">Book Closure</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {dividendHistory.map((d: any, idx: number) => (
                                <tr key={idx} className={`transition-colors hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                                  <td className="px-4 py-3 font-mono">{d.fiscalYear}</td>
                                  <td className="px-4 py-3 text-right">{d.bonusPercent.toFixed(2)}%</td>
                                  <td className="px-4 py-3 text-right">{d.cashPercent.toFixed(2)}%</td>
                                  <td className="px-4 py-3 text-right font-semibold text-primary">{d.totalPercent.toFixed(2)}%</td>
                                  <td className="px-4 py-3 text-muted-foreground">{d.bookClosureDateAD || d.bookClosureDateBS || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/10">
                          {isLoading ? "Loading dividend data..." : "No dividend history found for this symbol."}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Manage / Fallback tab (inline) */}
                  <TabsContent value="manage" className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-4">Manage Quarters</h3>
                    
                    <details className="mb-6 group">
                      <summary className="cursor-pointer text-sm font-medium flex items-center gap-2 p-3 rounded-lg bg-muted/50 border hover:bg-muted/80 transition-colors list-none">
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        PDF Upload Fallback
                        <span className="text-xs text-muted-foreground ml-auto">Click to expand</span>
                      </summary>
                      <div className="p-4 pt-4 border-x border-b rounded-b-lg border-t-0 bg-muted/20">
                        <p className="text-xs text-muted-foreground mb-4">
                          If NepseAlpha has not published the latest quarter yet, you can upload the company's official PDF report here as a temporary fallback.
                        </p>
                        <QuarterlyUploadZone onUploadSuccess={handleUploadSuccess} />
                      </div>
                    </details>

                    {/* Quarter history + delete */}
                    {quarters.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3">Stored Quarters</h4>
                        <div className="space-y-2">
                          {[...quarters].reverse().map(q => (
                            <div key={`${q.fy}-${q.quarter}`}
                              className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                              <div>
                                <span className="font-mono text-sm font-semibold">{q.quarter_label}</span>
                                <span className="text-xs text-muted-foreground ml-3">{q.period_end_text}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(q.parsed_at).toLocaleDateString()}
                                </span>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete {q.quarter_label}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently remove the {q.quarter_label} data for {selectedSymbol}.
                                        You can re-upload the PDF to restore it.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(q)} className="bg-red-500 hover:bg-red-600">
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
    </div>
  );
};

export default QuarterlyPage;
