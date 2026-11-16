// src/pages/QuarterlyPage.tsx
// Main quarterly financial reports page
// Features: stock selector, trend charts, data tables, dividends, PDF upload fallback, delete quarters
// Simple view: one plain sentence, the trend chart and the five key numbers for the sector.

import { StockResearchBlock } from "@/components/research/StockResearchBlock";
import { EpsInsightCard, fmtPct } from "@/components/research/EpsInsightCard";
import { SectorPicks } from "@/components/research/SectorPicks";
import { useEpsInsights } from "@/services/epsInsightsApi";
import { useMySymbols, useSectorScreen } from "@/services/sectorScreenApi";
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, RefreshCw, Trash2,
  TrendingUp, BarChart2, Table2, Upload,
  AlertCircle, Calendar, Loader2, Search, Download, X, Coins
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
import { Explain } from '@/components/Explain';
import { QuarterlyUploadZone } from '@/components/QuarterlyUploadZone';
import { QuarterlyTrendChart, quarterNetProfit } from '@/components/QuarterlyTrendChart';
import { QuarterlyDataTable } from '@/components/QuarterlyDataTable';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import {
  listQuarterlyStocks,
  getQuarterlyData,
  deleteQuarter,
  fetchQuarterlyData,
} from '@/services/quarterlyApi';
import { fetchStockData, type ShareBazaarResponse } from '@/services/sharebazaarApi';
import type {
  SymbolListItem,
  SymbolQuarterlyData,
  UploadSuccessResponse,
  QuarterRecord,
} from '@/types/quarterly';
import { useApiKey } from '@/hooks/useApiKey';
import { useViewMode } from '@/hooks/useViewMode';
import { useT } from '@/i18n';
import { fmtDate, fmtMoney, fmtMoneyCompact, fmtNumber, fmtPercent } from '@/i18n/format';

// ── Sector badge colours & labels ─────────────────────────────────────────────
const SECTOR_NAME_KEYS: [string, string][] = [
  ['bank', 'secBank'],
  ['hydro', 'secHydro'],
  ['microfinance', 'secMicrofinance'],
  ['manufacturing', 'secManufacturing'],
  ['processing', 'secManufacturing'],
  ['insurance', 'secInsurance'],
  ['finance', 'secFinance'],
  ['hotel', 'secHotel'],
  ['tourism', 'secHotel'],
  ['investment', 'secInvestment'],
  ['trading', 'secTrading'],
];

