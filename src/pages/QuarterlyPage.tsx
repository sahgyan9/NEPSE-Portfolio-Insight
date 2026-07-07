// src/pages/QuarterlyPage.tsx
// Main quarterly financial reports page
// Features: stock selector, PDF upload zone, trend charts, data table, delete quarters

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, RefreshCw, Trash2,
  TrendingUp, BarChart2, Table2, Upload,
  AlertCircle, Building2, Calendar, Loader2, Search, Download, X
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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QuarterlyUploadZone } from '@/components/QuarterlyUploadZone';
import { QuarterlyTrendChart } from '@/components/QuarterlyTrendChart';
import { QuarterlyDataTable } from '@/components/QuarterlyDataTable';
import { StockSymbolLink } from '@/components/StockSymbolLink';
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
import { STORAGE_KEYS } from '@/lib/constants';

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
  <div className="p-4 rounded-xl border border-border bg-card">
    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-bold font-mono mt-1">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const QuarterlyPage = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.apiKey) || '');
  const [stocks, setStocks] = useState<SymbolListItem[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const symbolParam = searchParams.get('symbol');
  const [selectedSymbol, setSelectedSymbol] = useState<string>(symbolParam?.toUpperCase() || '');
  const [symbolData, setSymbolData] = useState<SymbolQuarterlyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [activeTab, setActiveTab] = useState('trends');
  const [unfetchedSymbols, setUnfetchedSymbols] = useState<string[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState('');

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      if (!stock || !stock.symbol) return false;
      const sym = (stock.symbol || '').toLowerCase();
      const name = (stock.company_name || '').toLowerCase();
      const q = stockSearchQuery.toLowerCase();
      return sym.includes(q) || name.includes(q);
    });
  }, [stocks, stockSearchQuery]);

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
    if (selectedSymbol) {
      setSearchParams({ symbol: selectedSymbol });
    }
  }, [selectedSymbol, setSearchParams]);

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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadStocks(); }, []);
  useEffect(() => {
    if (selectedSymbol) {
      loadSymbolData(selectedSymbol);
      setActiveTab('trends');
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
        apiKey={apiKey}
        onApiKeyChange={(k) => { setApiKey(k); localStorage.setItem(STORAGE_KEYS.apiKey, k); }}
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
            Drop any quarterly PDF — company, year &amp; quarter auto-detected. Track trends across all quarters.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
          {/* ── Left sidebar ────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Fetch zone */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" /> Fetch from NepseAlpha
              </h2>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Symbol (e.g. SAHAS)"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchNepseAlpha(newSymbol)}
                    className="w-full pl-9 h-9 flex rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <Button 
                  size="sm" 
                  className="h-9" 
                  disabled={isFetching || !newSymbol.trim()}
                  onClick={() => handleFetchNepseAlpha(newSymbol)}
                >
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                </Button>
              </div>
              {unfetchedSymbols.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground/80 mb-1.5 tracking-wider">Unfetched Watchlist / Portfolio:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {unfetchedSymbols.slice(0, 6).map(sym => (
                      <Badge 
                        key={sym} 
                        variant="outline" 
                        className="cursor-pointer hover:bg-secondary/80 font-mono text-[10px] px-1.5 py-0.5 border-dashed border-muted-foreground/30"
                        onClick={() => handleFetchNepseAlpha(sym)}
                      >
                        {sym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stock list */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Stocks with Data
                </h2>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={loadStocks}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>

              {stocks.length > 0 && (
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filter stocks..."
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 h-8 flex rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {stockSearchQuery && (
                    <button 
                      onClick={() => setStockSearchQuery('')}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {stocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No data yet. Upload a quarterly PDF to get started.
                </div>
              ) : filteredStocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No stocks match "{stockSearchQuery}"
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {filteredStocks.map(stock => (
                    <button
                      key={stock.symbol}
                      onClick={() => setSelectedSymbol(stock.symbol)}
                      className={`w-full text-left p-3 rounded-lg border transition-all
                        ${selectedSymbol === stock.symbol
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm">{stock.symbol}</span>
                        <Badge variant="outline" className={`text-xs ${getSectorStyle(stock.sector).color}`}>
                          {getSectorStyle(stock.sector).label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{stock.company_name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{stock.quarter_count} quarter{stock.quarter_count !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Main content ────────────────────────────────────────────────── */}
          <div>
            {!selectedSymbol ? (
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border text-muted-foreground gap-3 p-6 text-center">
                <Download className="w-12 h-12 opacity-30" />
                <p className="font-medium">Fetch a stock symbol from NepseAlpha to begin</p>
                <p className="text-sm">Type a symbol like SAHAS or MEN in the sidebar and click Fetch.</p>
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
                  <TabsList className="grid grid-cols-4 mb-4">
                    <TabsTrigger value="trends" className="gap-1.5 text-xs sm:text-sm">
                      <TrendingUp className="w-4 h-4" /><span className="hidden sm:inline">Trends</span>
                    </TabsTrigger>
                    <TabsTrigger value="screen2" className="gap-1.5 text-xs sm:text-sm">
                      <Table2 className="w-4 h-4" /><span className="hidden sm:inline">Balance Sheet</span>
                    </TabsTrigger>
                    <TabsTrigger value="screen1" className="gap-1.5 text-xs sm:text-sm">
                      <BarChart2 className="w-4 h-4" /><span className="hidden sm:inline">Ratios</span>
                    </TabsTrigger>
                    <TabsTrigger value="manage" className="gap-1.5 text-xs sm:text-sm">
                      <AlertCircle className="w-4 h-4" /><span className="hidden sm:inline">Manage</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Trends tab */}
                  <TabsContent value="trends" className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-4">Quarterly Trends — All Years</h3>
                    {isLoading ? (
                      <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>
                    ) : (
                      <ErrorBoundary label="Quarterly Chart">
                        <QuarterlyTrendChart quarters={quarters} companyName={symbolData?.company_name} />
                      </ErrorBoundary>
                    )}
                  </TabsContent>

                  {/* Balance Sheet table */}
                  <TabsContent value="screen2" className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-4">Balance Sheet + P&L (Rs Crore)</h3>
                    <QuarterlyDataTable quarters={quarters} mode="screen2" />
                  </TabsContent>

                  {/* Ratios table */}
                  <TabsContent value="screen1" className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-4">Ratio Metrics</h3>
                    <QuarterlyDataTable quarters={quarters} mode="screen1" />
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
    </div>
  );
};

export default QuarterlyPage;
