import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Trash2, PlusCircle, ArrowLeft, Pencil, Check, X, Loader2, RefreshCw, Save, Database, Banknote, Sparkles, TrendingUp, DownloadCloud, Search, Info, HelpCircle, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ShareSparkline } from '@/components/ShareSparkline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    fetchPortfolioDividends,
    refreshDividendAnnouncements,
    PortfolioDividendsResponse,
} from '@/services/receivedDividendsApi';
import { STORAGE_KEYS } from '@/lib/constants';
import { fetchStockData, getCachedStockData } from '@/services/sharebazaarApi';
import { StockSymbolLink } from '@/components/StockSymbolLink';
import {
    getManualDividends,
    addManualDividend,
    updateManualDividend,
    deleteManualDividend,
    isManualDividendServerAvailable,
    ManualDividendEntry
} from '@/services/manualDividendDb';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { StockHolding, portfolioHoldings as localHoldings } from '@/data/portfolioData';
import { DynamicGradientBorder } from '@/components/DynamicGradientBorder';

interface DividendRow {
    id: string;
    symbol: string;
    companyName: string;
    fiscalYear: string;
    bonusPercent: number;
    cashPercent: number;
    cashIncome: number;
    disabled?: boolean;
    disabledReason?: string;
}

const DividendsPage = () => {
    const [apiKey, setApiKey] = useState('');
    const [rows, setRows] = useState<DividendRow[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<DividendRow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [serverAvailable, setServerAvailable] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [ltpMap, setLtpMap] = useState<Map<string, number>>(new Map());
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<string>('symbol');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const { toast } = useToast();

    // Auto dividends
    const [fiscalYear, setFiscalYear] = useState('081-082');
    const [portfolioData, setPortfolioData] = useState<PortfolioDividendsResponse | null>(null);
    const [isFetchingAuto, setIsFetchingAuto] = useState(true);
    const [isRefreshingAuto, setIsRefreshingAuto] = useState(false);
    const [holdings, setHoldings] = useState<StockHolding[]>([]);

    const [draft, setDraft] = useState<Omit<DividendRow, 'id'>>({
        symbol: '',
        companyName: '',
        fiscalYear: '081-082',
        bonusPercent: 0,
        cashPercent: 0,
        cashIncome: 0,
    });

    useEffect(() => {
        const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
        if (savedKey) setApiKey(savedKey);

        const loadData = async () => {
            // Load manual entries
            const available = await isManualDividendServerAvailable();
            setServerAvailable(available);
            const data = await getManualDividends();
            setRows(data);
            setIsLoading(false);

            // Load portfolio holdings to calculate yields
            try {
                setHoldings(localHoldings);
            } catch (e) {
                console.error("Failed to load portfolio holdings", e);
            }
        };

        loadData();
    }, []);

    // Load auto dividends
    useEffect(() => {
        const fetchAuto = async () => {
            setIsFetchingAuto(true);
            try {
                const data = await fetchPortfolioDividends(fiscalYear);
                setPortfolioData(data);
            } catch (error: any) {
                console.error("Failed to load portfolio dividends:", error);
            } finally {
                setIsFetchingAuto(false);
            }
        };
        fetchAuto();
    }, [fiscalYear, rows]); // Re-fetch auto when rows change (manual entries merged backend)

    // Load LTP for all symbols in portfolio
    useEffect(() => {
        if (!portfolioData) return;
        
        const symbols = portfolioData.companies.map(c => c.symbol);
        
        const loadLTPs = async () => {
            const newLtpMap = new Map<string, number>();
            for (const sym of symbols) {
                const cached = getCachedStockData(sym);
                if (cached && cached.last_traded_price) {
                    newLtpMap.set(sym, parseFloat(cached.last_traded_price));
                } else {
                    try {
                        const fresh = await fetchStockData(sym);
                        if (fresh && fresh.last_traded_price) {
                            newLtpMap.set(sym, parseFloat(fresh.last_traded_price));
                        }
                    } catch (e) {
                        console.error(`Failed LTP for ${sym}`);
                    }
                }
            }
            setLtpMap(newLtpMap);
        };
        loadLTPs();
    }, [portfolioData]);

    const handleApiKeyChange = (key: string) => {
        setApiKey(key);
        localStorage.setItem(STORAGE_KEYS.apiKey, key);
    };

    const handleRefreshAuto = async () => {
        setIsRefreshingAuto(true);
        try {
            await refreshDividendAnnouncements();
            const data = await fetchPortfolioDividends(fiscalYear);
            setPortfolioData(data);
            toast({ title: "Success", description: "Dividend announcements refreshed from NepaliPaisa." });
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to refresh", variant: "destructive" });
        } finally {
            setIsRefreshingAuto(false);
        }
    };

    // Manual Entry functions
    const addRow = async () => {
        if (!draft.symbol) return;
        const newEntry = { ...draft, symbol: draft.symbol.toUpperCase() };
        setIsSaving(true);
        try {
            const updatedEntries = await addManualDividend(newEntry as ManualDividendEntry);
            setRows(updatedEntries);
            setDraft({ ...draft, symbol: '', companyName: '', bonusPercent: 0, cashPercent: 0, cashIncome: 0 });
            toast({ title: "Success", description: "Manual dividend entry added." });
        } catch (error: any) {
            setSaveError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteRow = async (id: string) => {
        setIsSaving(true);
        try {
            const updatedEntries = await deleteManualDividend(id);
            setRows(updatedEntries);
            toast({ title: "Success", description: "Entry removed." });
        } catch (error: any) {
            setSaveError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (row: DividendRow) => {
        setEditingId(row.id);
        setEditDraft({ ...row });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditDraft(null);
    };

    const saveEditing = async () => {
        if (!editDraft) return;
        setIsSaving(true);
        try {
            const updatedEntry = { ...editDraft, symbol: editDraft.symbol.toUpperCase() };
            const updatedEntries = await updateManualDividend(editDraft.id, updatedEntry as ManualDividendEntry);
            setRows(updatedEntries);
            toast({ title: "Success", description: "Entry updated." });
        } catch (error: any) {
            setSaveError(error.message);
        } finally {
            setIsSaving(false);
            setEditingId(null);
            setEditDraft(null);
        }
    };

    const statusLabel: Record<string, { text: string; className: string }> = {
        'announced': { text: 'Announced', className: 'bg-amber-500/10 text-amber-500' },
        'book-closure-upcoming': { text: 'Upcoming BC', className: 'bg-blue-500/10 text-blue-500' },
        'book-closed': { text: 'Book Closed', className: 'bg-emerald-500/10 text-emerald-500' },
    };

    const totalCashIncome = useMemo(() => rows.reduce((sum, r) => sum + (r.cashIncome || 0), 0), [rows]);

    return (
        <div className="min-h-screen bg-background">
            <Header apiKey={apiKey} onApiKeyChange={handleApiKeyChange} onRefresh={handleRefreshAuto} isRefreshing={isRefreshingAuto} />

            <main className="container px-4 py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
                    </Link>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Dividends & Income</h1>
                        <p className="text-muted-foreground text-sm">
                            Auto-tracked dividends for your holdings. Bonus shares are valued using real-time market prices (LTP).
                        </p>
                    </div>
                </div>

                {/* Auto Dividends Dashboard Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-emerald-500" />
                            Portfolio Income Dashboard
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Auto-calculated based on your current portfolio holdings.</p>
                    </div>
                </div>
                        {isFetchingAuto ? (
                            <div className="h-40 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                            </div>
                        ) : portfolioData ? (
                            <>
                                {(() => {
                                    const { totals, companies } = portfolioData;

                                    const enhancedCompanies = companies.map(c => {
                                        const ltp = ltpMap.get(c.symbol) || 100; // fallback par value
                                        const trueBonusValue = c.received.bonusShares * ltp;
                                        return { ...c, trueBonusValue, ltp };
                                    });

                                    let filteredCompanies = enhancedCompanies;
                                    if (searchQuery) {
                                        const q = searchQuery.toLowerCase();
                                        filteredCompanies = enhancedCompanies.filter(c => c.symbol.toLowerCase().includes(q) || c.companyName.toLowerCase().includes(q));
                                    }

                                    const totalTrueBonusValue = enhancedCompanies.reduce((acc, c) => acc + c.trueBonusValue, 0);
                                    const totalPortfolioValue = holdings.reduce((acc, h) => acc + (h.currentValue || 0), 0);
                                    const totalTrueIncomeForYear = totals.cashNet + totalTrueBonusValue;
                                    const dividendYield = totalPortfolioValue > 0 ? (totalTrueIncomeForYear / totalPortfolioValue) * 100 : 0;

                                    const handleSort = (key: string) => {
                                        if (sortKey === key) {
                                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortKey(key);
                                            setSortOrder('desc'); 
                                        }
                                    };

                                    const sortedCompanies = [...filteredCompanies].sort((a, b) => {
                                        let aVal: any = a[sortKey as keyof typeof a];
                                        let bVal: any = b[sortKey as keyof typeof b];

                                        if (sortKey === 'cashNet') {
                                            aVal = a.received.cashNet;
                                            bVal = b.received.cashNet;
                                        } else if (sortKey === 'bonusShares') {
                                            aVal = a.received.bonusShares;
                                            bVal = b.received.bonusShares;
                                        }

                                        if (typeof aVal === 'string' && typeof bVal === 'string') {
                                            return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                                        }
                                        return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
                                    });

                                    const columnColors = {
                                        symbol: "text-primary",
                                        announced: "text-amber-500",
                                        bookClosure: "text-muted-foreground",
                                        bonusShares: "text-emerald-500",
                                        cashNet: "text-blue-500",
                                        status: "text-slate-400",
                                    };

                                    const SortableHeader = ({ label, sortKeyName, colorClass }: { label: string; sortKeyName: string; colorClass?: string }) => (
                                        <button onClick={() => handleSort(sortKeyName)} className={cn("flex items-center gap-1 hover:opacity-80 transition-colors font-semibold outline-none", colorClass)}>
                                            {label}
                                            <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    );

                                    return (
                                        <div className="space-y-6">
                                            {/* KPI Section */}
                                            <section id="dividend-kpis">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <Card className="border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                        <DynamicGradientBorder />
                                                        <CardContent className="p-4 flex flex-col justify-center relative z-10">
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-2"><Banknote className="h-4 w-4" /> Cash Received (net)</div>
                                                            <div className="text-2xl font-bold font-mono">Rs. {totals.cashNet.toLocaleString('en-NP', { maximumFractionDigits: 0 })}</div>
                                                            <div className="text-[11px] text-muted-foreground font-mono mt-1">gross Rs. {totals.cashGross.toLocaleString('en-NP', { maximumFractionDigits: 0 })} − 5% tax</div>
                                                        </CardContent>
                                                    </Card>
                                                    <Card className="border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                        <DynamicGradientBorder />
                                                        <CardContent className="p-4 flex flex-col justify-center relative z-10">
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-2"><TrendingUp className="h-4 w-4" /> Bonus Shares Added</div>
                                                            <div className="text-2xl font-bold font-mono text-emerald-500">+{totals.bonusShares}</div>
                                                            <div className="text-[11px] text-muted-foreground font-mono mt-1">true value Rs. {totalTrueBonusValue.toLocaleString('en-NP', { maximumFractionDigits: 0 })}</div>
                                                        </CardContent>
                                                    </Card>
                                                    <Card className="border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                        <DynamicGradientBorder />
                                                        <CardContent className="p-4 flex flex-col justify-center relative z-10">
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-2">Avg Portfolio Yield</div>
                                                            <div className="text-2xl font-bold font-mono text-blue-500">{dividendYield.toFixed(2)}%</div>
                                                            <div className="text-[11px] text-muted-foreground mt-1">True Income / Portfolio Value</div>
                                                        </CardContent>
                                                    </Card>
                                                    <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                                        <DynamicGradientBorder />
                                                        <CardContent className="p-4 flex flex-col justify-center relative z-10">
                                                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mb-2">Total True Value</div>
                                                            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">Rs. {totalTrueIncomeForYear.toLocaleString('en-NP', { maximumFractionDigits: 0 })}</div>
                                                            <div className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">bonus valued at current LTP</div>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            </section>
                                            
                                            {/* Table Section */}
                                            <section id="dividend-table">
                                                <Card className="border-border shadow-sm relative overflow-hidden">
                                                    <DynamicGradientBorder />
                                                    <CardContent className="p-0 relative z-10">
                                                        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                            <div className="relative w-full max-w-sm">
                                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                                <Input placeholder="Search dividends..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 bg-background" />
                                                            </div>
                                                            <div className="flex items-center gap-3 bg-background p-1.5 rounded-lg border">
                                                                <Label htmlFor="fy-select" className="text-xs font-semibold px-2 text-muted-foreground">FISCAL YEAR</Label>
                                                                <select
                                                                    id="fy-select"
                                                                    className="h-8 bg-background border rounded-md text-sm px-3 outline-none focus:ring-1 focus:ring-primary font-mono font-medium"
                                                                    value={fiscalYear}
                                                                    onChange={(e) => setFiscalYear(e.target.value)}
                                                                >
                                                                    <option value="081-082">081-082</option>
                                                                    <option value="080-081">080-081</option>
                                                                    <option value="079-080">079-080</option>
                                                                </select>
                                                                <Button variant="outline" size="sm" onClick={handleRefreshAuto} disabled={isRefreshingAuto} className="h-8 gap-2 bg-background">
                                                                    <RefreshCw className={`h-3 w-3 ${isRefreshingAuto ? 'animate-spin' : ''}`} />
                                                                    <span className="hidden sm:inline">Refresh</span>
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                <TooltipProvider delayDuration={300}>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead><SortableHeader label="Symbol" sortKeyName="symbol" colorClass={columnColors.symbol} /></TableHead>
                                                                <TableHead><SortableHeader label="Announced" sortKeyName="totalPercent" colorClass={columnColors.announced} /></TableHead>
                                                                <TableHead className={cn("hidden md:table-cell", columnColors.bookClosure)}>Book Closure</TableHead>
                                                                <TableHead><SortableHeader label="Shares Added" sortKeyName="bonusShares" colorClass={columnColors.bonusShares} /></TableHead>
                                                                <TableHead><SortableHeader label="Cash Received" sortKeyName="cashNet" colorClass={columnColors.cashNet} /></TableHead>
                                                                <TableHead className="hidden md:table-cell"><SortableHeader label="Status" sortKeyName="status" colorClass={columnColors.status} /></TableHead>
                                                                <TableHead>Bonus Shares (all-time)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {sortedCompanies.map((c) => (
                                                                <TableRow key={c.symbol}>
                                                                    <TableCell>
                                                                        <div className="font-semibold underline decoration-dashed hover:decoration-solid hover:text-primary transition-all cursor-pointer">
                                                                            <Link to={`/quarterly?symbol=${c.symbol}&tab=dividends`} className={cn("inline-flex items-center gap-1 hover:underline hover:opacity-80 transition-all", columnColors.symbol)}>
                                                                                {c.symbol}
                                                                            </Link>
                                                                        </div>
                                                                        <div className="text-[11px] text-muted-foreground max-w-[140px] truncate hidden md:block" title={c.companyName}>{c.companyName}</div>
                                                                        <div className="text-[10px] text-muted-foreground font-mono">{c.quantity} sh held</div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <div className={cn("font-medium", columnColors.announced)}>{c.totalPercent.toFixed(1)}% Total</div>
                                                                            <div className="text-[11px] text-muted-foreground flex gap-2"><span>B: {c.bonusPercent}%</span><span>C: {c.cashPercent}%</span></div>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className={cn("hidden md:table-cell text-sm", columnColors.bookClosure)}>
                                                                        {c.bookClosureDateAD ? (
                                                                            <div className="flex flex-col">
                                                                                <span>{c.bookClosureDateAD}</span>
                                                                                <span className="text-[10px] text-muted-foreground">{c.bookClosureDateBS}</span>
                                                                            </div>
                                                                        ) : c.source === 'manual' ? (
                                                                            <span className="text-muted-foreground/60 italic">Manually logged</span>
                                                                        ) : (<span className="text-muted-foreground/60 italic">Upcoming</span>)}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {c.received.bonusShares > 0 ? (
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <div className={cn("font-mono font-bold", columnColors.bonusShares)}>+{c.received.bonusShares}</div>
                                                                                {c.received.bonusSharesExact !== c.received.bonusShares && (
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <div className="text-[10px] text-muted-foreground cursor-help flex items-center gap-1 w-fit text-left">
                                                                                                (was {c.received.bonusSharesExact.toFixed(2)})
                                                                                                <Info className="h-2.5 w-2.5" />
                                                                                            </div>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent side="top">
                                                                                            <p className="text-xs"><strong>Fractional shares</strong><br />NEPSE pays fractions as cash.</p>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                )}
                                                                                <div className="text-[10px] text-muted-foreground">Value: Rs. {c.trueBonusValue.toLocaleString('en-NP', { maximumFractionDigits: 0 })}</div>
                                                                            </div>
                                                                        ) : (<span className="text-muted-foreground">-</span>)}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {c.received.cashGross > 0 ? (
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <div className={cn("font-mono font-medium", columnColors.cashNet)}>Rs. {c.received.cashNet.toLocaleString('en-NP', { maximumFractionDigits: 0 })}</div>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div className="text-[10px] text-muted-foreground cursor-help flex items-center gap-1 w-fit text-left">
                                                                                            gross Rs. {c.received.cashGross.toLocaleString('en-NP', { maximumFractionDigits: 0 })}
                                                                                            <Info className="h-2.5 w-2.5" />
                                                                                        </div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="top" className="max-w-xs">
                                                                                        <p className="text-xs"><strong>Dividend Tax Breakdown</strong><br />5% tax on cash and bonus par value.</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </div>
                                                                        ) : (<span className="text-muted-foreground">-</span>)}
                                                                    </TableCell>
                                                                    <TableCell className="hidden md:table-cell">
                                                                        <Badge variant="outline" className={`text-[10px] border-0 px-1.5 py-0 ${statusLabel[c.status]?.className || ''}`}>
                                                                            {statusLabel[c.status]?.text || c.status}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="min-w-[120px]">
                                                                        <div className="h-[40px] w-full">
                                                                            <ShareSparkline
                                                                                timeline={c.shareTimeline}
                                                                                highlightDate={c.bookClosureDateAD}
                                                                                currentFyGain={c.received.bonusShares}
                                                                            />
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TooltipProvider>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </section>
                                        </div>
                                    );
                                })()}
                            </>
                        ) : null}

                {/* Manual Overrides Accordion */}
                <details className="group border rounded-lg overflow-hidden bg-card/30">
                    <summary className="cursor-pointer p-4 hover:bg-muted/50 transition-colors flex items-center justify-between font-semibold border-b border-transparent group-open:border-border">
                        <div className="space-y-1">
                            <h2 className="text-lg">Manual Entries & Overrides</h2>
                            <p className="text-sm text-muted-foreground font-normal">Add missing dividends or override auto-calculated amounts.</p>
                        </div>
                        <div className="text-primary group-open:rotate-180 transition-transform">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                    </summary>
                    <div className="p-4 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Add Override</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                    <div><Label>Symbol</Label><Input value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} /></div>
                                    <div><Label>Fiscal Year</Label><Input value={draft.fiscalYear} onChange={(e) => setDraft({ ...draft, fiscalYear: e.target.value })} /></div>
                                    <div><Label>Bonus %</Label><Input type="number" step="0.01" value={draft.bonusPercent} onChange={(e) => setDraft({ ...draft, bonusPercent: parseFloat(e.target.value) || 0 })} /></div>
                                    <div><Label>Cash %</Label><Input type="number" step="0.01" value={draft.cashPercent} onChange={(e) => setDraft({ ...draft, cashPercent: parseFloat(e.target.value) || 0 })} /></div>
                                    <div><Label>Cash Income</Label><Input type="number" step="0.01" value={draft.cashIncome} onChange={(e) => setDraft({ ...draft, cashIncome: parseFloat(e.target.value) || 0 })} /></div>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={addRow}><PlusCircle className="h-4 w-4 mr-2" />Add</Button>
                                </div>
                            </CardContent>
                        </Card>
                        
                        {rows.length > 0 && (
                            <div className="overflow-x-auto border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Symbol</TableHead>
                                            <TableHead>FY</TableHead>
                                            <TableHead>Bonus %</TableHead>
                                            <TableHead>Cash %</TableHead>
                                            <TableHead>Cash Income</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map(row => (
                                            <TableRow key={row.id} className={cn(row.disabled && "opacity-50")}>
                                                <TableCell className="font-semibold">
                                                    <div className="flex items-center gap-2">
                                                        <Link to={`/quarterly?symbol=${row.symbol}&tab=dividends`} className="inline-flex items-center gap-1 hover:underline hover:opacity-80 transition-all text-primary">
                                                            {row.symbol}
                                                        </Link>
                                                        {row.disabled && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Badge variant="outline" className="text-[10px] border-0 px-1.5 py-0 bg-muted text-muted-foreground cursor-help">Disabled</Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="max-w-xs">
                                                                    <p className="text-xs">{row.disabledReason || "Kept for reference, excluded from calculations."}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{row.fiscalYear}</TableCell>
                                                <TableCell className="font-mono text-emerald-500">{row.bonusPercent}%</TableCell>
                                                <TableCell className="font-mono text-amber-500">{row.cashPercent}%</TableCell>
                                                <TableCell className="font-mono">Rs. {row.cashIncome}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => deleteRow(row.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </details>
            </main>
            <Footer />
        </div>
    );
};

export default DividendsPage;