const getSectorStyle = (sector: string = '', t: (key: string) => string) => {
  const s = (sector || '').toLowerCase();
  const nameKey = SECTOR_NAME_KEYS.find(([word]) => s.includes(word))?.[1];
  const label = nameKey ? t(`quarterly.${nameKey}`) : sector ? sector : t('quarterly.secOther');
  if (s.includes('bank')) return { color: 'bg-green-500/10 text-green-700 border-green-500/20', label };
  if (s.includes('hydro')) return { color: 'bg-blue-500/10 text-blue-700 border-blue-500/20', label };
  if (s.includes('microfinance')) return { color: 'bg-purple-500/10 text-purple-700 border-purple-500/20', label };
  if (s.includes('manufacturing') || s.includes('processing')) return { color: 'bg-orange-500/10 text-orange-700 border-orange-500/20', label };
  if (s.includes('insurance')) return { color: 'bg-pink-500/10 text-pink-700 border-pink-500/20', label };
  if (s.includes('finance')) return { color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20', label };
  if (s.includes('hotel') || s.includes('tourism')) return { color: 'bg-teal-500/10 text-teal-700 border-teal-500/20', label };
  if (s.includes('investment')) return { color: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20', label };
  if (s.includes('trading')) return { color: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20', label };
  return { color: 'bg-muted text-muted-foreground border-border', label };
};

const startYear = (fy: string): number => parseInt(fy.split(/[-/]/)[0], 10);

// ── Mini KPI Card ─────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, explain }: { label: string; value: string; sub?: string; explain?: React.ReactNode }) => (
  <div className="p-4 rounded-xl border border-border bg-card">
    <p className="text-xs text-muted-foreground font-medium leading-relaxed">
      {label} {explain}
    </p>
    <p className="text-2xl font-bold font-mono mt-1">{value}</p>
    {sub && <p className="text-xs leading-relaxed text-muted-foreground mt-1">{sub}</p>}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const QuarterlyPage = () => {
  const { t } = useT();
  const { isSimple, setMode } = useViewMode();
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

  // The user's own stocks, their earnings notes and the sector ranking
  const { data: mine } = useMySymbols();
  const { data: epsInsights } = useEpsInsights();
  const { data: screen } = useSectorScreen();

  const myStocks = useMemo(() => {
    if (!mine) return [];
    const withData = new Set(stocks.filter(s => s && s.symbol).map(s => s.symbol));
    const insight = new Map((epsInsights?.holdings ?? []).map(h => [h.symbol, h]));
    return [
      ...Object.keys(mine.held).map(symbol => ({ symbol, held: true })),
      ...mine.watchlist.map(symbol => ({ symbol, held: false })),
    ]
      .filter(s => withData.has(s.symbol))
      .map(s => ({ ...s, insight: insight.get(s.symbol) }));
  }, [mine, stocks, epsInsights]);

  // Picking a stock from the shortcut lists means "show me its quarterly data":
  // select it and bring the company section into view.
  const detailsRef = useRef<HTMLDivElement>(null);
  const openSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const sharesHeld = mine?.held[selectedSymbol];
  const avgCost = mine?.avgCost?.[selectedSymbol];
  const onWatchlist = !!mine && mine.watchlist.includes(selectedSymbol);
  const sectorRank = useMemo(() => {
    for (const list of Object.values(screen?.sectors ?? {})) {
      const i = list.findIndex(s => s.symbol === selectedSymbol);
      if (i >= 0) return { rank: list[i].rank || i + 1, sector: list[i].sector };
    }
    return null;
  }, [screen, selectedSymbol]);

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
      // Open on one of the user's own holdings when there is one with data.
      let first = list[0].symbol;
      try {
        const res = await fetch(import.meta.env.DEV ? '/api/portfolio-db/api/holdings' : 'http://localhost:5001/api/holdings');
        if (res.ok) {
          const held: { symbol?: string }[] = (await res.json()).holdings || [];
          const heldSyms = new Set(held.map(h => String(h?.symbol || '').toUpperCase()));
          const own = list.find(s => s && heldSyms.has(s.symbol));
          if (own) first = own.symbol;
        }
      } catch {
        // Portfolio server not running: fall back to the first stock.
      }
      setSelectedSymbol(first);
    }
  }, [selectedSymbol, symbolParam]);

  // The Manage tab holds upload and delete tools: advanced view only.
  const effectiveTab = isSimple && activeTab === 'manage' ? 'trends' : activeTab;

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

        // Track symbol -> company name so we can skip funds/bonds, which never
        // publish quarterly EPS/financials and would otherwise sit here forever.
        const symName = new Map<string, string>();
        const pushSyms = (items: any[], symKey: string, nameKey: string) => {
          for (const it of items || []) {
            const sym = it?.[symKey];
            if (sym) symName.set(sym, it?.[nameKey] || '');
          }
        };
        if (holdingsRes.ok) {
          const data = await holdingsRes.json();
          pushSyms(data.holdings, 'symbol', 'company');
        }
        if (watchlistRes.ok) {
          const data = await watchlistRes.json();
          pushSyms(data.watchlist, 'symbol', 'company');
        }

        // Mutual funds, schemes and bonds/debentures have no quarterly reports.
        // Detect by known symbols plus name keywords (catches future funds too).
        const KNOWN_NON_QUARTERLY = new Set(['CSBY', 'KDBY', 'MMF1', 'NBF3', 'NIBLSF', 'NMBSBFE']);
        const FUND_BOND_NAME = /\b(fund|yojana|kosh|scheme|balanced|yield|bachat|samriddhi|debenture|bond)\b/i;
        const isNonQuarterly = (sym: string) =>
          KNOWN_NON_QUARTERLY.has(sym) || FUND_BOND_NAME.test(symName.get(sym) || '');

        const uniqueSyms = Array.from(symName.keys());
        const fetchedSyms = new Set(stocks.filter(s => s && s.symbol).map(s => s.symbol));
        const missing = uniqueSyms.filter(sym => !fetchedSyms.has(sym) && !isNonQuarterly(sym));
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
        const divUrl = import.meta.env.DEV ? `/api/nepse-server/api/dividends/history/${symbol}` : `http://localhost:8002/api/dividends/history/${symbol}`;
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

  // Live price for the selected stock (local NEPSE server, ShareBazaar fallback)
  const [quote, setQuote] = useState<ShareBazaarResponse | null>(null);
  useEffect(() => {
    if (!selectedSymbol) return;
    let cancelled = false;
    setQuote(null);
    fetchStockData(selectedSymbol)
      .then(q => { if (!cancelled) setQuote(q && q.ltp > 0 ? q : null); })
      .catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
  }, [selectedSymbol]);

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
        title: t('quarterly.toastFetched', { symbol: sym }),
        description: t('quarterly.toastFetchedBody'),
      });
      await loadStocks();
      if (selectedSymbol === sym.toUpperCase()) {
        await loadSymbolData(sym.toUpperCase());
      }
      openSymbol(sym.toUpperCase());
      setStockSearchQuery('');
    } catch (err: any) {
      toast({
        title: t('quarterly.toastFetchFail', { symbol: sym }),
        description: err.message || t('quarterly.toastFetchFailBody'),
        variant: 'destructive',
      });
    } finally {
      setIsFetching(false);
    }
  };

  // Handle successful upload (fallback)
  const handleUploadSuccess = async (result: UploadSuccessResponse) => {
    toast({
      title: t('quarterly.toastSaved', { quarter: result.quarter_label }),
      description: t('quarterly.toastSavedBody', {
        company: result.company_name,
        eps: result.computed.eps_ttm != null ? fmtMoney(Number(result.computed.eps_ttm), true) : '-',
      }),
    });
    await loadStocks();
    setSelectedSymbol(result.symbol);
  };

  // Delete a quarter
  const handleDelete = async (q: QuarterRecord) => {
    const ok = await deleteQuarter(q.symbol, q.fy, q.quarter);
    if (ok) {
      toast({ title: t('quarterly.toastDeleted', { quarter: q.quarter_label }), variant: 'default' });
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
      toast({ title: t('quarterly.toastDeleteFail'), variant: 'destructive' });
    }
  };

  const quarters = symbolData?.quarters ?? [];
  const latestQ: QuarterRecord | undefined = quarters[quarters.length - 1];

  // One plain sentence from data already loaded: net profit so far this fiscal year,
  // against the same point last year. Empty when either figure is missing.
  const summary = useMemo(() => {
    if (!latestQ) return null;
    const cur = quarterNetProfit(latestQ);
    if (cur == null) return null;
    const prior = quarters.find(q => q.quarter === latestQ.quarter && startYear(q.fy) === startYear(latestQ.fy) - 1);
    const prev = prior ? quarterNetProfit(prior) : null;
    if (prev == null) return null;
    const qName = latestQ.quarter >= 1 && latestQ.quarter <= 4 ? t(`quarterly.qName${latestQ.quarter}`) : latestQ.quarter_label;
    const vars = {
      symbol: selectedSymbol,
      quarter: qName,
      fy: latestQ.fy,
      amount: fmtMoneyCompact(cur),
      prev: fmtMoneyCompact(prev),
    };
    if (cur > 0 && prev > 0) {
      const change = (cur / prev - 1) * 100;
      if (Math.abs(change) < 0.5) return t('quarterly.sumSame', vars);
      return t(change > 0 ? 'quarterly.sumUp' : 'quarterly.sumDown', { ...vars, pct: Math.abs(change).toFixed(1) });
    }
    return t('quarterly.sumPlain', vars);
  }, [quarters, latestQ, selectedSymbol, t]);

  const tabClass = 'min-h-11 shrink-0 gap-1.5 px-3 text-sm';
  const panelClass = 'rounded-xl border border-border bg-card p-3 sm:p-5';

  const trendsBody = (
    <>
      {summary && (
        <p className="mb-4 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-foreground">{summary}</p>
      )}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground" role="status">{t('quarterly.loading')}</div>
      ) : (
        <ErrorBoundary label={t('quarterly.trendsTitle')}>
          <QuarterlyTrendChart quarters={quarters} companyName={symbolData?.company_name} />
        </ErrorBoundary>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header
        onRefresh={() => { loadStocks(); if (selectedSymbol) loadSymbolData(selectedSymbol); }}
        isRefreshing={isLoading}
      />

      <main className="container max-w-7xl px-4 py-6">
        {/* Back nav */}
        <div className="mb-4 md:mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="h-11 gap-2 md:h-9">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t('quarterly.back')}
            </Button>
          </Link>
        </div>

        {/* Page header */}
        <div className="mb-6 md:mb-8">
          <h1 className="mb-2 flex items-center gap-3 text-2xl font-bold leading-snug md:text-3xl">
            <FileText className="h-7 w-7 shrink-0 text-primary md:h-8 md:w-8" aria-hidden="true" />
            {t('quarterly.title')}
          </h1>
          <p className="leading-relaxed text-muted-foreground">
            {t('quarterly.intro')}
          </p>
        </div>

        <div className="space-y-6">
          {/* ── Top Control Bar (Search & Filter) ─────────────────────── */}
          <div className="relative z-20 flex flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-3 md:flex-row md:items-center md:gap-4 md:p-4">
            <Search className="ml-2 hidden h-5 w-5 text-muted-foreground md:block" aria-hidden="true" />
            <div className="relative w-full flex-1">
              <input
                type="text"
                placeholder={t('quarterly.searchPlaceholder')}
                aria-label={t('quarterly.searchAria')}
                value={stockSearchQuery}
                onChange={(e) => { setStockSearchQuery(e.target.value.toUpperCase()); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setShowSuggestions(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && stockSearchQuery.trim()) {
                    const exactMatch = stocks.find(s => s.symbol === stockSearchQuery.trim());
                    if (exactMatch) {
                      openSymbol(exactMatch.symbol);
                      setShowSuggestions(false);
                      setStockSearchQuery('');
                    } else {
                      handleFetchNepseAlpha(stockSearchQuery.trim());
                      setShowSuggestions(false);
                      setStockSearchQuery('');
                    }
                  }
                }}
                className="flex h-12 w-full rounded-lg border border-input bg-background py-2 pl-4 pr-12 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              {stockSearchQuery && (
                <button
                  type="button"
                  aria-label={t('quarterly.clearSearch')}
                  onMouseDown={(e) => { e.preventDefault(); setStockSearchQuery(''); }}
                  className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>

            <Select value={sectorFilter} onValueChange={(val) => { setSectorFilter(val); setShowSuggestions(true); }}>
              <SelectTrigger className="h-12 w-full bg-background md:w-[220px]" aria-label={t('quarterly.sectorAria')}>
                <SelectValue placeholder={t('quarterly.allSectors')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('quarterly.allSectors')}</SelectItem>
                <SelectItem value="bank">{t('quarterly.secBank')}</SelectItem>
                <SelectItem value="hydro">{t('quarterly.secHydro')}</SelectItem>
                <SelectItem value="microfinance">{t('quarterly.secMicrofinance')}</SelectItem>
                <SelectItem value="insurance">{t('quarterly.secInsurance')}</SelectItem>
                <SelectItem value="finance">{t('quarterly.secFinance')}</SelectItem>
                <SelectItem value="manufacturing">{t('quarterly.secManufacturing')}</SelectItem>
                <SelectItem value="hotel">{t('quarterly.secHotel')}</SelectItem>
                <SelectItem value="investment">{t('quarterly.secInvestment')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Auto-suggest dropdown */}
            {showSuggestions && (
              <div className="scrollbar-thin absolute left-0 right-0 top-[105%] z-50 flex max-h-[450px] flex-col overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                {/* 1. Show existing fetched stocks */}
                {filteredStocks.length > 0 && (
                  <div className="space-y-1 p-2">
                    {filteredStocks.map(stock => {
                      const sector = getSectorStyle(stock.sector ?? '', t);
                      return (
                        <button
                          type="button"
                          key={stock.symbol}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            openSymbol(stock.symbol);
                            setShowSuggestions(false);
                            setStockSearchQuery('');
                          }}
                          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg p-3 text-left transition-colors hover:bg-muted/80
                            ${selectedSymbol === stock.symbol ? 'bg-primary/10' : ''}`}
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold">{stock.symbol}</span>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{stock.company_name}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge variant="outline" className={`px-1.5 py-0 text-xs ${sector.color}`}>
                              {sector.label}
                            </Badge>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" aria-hidden="true" /> {t('quarterly.qCount', { n: stock.quarter_count })}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. Option to fetch or update the typed stock */}
                {stockSearchQuery.trim() && (
                  <div className="border-t border-border/50 bg-primary/5 p-2">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleFetchNepseAlpha(stockSearchQuery.trim());
                        setShowSuggestions(false);
                        setStockSearchQuery('');
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg p-3 text-left text-primary transition-colors hover:bg-primary/15"
                    >
                      {isFetching ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />}
                      <div>
                        <span className="block font-bold">
                          {stocks.some(s => s.symbol === stockSearchQuery.trim())
                            ? t('quarterly.updateData', { symbol: stockSearchQuery.trim() })
                            : t('quarterly.fetchData', { symbol: stockSearchQuery.trim() })}
                        </span>
                        <span className="text-xs leading-relaxed opacity-80">{t('quarterly.fetchHelp')}</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* 3. Missing watchlist items */}
                {unfetchedSymbols.filter(sym => sym.includes(stockSearchQuery.trim())).length > 0 && (
                  <div className="border-t border-border/50 p-2">
                    <p className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t('quarterly.missingTitle')}
                    </p>
                    <div className="space-y-1">
                      {unfetchedSymbols.filter(sym => sym.includes(stockSearchQuery.trim())).map(sym => (
                        <button
                          type="button"
                          key={sym}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleFetchNepseAlpha(sym);
                            setShowSuggestions(false);
                            setStockSearchQuery('');
                          }}
                          className="group flex min-h-11 w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-muted/80"
                        >
                          <span className="font-mono font-bold text-muted-foreground group-hover:text-foreground">{sym}</span>
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <Download className="h-3 w-3" aria-hidden="true" /> {t('quarterly.fetchShort')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No results fallback */}
                {filteredStocks.length === 0 && !stockSearchQuery.trim() && unfetchedSymbols.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">{t('quarterly.noMatch')}</div>
                )}
              </div>
            )}
          </div>

          {/* ── The user's own stocks ─────────────────────── */}
          {myStocks.length > 0 && (
            <section aria-label={t('quarterly.yourStocks')} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{t('quarterly.yourStocks')}</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">{t('quarterly.yourStocksHint')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {myStocks.map(({ symbol, held, insight }) => {
                  const g = insight?.growth_state === 'profit' ? insight.growth_yoy_pct : null;
                  const warn = insight?.flags.some(f => f.severity === 'high');
                  return (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => openSymbol(symbol)}
                      aria-current={selectedSymbol === symbol ? 'true' : undefined}
                      title={held ? t('quarterly.inPortfolio') : t('quarterly.onWatchlistTitle')}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted/60 md:min-h-9
                        ${held ? '' : 'border-dashed'}
                        ${selectedSymbol === symbol ? 'border-primary bg-primary/10' : 'border-border'}`}
                    >
                      <span className="font-mono font-semibold">{symbol}</span>
                      {g != null && (
                        <span className={`inline-flex items-center gap-0.5 font-mono text-xs ${g > 0 ? 'text-success' : g < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {g > 0 ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : null}
                          {fmtPct(g, 0, true)}
                        </span>
                      )}
                      {insight && g == null && insight.growth_state && insight.growth_state !== 'profit' && (
                        <span className="text-xs text-muted-foreground">
                          {insight.growth_state === 'turned_profitable' ? t('quarterly.nowProfitable') : t('quarterly.lossShort')}
                        </span>
                      )}
                      {warn && <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-label={t('quarterly.highNoteAria')} />}
                    </button>
                  );
                })}
              </div>
              {mine && mine.watchlist.length > 0 && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('quarterly.legendBorders')}</p>
              )}
            </section>
          )}

          {!isSimple && (
            <ErrorBoundary label={t('quarterly.yourStocks')}>
              <SectorPicks stocks={stocks} selectedSymbol={selectedSymbol} onSelect={openSymbol} />
            </ErrorBoundary>
          )}

          {/* ── Main Content (Company Details) ─────────────────────── */}
          <div ref={detailsRef} className="scroll-mt-20">
            {!selectedSymbol ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
                <Download className="h-12 w-12 opacity-30" aria-hidden="true" />
                <p className="text-lg font-medium">{t('quarterly.emptyTitle')}</p>
                <p className="text-sm leading-relaxed">{t('quarterly.emptyHelp')}</p>
              </div>
            ) : (
              <>
                {/* Company header */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <StockSymbolLink symbol={selectedSymbol} className="text-2xl font-bold font-mono" />
                      <Badge variant="outline" className={getSectorStyle(symbolData?.sector ?? '', t).color}>
                        {getSectorStyle(symbolData?.sector ?? '', t).label}
                      </Badge>
                      {sharesHeld != null && (
                        <Badge variant="outline" className="border-success/40 bg-success/10 font-normal text-success">
                          {t('quarterly.youHold', { n: fmtNumber(sharesHeld) })}
                        </Badge>
                      )}
                      {sharesHeld == null && onWatchlist && (
                        <Badge variant="outline" className="font-normal">{t('quarterly.onWatchlistBadge')}</Badge>
                      )}
                      {sectorRank && (
                        <Badge variant="outline" className="font-normal">
                          {t('quarterly.ranked', { rank: sectorRank.rank, sector: getSectorStyle(sectorRank.sector ?? '', t).label })}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{symbolData?.company_name}</p>
                    {(quote || avgCost != null) && (
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-sm">
                        {quote && (
                          <span>
                            <span className="text-muted-foreground">LTP </span>
                            <span className="font-semibold">{fmtMoney(quote.ltp, true)}</span>
                            {quote.change != null && quote.changePercent != null && (
                              <span className={`ml-2 ${quote.change > 0 ? 'text-success' : quote.change < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {quote.change > 0 ? '+' : ''}{fmtMoney(quote.change, true)} ({fmtPercent(quote.changePercent, 2)})
                              </span>
                            )}
                          </span>
                        )}
                        {avgCost != null && (
                          <span>
                            <span className="text-muted-foreground">{t('quarterly.yourAvgCost')} </span>
                            <span className="font-semibold">{fmtMoney(avgCost, true)}</span>
                            {quote && (() => {
                              const gain = (quote.ltp / avgCost - 1) * 100;
                              return (
                                <span className={`ml-2 ${gain > 0 ? 'text-success' : gain < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {t('quarterly.gainAtLtp', { pct: fmtPercent(gain, 1) })}
                                </span>
                              );
                            })()}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {!isSimple && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFetchNepseAlpha(selectedSymbol)}
                      disabled={isFetching}
                      className="h-11 w-full gap-2 text-xs sm:h-9 sm:w-auto"
                    >
                      {isFetching ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3 w-3" aria-hidden="true" />}
                      {t('quarterly.updateLatest')}
                    </Button>
                  )}
                </div>

                {isSimple ? (
                  <div className="space-y-5">
                    <section className={panelClass}>
                      <h3 className="mb-4 font-semibold">{t('quarterly.trendsTitle')}</h3>
                      {trendsBody}
                    </section>
                    <section className={panelClass}>
                      <h3 className="mb-4 font-semibold">{t('quarterly.keyNumbersTitle')}</h3>
                      <ErrorBoundary label={t('quarterly.keyNumbersTitle')}>
                        <QuarterlyDataTable quarters={quarters} mode="screen1" simple onShowAll={() => setMode('advanced')} />
                      </ErrorBoundary>
                    </section>
                  </div>
                ) : (
                  <>
                    <StockResearchBlock symbol={selectedSymbol} sector={symbolData?.sector} quarters={quarters} className="mb-5" />

                    {/* KPI summary from latest quarter */}
                    {latestQ && (
                      <ErrorBoundary label={t('quarterly.ratiosTitle')}>
                        <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                          <KpiCard
                            label={t('quarterly.kpiPe')}
                            explain={<Explain term="pe" />}
                            value={(() => {
                              const eps = latestQ.computed?.eps_ttm;
                              if (!quote || eps == null || Number(eps) === 0) return '-';
                              return (quote.ltp / Number(eps)).toFixed(1);
                            })()}
                            sub={latestQ.computed?.eps_ttm != null && Number(latestQ.computed.eps_ttm) < 0
                              ? t('quarterly.kpiPeLoss')
                              : t('quarterly.kpiPeSub')}
                          />
                          <KpiCard
                            label={t('quarterly.kpiEps')}
                            explain={<Explain term="ttmEps" />}
                            value={latestQ.computed?.eps_ttm != null ? fmtMoney(Number(latestQ.computed.eps_ttm), true) : '-'}
                            sub={latestQ.quarter_label}
                          />
                          <KpiCard
                            label={t('quarterly.kpiBvps')}
                            explain={<Explain term="bookValue" />}
                            value={latestQ.computed?.bvps != null ? fmtMoney(Number(latestQ.computed.bvps), true) : '-'}
                            sub={t('quarterly.kpiBvpsSub')}
                          />
                          <KpiCard
                            label={t('quarterly.kpiRoe')}
                            explain={<Explain term="roe" />}
                            value={latestQ.computed?.roe_ttm != null ? fmtPercent(Number(latestQ.computed.roe_ttm), 2, false) : '-'}
                            sub={t('quarterly.kpiRoeSub')}
                          />
                          <KpiCard
                            label={t('quarterly.kpiMargin')}
                            value={latestQ.computed?.net_margin != null ? fmtPercent(Number(latestQ.computed.net_margin), 2, false) : '-'}
                            sub={t('quarterly.kpiMarginSub')}
                          />
                        </div>
                      </ErrorBoundary>
                    )}

                    <ErrorBoundary label={t('quarterly.yourStocks')}>
                      <EpsInsightCard symbol={selectedSymbol} ltp={quote?.ltp} className="mb-5" />
                    </ErrorBoundary>

                    {/* Tabs */}
                    <Tabs value={effectiveTab} onValueChange={setActiveTab}>
                      <TabsList className="mb-4 flex h-auto w-full justify-start gap-1 overflow-x-auto p-1">
                        <TabsTrigger value="trends" className={tabClass}>
                          <TrendingUp className="h-4 w-4" aria-hidden="true" />{t('quarterly.tabTrends')}
                        </TabsTrigger>
                        <TabsTrigger value="screen2" className={tabClass}>
                          <Table2 className="h-4 w-4" aria-hidden="true" />{t('quarterly.tabBalance')}
                        </TabsTrigger>
                        <TabsTrigger value="screen1" className={tabClass}>
                          <BarChart2 className="h-4 w-4" aria-hidden="true" />{t('quarterly.tabRatios')}
                        </TabsTrigger>
                        <TabsTrigger value="dividends" className={tabClass}>
                          <Coins className="h-4 w-4" aria-hidden="true" />{t('quarterly.tabDividends')}
                        </TabsTrigger>
                        <TabsTrigger value="manage" className={tabClass}>
                          <AlertCircle className="h-4 w-4" aria-hidden="true" />{t('quarterly.tabManage')}
                        </TabsTrigger>
                      </TabsList>

                      {/* Trends tab */}
                      <TabsContent value="trends" className={panelClass}>
                        <h3 className="mb-4 font-semibold">{t('quarterly.trendsTitle')}</h3>
                        {trendsBody}
                      </TabsContent>

                      {/* Balance Sheet table */}
                      <TabsContent value="screen2" className={panelClass}>
                        <h3 className="mb-4 font-semibold">{t('quarterly.balanceTitle')}</h3>
                        <QuarterlyDataTable quarters={quarters} mode="screen2" />
                      </TabsContent>

                      {/* Ratios table */}
                      <TabsContent value="screen1" className={panelClass}>
                        <h3 className="mb-4 font-semibold">{t('quarterly.ratiosTitle')}</h3>
                        <QuarterlyDataTable quarters={quarters} mode="screen1" />
                      </TabsContent>

                      {/* Dividends tab */}
                      <TabsContent value="dividends" className={panelClass}>
                        <h3 className="mb-4 font-semibold">{t('quarterly.dividendsTitle')}</h3>
                        {dividendHistory.length > 0 ? (
                          <>
                            {/* Phone: one card per fiscal year */}
                            <div className="space-y-3 md:hidden">
                              {dividendHistory.map((d: any, idx: number) => (
                                <div key={idx} className="rounded-lg border border-border bg-background p-3">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <p className="font-mono font-semibold">{d.fiscalYear}</p>
                                    <p className="font-mono text-lg font-semibold text-primary">{fmtPercent(d.totalPercent, 2, false)}</p>
                                  </div>
                                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                    <dt className="text-muted-foreground">{t('quarterly.colBonus')}</dt>
                                    <dd className="text-right font-mono">{fmtPercent(d.bonusPercent, 2, false)}</dd>
                                    <dt className="text-muted-foreground">{t('quarterly.colCash')}</dt>
                                    <dd className="text-right font-mono">{fmtPercent(d.cashPercent, 2, false)}</dd>
                                    <dt className="text-muted-foreground">{t('quarterly.colBookClose')}</dt>
                                    <dd className="text-right">{d.bookClosureDateAD ? fmtDate(d.bookClosureDateAD) : d.bookClosureDateBS || t('quarterly.na')}</dd>
                                  </dl>
                                </div>
                              ))}
                            </div>

                            {/* Tablet and desktop: table */}
                            <div className="hidden overflow-x-auto rounded-md border md:block">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-muted text-xs text-muted-foreground">
                                  <tr>
                                    <th className="px-4 py-3 font-medium">{t('quarterly.colFy')}</th>
                                    <th className="px-4 py-3 text-right font-medium">
                                      <span className="inline-flex items-center gap-1">{t('quarterly.colBonus')}<Explain term="bonusShare" /></span>
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                      <span className="inline-flex items-center gap-1">{t('quarterly.colCash')}<Explain term="cashDividend" /></span>
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">{t('quarterly.colTotal')}</th>
                                    <th className="px-4 py-3 font-medium">
                                      <span className="inline-flex items-center gap-1">{t('quarterly.colBookClose')}<Explain term="bookClosure" /></span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {dividendHistory.map((d: any, idx: number) => (
                                    <tr key={idx} className={`transition-colors hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                                      <td className="px-4 py-3 font-mono">{d.fiscalYear}</td>
                                      <td className="px-4 py-3 text-right">{fmtPercent(d.bonusPercent, 2, false)}</td>
                                      <td className="px-4 py-3 text-right">{fmtPercent(d.cashPercent, 2, false)}</td>
                                      <td className="px-4 py-3 text-right font-semibold text-primary">{fmtPercent(d.totalPercent, 2, false)}</td>
                                      <td className="px-4 py-3 text-muted-foreground">{d.bookClosureDateAD ? fmtDate(d.bookClosureDateAD) : d.bookClosureDateBS || t('quarterly.na')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-lg border bg-muted/10 py-8 text-center leading-relaxed text-muted-foreground">
                            {isLoading ? t('quarterly.dividendsLoading') : t('quarterly.dividendsEmpty')}
                          </div>
                        )}
                      </TabsContent>

                      {/* Manage / Fallback tab (inline) */}
                      <TabsContent value="manage" className={panelClass}>
                        <h3 className="mb-4 font-semibold">{t('quarterly.manageTitle')}</h3>

                        <details className="group mb-6">
                          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm font-medium transition-colors hover:bg-muted/80">
                            <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            {t('quarterly.uploadFallback')}
                            <span className="ml-auto text-xs text-muted-foreground">{t('quarterly.clickExpand')}</span>
                          </summary>
                          <div className="rounded-b-lg border-x border-b border-t-0 bg-muted/20 p-3 pt-4 sm:p-4">
                            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                              {t('quarterly.uploadFallbackHelp')}
                            </p>
                            <QuarterlyUploadZone onUploadSuccess={handleUploadSuccess} />
                          </div>
                        </details>

                        {/* Quarter history + delete */}
                        {quarters.length > 0 && (
                          <div className="mt-6">
                            <h4 className="mb-3 text-sm font-semibold text-muted-foreground">{t('quarterly.storedQuarters')}</h4>
                            <div className="space-y-2">
                              {[...quarters].reverse().map(q => (
                                <div key={`${q.fy}-${q.quarter}`}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
                                  <div className="min-w-0">
                                    <span className="font-mono text-sm font-semibold">{q.quarter_label}</span>
                                    <span className="ml-3 text-xs text-muted-foreground">{q.period_end_text}</span>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {fmtDate(q.parsed_at)}
                                    </span>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-11 w-11 text-muted-foreground hover:text-destructive md:h-8 md:w-8"
                                          aria-label={t('quarterly.deleteAria', { quarter: q.quarter_label })}
                                        >
                                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{t('quarterly.deleteTitle', { quarter: q.quarter_label })}</AlertDialogTitle>
                                          <AlertDialogDescription className="leading-relaxed">
                                            {t('quarterly.deleteBody', { quarter: q.quarter_label, symbol: selectedSymbol })}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="h-11">{t('quarterly.cancel')}</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(q)} className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            {t('quarterly.delete')}
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
