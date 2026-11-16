import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
    Trash2, PlusCircle, ArrowLeft, Loader2, RefreshCw, Banknote, TrendingUp, Search, ArrowUpDown,
    Gift, Coins, ChevronDown, BarChart3, CalendarCheck, ArrowDownUp, Percent, AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DividendSparkline } from '@/components/DividendSparkline';
import {
    fetchPortfolioDividends,
    refreshDividendAnnouncements,
    PortfolioDividendsResponse,
    CompanyDividend,
} from '@/services/receivedDividendsApi';
import { fetchMultipleStockData } from '@/services/sharebazaarApi';
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
import { usePortfolioAnalytics } from '@/hooks/usePortfolio';
import { DividendCharts } from '@/components/dashboard/DividendCharts';
import { IPOTable } from '@/components/IPOTable';
import { Explain } from '@/components/Explain';
import { useT, translate } from '@/i18n';
import { fmtDate, fmtDateAD, fmtMoney, fmtNumber, fmtPercent } from '@/i18n/format';
import { useViewMode } from '@/hooks/useViewMode';

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

type EnhancedCompany = CompanyDividend & { trueBonusValue: number | null; ltp: number | null };

const FY_OPTIONS = ['082-083', '081-082', '080-081', '079-080', '078-079'];

const STATUS: Record<string, { key: string; className: string }> = {
    'announced': { key: 'dividends.statusAnnounced', className: 'bg-warning/10 text-warning' },
    'book-closure-upcoming': { key: 'dividends.statusUpcoming', className: 'bg-primary/10 text-primary' },
    'book-closed': { key: 'dividends.statusClosed', className: 'bg-success/10 text-success' },
};

/** Card list sort options (phones in advanced mode, every width in simple mode). */
const CARD_SORTS: { value: string; key: string; order: 'asc' | 'desc'; label: string }[] = [
    { value: 'symbol:asc', key: 'symbol', order: 'asc', label: 'dividends.sortSymbol' },
    { value: 'cashNet:desc', key: 'cashNet', order: 'desc', label: 'dividends.sortCash' },
    { value: 'bonusShares:desc', key: 'bonusShares', order: 'desc', label: 'dividends.sortBonus' },
    { value: 'totalPercent:desc', key: 'totalPercent', order: 'desc', label: 'dividends.sortTotal' },
];

const StatusBadge = ({ status }: { status: string }) => {
    const { t } = useT();
    const s = STATUS[status];
    return (
        <Badge variant="outline" className={cn('text-[11px] border-0 px-1.5 py-0 font-medium', s?.className)}>
            {s ? t(s.key) : status}
        </Badge>
    );
};

const BookCloseText = ({ c, showAD = false }: { c: EnhancedCompany; showAD?: boolean }) => {
    const { t } = useT();
    if (c.bookClosureDateAD) {
        return (
            <span className="flex flex-col">
                <span>{fmtDate(c.bookClosureDateAD) || c.bookClosureDateBS}</span>
                {showAD && <span className="text-[11px] text-muted-foreground">{fmtDateAD(c.bookClosureDateAD)}</span>}
            </span>
        );
    }
    return (
        <span className="italic text-muted-foreground">
            {c.source === 'manual' ? t('dividends.manuallyLogged') : t('dividends.bookCloseNotSet')}
        </span>
    );
};

/** One company's dividend for the selected year, as a stacked card. */
const CompanyCard = ({ c, showChart }: { c: EnhancedCompany; showChart: boolean }) => {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const hasFraction = c.received.bonusShares > 0 && c.received.bonusSharesExact !== c.received.bonusShares;
    return (
        <li className="surface p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <Link to={`/quarterly?symbol=${c.symbol}&tab=dividends`} className="text-base font-semibold text-primary hover:underline">
                        {c.symbol}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground" title={c.companyName}>{c.companyName}</p>
                    <p className="text-xs text-muted-foreground">{t('dividends.kittaHeld', { n: fmtNumber(c.quantity) })}</p>
                </div>
                <StatusBadge status={c.status} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm leading-relaxed">
                <div>
                    <dt className="text-muted-foreground">{t('dividends.colCashReceived')}</dt>
                    <dd className="font-mono font-semibold">{c.received.cashGross > 0 ? fmtMoney(c.received.cashNet) : '-'}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">{t('dividends.colBonusAdded')}</dt>
                    <dd className="font-mono font-semibold">
                        {c.received.bonusShares > 0 ? t('dividends.plusKitta', { n: fmtNumber(c.received.bonusShares) }) : '-'}
                    </dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">{t('dividends.colAnnounced')}</dt>
                    <dd>{t('dividends.announcedSplit', { cash: fmtPercent(c.cashPercent, 2, false), bonus: fmtPercent(c.bonusPercent, 2, false) })}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">{t('dividends.colBookClose')}</dt>
                    <dd><BookCloseText c={c} /></dd>
                </div>
            </dl>

            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="mt-2 -mx-1 flex min-h-[44px] w-full items-center justify-between rounded-md px-1 text-sm font-medium text-primary"
            >
                {open ? t('common.seeLess') : t('common.seeMore')}
                <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </button>
            {open && (
                <dl className="grid grid-cols-1 gap-y-3 border-t border-border pt-3 text-sm leading-relaxed">
                    {c.received.cashGross > 0 && (
                        <div>
                            <dt className="flex items-center gap-1 text-muted-foreground">
                                {t('dividends.cashBeforeTax')}
                                <Explain title={t('dividends.taxInfoTitle')} text={t('dividends.taxInfoText')} />
                            </dt>
                            <dd className="font-mono">{fmtMoney(c.received.cashGross)}</dd>
                        </div>
                    )}
                    {c.received.bonusShares > 0 && (
                        <div>
                            <dt className="text-muted-foreground">{t('dividends.bonusValueToday')}</dt>
                            <dd className="font-mono">{c.trueBonusValue === null ? t('dividends.priceNA') : fmtMoney(c.trueBonusValue)}</dd>
                        </div>
                    )}
                    {hasFraction && (
                        <div>
                            <dt className="flex items-center gap-1 text-muted-foreground">
                                {t('dividends.fractionLabel')}
                                <Explain title={t('dividends.fractionTitle')} text={t('dividends.fractionText')} />
                            </dt>
                            <dd className="font-mono">{c.received.bonusSharesExact.toFixed(2)}</dd>
                        </div>
                    )}
                    {showChart && (
                        <div>
                            <dt className="text-muted-foreground">{t('dividends.colTrend')}</dt>
                            <dd><DividendSparkline trend={c.dividendTrend} /></dd>
                        </div>
                    )}
                    {!c.received.cashGross && !c.received.bonusShares && !showChart && (
                        <p className="text-muted-foreground">{t('dividends.nothingReceivedYet')}</p>
                    )}
                </dl>
            )}
        </li>
    );
};

/** A plain sentence with a big number and an info button. */
const Statement = ({ icon: Icon, text, infoTitle, infoText }: { icon: typeof Coins; text: string; infoTitle: string; infoText: string }) => (
    <div className="surface flex items-start gap-3 p-4">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="flex-1 text-base leading-relaxed text-foreground">{text}</p>
        <Explain title={infoTitle} text={infoText} className="mt-1 h-6 w-6" />
    </div>
);

const ExplainerItem = ({ icon: Icon, title, body, links }: { icon: typeof Coins; title: string; body: string; links: { to: string; label: string }[] }) => (
    <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
            <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
            {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="flex flex-wrap gap-x-4">
            {links.map((l) => (
                <Link key={l.to} to={l.to} className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary hover:underline md:min-h-0">
                    {l.label}
                </Link>
            ))}
        </div>
    </div>
);

const DividendsPage = () => {
    const { t } = useT();
    const { isSimple, setMode } = useViewMode();
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

    // Auto dividends - defaults to current year 2026 (FY 082-083)
    const [fiscalYear, setFiscalYear] = useState('082-083');
    const [portfolioData, setPortfolioData] = useState<PortfolioDividendsResponse | null>(null);
    const [isFetchingAuto, setIsFetchingAuto] = useState(true);
    const [isRefreshingAuto, setIsRefreshingAuto] = useState(false);
    // Real holdings from the portfolio database (used for yield-on-value figures)
    const { holdings } = usePortfolioAnalytics();

    const [draft, setDraft] = useState<Omit<DividendRow, 'id'>>({
        symbol: '',
        companyName: '',
        fiscalYear: '082-083',
        bonusPercent: 0,
        cashPercent: 0,
        cashIncome: 0,
    });

    useEffect(() => {
        const loadData = async () => {
            // Load manual entries
            const available = await isManualDividendServerAvailable();
            setServerAvailable(available);
            const data = await getManualDividends();
            setRows(data);
            setIsLoading(false);
        };

        loadData();
    }, []);

    // Load auto dividends
    const rowsFingerprint = useMemo(() => rows.map(r => r.id).join(','), [rows]);

    useEffect(() => {
        const fetchAuto = async () => {
            if (!portfolioData) {
                setIsFetchingAuto(true);
            }
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
    }, [fiscalYear, rowsFingerprint]);

    // Load LTP for all symbols in portfolio
    useEffect(() => {
        if (!portfolioData) return;

        const symbols = portfolioData.companies.map(c => c.symbol);

        const loadLTPs = async () => {
            const stockMap = await fetchMultipleStockData(symbols);
            const newLtpMap = new Map<string, number>();
            stockMap.forEach((data, sym) => {
                if (data && data.ltp > 0) {
                    newLtpMap.set(sym, data.ltp);
                }
            });
            setLtpMap(newLtpMap);
        };
        loadLTPs();
    }, [portfolioData]);

    const handleRefreshAuto = async () => {
        setIsRefreshingAuto(true);
        try {
            await refreshDividendAnnouncements();
            const data = await fetchPortfolioDividends(fiscalYear);
            setPortfolioData(data);
            toast({ title: translate('dividends.toastDone'), description: translate('dividends.toastRefreshed') });
        } catch (error: any) {
            toast({ title: translate('dividends.toastError'), description: error.message || translate('dividends.toastRefreshFailed'), variant: "destructive" });
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
            toast({ title: translate('dividends.toastDone'), description: translate('dividends.toastManualAdded') });
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
            toast({ title: translate('dividends.toastDone'), description: translate('dividends.toastManualRemoved') });
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
            toast({ title: translate('dividends.toastDone'), description: translate('dividends.toastManualUpdated') });
        } catch (error: any) {
            setSaveError(error.message);
        } finally {
            setIsSaving(false);
            setEditingId(null);
            setEditDraft(null);
        }
    };

    // Derived figures for the selected fiscal year (same formulas as before; display only).
    const view = useMemo(() => {
        if (!portfolioData) return null;
        const { totals, companies } = portfolioData;

        const enhancedCompanies: EnhancedCompany[] = companies.map(c => {
            const ltp = ltpMap.get(c.symbol) ?? null;
            const trueBonusValue = ltp === null ? null : c.received.bonusShares * ltp;
            return { ...c, trueBonusValue, ltp };
        });

        let filteredCompanies = enhancedCompanies;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredCompanies = enhancedCompanies.filter(c => c.symbol.toLowerCase().includes(q) || c.companyName.toLowerCase().includes(q));
        }

        const totalTrueBonusValue = enhancedCompanies.reduce((acc, c) => acc + (c.trueBonusValue ?? 0), 0);
        // Companies that gave bonus shares but have no current price: left out of the totals.
        const bonusMissingPriceCount = enhancedCompanies.filter(c => c.received.bonusShares > 0 && c.trueBonusValue === null).length;
        const totalPortfolioValue = holdings.reduce((acc, h) => acc + (h.currentValue || 0), 0);
        const totalTrueIncomeForYear = totals.cashNet + totalTrueBonusValue;
        const dividendYield = totalPortfolioValue > 0 ? (totalTrueIncomeForYear / totalPortfolioValue) * 100 : 0;

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

            // Missing values always sort last, whichever direction is chosen.
            if (aVal == null || bVal == null) {
                return aVal == null && bVal == null ? 0 : aVal == null ? 1 : -1;
            }
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        });

        return { totals, companies, sortedCompanies, totalTrueBonusValue, bonusMissingPriceCount, totalPortfolioValue, totalTrueIncomeForYear, dividendYield };
    }, [portfolioData, ltpMap, searchQuery, holdings, sortKey, sortOrder]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('desc');
        }
    };

    const SortableHeader = ({ label, sortKeyName }: { label: string; sortKeyName: string }) => (
        <button
            type="button"
            onClick={() => handleSort(sortKeyName)}
            className={cn('flex items-center gap-1 font-semibold text-foreground hover:text-primary', sortKey === sortKeyName && 'text-primary')}
        >
            {label}
            <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
        </button>
    );

    const cardSortValue = `${sortKey}:${sortOrder}`;
    const cardSortKnown = CARD_SORTS.some((s) => s.value === cardSortValue);

    const fySelect = (
        <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
                <Label htmlFor="fy-select" className="mb-1 block text-xs font-medium text-muted-foreground">{t('dividends.fiscalYear')}</Label>
                <select
                    id="fy-select"
                    className="h-11 md:h-9 w-full bg-background border border-input rounded-md text-sm px-3 outline-none focus:ring-1 focus:ring-primary font-mono"
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(e.target.value)}
                >
                    {FY_OPTIONS.map((fy, i) => (
                        <option key={fy} value={fy}>{i === 0 ? t('dividends.fyCurrent', { fy }) : fy}</option>
                    ))}
                </select>
            </div>
            <Button variant="outline" onClick={handleRefreshAuto} disabled={isRefreshingAuto} className="h-11 md:h-9 gap-2" aria-label={t('dividends.refreshAnnouncements')}>
                <RefreshCw className={cn('h-4 w-4', isRefreshingAuto && 'animate-spin')} aria-hidden="true" />
                <span className="hidden sm:inline">{t('common.refresh')}</span>
            </Button>
        </div>
    );

    const searchBox = (
        <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
                placeholder={t('dividends.searchPlaceholder')}
                aria-label={t('dividends.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 md:h-9 bg-background text-base md:text-sm"
            />
        </div>
    );

    const cardSortSelect = (
        <div className="w-full md:max-w-xs">
            <label htmlFor="dividend-sort" className="mb-1 block text-xs font-medium text-muted-foreground">{t('dividends.sortLabel')}</label>
            <select
                id="dividend-sort"
                value={cardSortKnown ? cardSortValue : ''}
                onChange={(e) => {
                    const opt = CARD_SORTS.find((s) => s.value === e.target.value);
                    if (opt) {
                        setSortKey(opt.key);
                        setSortOrder(opt.order);
                    }
                }}
                className="h-11 md:h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
                {!cardSortKnown && <option value="" disabled>-</option>}
                {CARD_SORTS.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
            </select>
        </div>
    );

    const companyCards = (list: EnhancedCompany[], showChart: boolean) =>
        list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
                {searchQuery ? t('dividends.emptySearch') : t('dividends.emptyYear', { fy: fiscalYear })}
            </p>
        ) : (
            <ul className="space-y-3">
                {list.map((c) => <CompanyCard key={c.symbol} c={c} showChart={showChart} />)}
            </ul>
        );

    const renderSimple = () => {
        if (!view) return null;
        const { totals, sortedCompanies, totalTrueBonusValue, bonusMissingPriceCount, totalPortfolioValue, dividendYield } = view;
        return (
            <div className="space-y-6">
                <section aria-label={t('dividends.summaryHeading')} className="space-y-3">
                    <Statement
                        icon={Banknote}
                        text={totals.cashNet > 0
                            ? t('dividends.stmtCash', { fy: fiscalYear, amount: fmtMoney(totals.cashNet) })
                            : t('dividends.stmtCashNone', { fy: fiscalYear })}
                        infoTitle={t('dividends.stmtCashInfoTitle')}
                        infoText={t('dividends.stmtCashInfo', { fy: fiscalYear, gross: fmtMoney(totals.cashGross) })}
                    />
                    <Statement
                        icon={Gift}
                        text={totals.bonusShares > 0
                            ? t('dividends.stmtBonus', { fy: fiscalYear, n: fmtNumber(totals.bonusShares) })
                            : t('dividends.stmtBonusNone', { fy: fiscalYear })}
                        infoTitle={t('dividends.stmtBonusInfoTitle')}
                        infoText={t('dividends.stmtBonusInfo', { value: fmtMoney(totalTrueBonusValue) })}
                    />
                    {bonusMissingPriceCount > 0 && (
                        <p className="px-1 text-xs leading-relaxed text-muted-foreground">{t('dividends.bonusExcludedNote', { count: bonusMissingPriceCount })}</p>
                    )}
                    <Statement
                        icon={Percent}
                        text={totalPortfolioValue > 0
                            ? t('dividends.stmtPer100', { base: fmtMoney(100), amount: fmtMoney(dividendYield, true) })
                            : t('dividends.stmtPer100None')}
                        infoTitle={t('dividends.stmtPer100InfoTitle')}
                        infoText={t('dividends.stmtPer100Info', { pct: fmtPercent(dividendYield, 2, false) })}
                    />
                </section>

                <section className="surface space-y-5 p-4 sm:p-5">
                    <h2 className="text-lg font-semibold">{t('dividends.explainHeading')}</h2>
                    <ExplainerItem
                        icon={Coins}
                        title={t('dividends.explainCashBonusTitle')}
                        body={t('dividends.explainCashBonusBody')}
                        links={[
                            { to: '/learn#term-cashDividend', label: t('dividends.linkCashDividend') },
                            { to: '/learn#term-bonusShare', label: t('dividends.linkBonusShare') },
                        ]}
                    />
                    <ExplainerItem
                        icon={CalendarCheck}
                        title={t('dividends.explainBookCloseTitle')}
                        body={t('dividends.explainBookCloseBody')}
                        links={[{ to: '/learn#term-bookClosure', label: t('dividends.linkBookClosure') }]}
                    />
                    <ExplainerItem
                        icon={ArrowDownUp}
                        title={t('dividends.explainAdjustTitle')}
                        body={t('dividends.explainAdjustBody')}
                        links={[{ to: '/learn#term-priceAdjustment', label: t('dividends.linkPriceAdjustment') }]}
                    />
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">{t('dividends.perStockHeading', { fy: fiscalYear })}</h2>
                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                        {searchBox}
                        {cardSortSelect}
                    </div>
                    {companyCards(sortedCompanies, false)}
                </section>

                <Button variant="outline" className="h-11 w-full gap-2 md:w-auto" onClick={() => setMode('advanced')}>
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                    {t('dividends.showAll')}
                </Button>
            </div>
        );
    };

    const renderAdvanced = () => {
        if (!view) return null;
        const { totals, companies, sortedCompanies, totalTrueBonusValue, bonusMissingPriceCount, totalTrueIncomeForYear, dividendYield } = view;
        return (
            <div className="space-y-6">
                {/* KPI Section */}
                <section id="dividend-kpis">
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-border shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                    <Banknote className="h-4 w-4" aria-hidden="true" /> {t('dividends.kpiCash')}
                                    <Explain title={t('dividends.taxInfoTitle')} text={t('dividends.taxInfoText')} />
                                </div>
                                <div className="text-xl sm:text-2xl font-bold font-mono break-words">{fmtMoney(totals.cashNet)}</div>
                                <div className="text-xs text-muted-foreground font-mono mt-1">{t('dividends.kpiCashSub', { gross: fmtMoney(totals.cashGross) })}</div>
                            </CardContent>
                        </Card>
                        <Card className="border-border shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                    <TrendingUp className="h-4 w-4" aria-hidden="true" /> {t('dividends.kpiBonus')}
                                </div>
                                <div className="text-xl sm:text-2xl font-bold font-mono">{t('dividends.plusKitta', { n: fmtNumber(totals.bonusShares) })}</div>
                                <div className="text-xs text-muted-foreground font-mono mt-1">{t('dividends.kpiBonusSub', { value: fmtMoney(totalTrueBonusValue) })}</div>
                                {bonusMissingPriceCount > 0 && (
                                    <div className="text-xs leading-relaxed text-muted-foreground mt-1">{t('dividends.bonusExcludedNote', { count: bonusMissingPriceCount })}</div>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="border-border shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                    <Percent className="h-4 w-4" aria-hidden="true" /> {t('dividends.kpiYield')}
                                    <Explain term="dividendYield" />
                                </div>
                                <div className="text-xl sm:text-2xl font-bold font-mono">{fmtPercent(dividendYield, 2, false)}</div>
                                <div className="text-xs text-muted-foreground mt-1">{t('dividends.kpiYieldSub')}</div>
                            </CardContent>
                        </Card>
                        <Card className="border-success/30 bg-success/5 shadow-sm">
                            <CardContent className="p-4">
                                <div className="text-xs text-success font-semibold mb-2">{t('dividends.kpiTotal')}</div>
                                <div className="text-xl sm:text-2xl font-bold font-mono text-success break-words">{fmtMoney(totalTrueIncomeForYear)}</div>
                                <div className="text-xs text-muted-foreground mt-1">{t('dividends.kpiTotalSub')}</div>
                                {bonusMissingPriceCount > 0 && (
                                    <div className="text-xs leading-relaxed text-muted-foreground mt-1">{t('dividends.bonusExcludedNote', { count: bonusMissingPriceCount })}</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <DividendCharts companies={companies} holdings={holdings} fiscalYear={fiscalYear} />

                {/* Table Section */}
                <section id="dividend-table">
                    <Card className="border-border shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-end justify-between gap-3">
                                {searchBox}
                                <div className="md:hidden">{cardSortSelect}</div>
                            </div>

                            {/* Phones: cards */}
                            <div className="md:hidden p-3">{companyCards(sortedCompanies, true)}</div>

                            {/* Tablets and desktops: table */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead><SortableHeader label={t('dividends.colSymbol')} sortKeyName="symbol" /></TableHead>
                                            <TableHead><SortableHeader label={t('dividends.colAnnounced')} sortKeyName="totalPercent" /></TableHead>
                                            <TableHead className="text-foreground font-semibold">{t('dividends.colBookClose')}</TableHead>
                                            <TableHead><SortableHeader label={t('dividends.colBonusAdded')} sortKeyName="bonusShares" /></TableHead>
                                            <TableHead><SortableHeader label={t('dividends.colCashReceived')} sortKeyName="cashNet" /></TableHead>
                                            <TableHead><SortableHeader label={t('dividends.colStatus')} sortKeyName="status" /></TableHead>
                                            <TableHead className="text-center font-semibold text-foreground">{t('dividends.colTrend')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedCompanies.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                                                    {searchQuery ? t('dividends.emptySearch') : t('dividends.emptyYear', { fy: fiscalYear })}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {sortedCompanies.map((c) => (
                                            <TableRow key={c.symbol}>
                                                <TableCell>
                                                    <Link to={`/quarterly?symbol=${c.symbol}&tab=dividends`} className="font-semibold text-primary underline decoration-dashed hover:decoration-solid">
                                                        {c.symbol}
                                                    </Link>
                                                    <div className="text-xs text-muted-foreground max-w-[160px] truncate" title={c.companyName}>{c.companyName}</div>
                                                    <div className="text-[11px] text-muted-foreground font-mono">{t('dividends.kittaHeld', { n: fmtNumber(c.quantity) })}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="font-medium">{t('dividends.totalPct', { pct: fmtPercent(c.totalPercent, 1, false) })}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {t('dividends.announcedSplit', { cash: fmtPercent(c.cashPercent, 2, false), bonus: fmtPercent(c.bonusPercent, 2, false) })}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <BookCloseText c={c} showAD />
                                                </TableCell>
                                                <TableCell>
                                                    {c.received.bonusShares > 0 ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="font-mono font-bold">{t('dividends.plusKitta', { n: fmtNumber(c.received.bonusShares) })}</div>
                                                            {c.received.bonusSharesExact !== c.received.bonusShares && (
                                                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                                    {t('dividends.fractionWas', { n: c.received.bonusSharesExact.toFixed(2) })}
                                                                    <Explain title={t('dividends.fractionTitle')} text={t('dividends.fractionText')} />
                                                                </div>
                                                            )}
                                                            <div className="text-[11px] text-muted-foreground">{c.trueBonusValue === null ? t('dividends.priceNA') : t('dividends.valueToday', { value: fmtMoney(c.trueBonusValue) })}</div>
                                                        </div>
                                                    ) : (<span className="text-muted-foreground">-</span>)}
                                                </TableCell>
                                                <TableCell>
                                                    {c.received.cashGross > 0 ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="font-mono font-medium">{fmtMoney(c.received.cashNet)}</div>
                                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                                {t('dividends.beforeTax', { amount: fmtMoney(c.received.cashGross) })}
                                                                <Explain title={t('dividends.taxInfoTitle')} text={t('dividends.taxInfoText')} />
                                                            </div>
                                                        </div>
                                                    ) : (<span className="text-muted-foreground">-</span>)}
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={c.status} />
                                                </TableCell>
                                                <TableCell className="min-w-[130px] p-2 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <DividendSparkline trend={c.dividendTrend} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Manual Overrides */}
                <details className="group border border-border rounded-lg overflow-hidden bg-card">
                    <summary className="cursor-pointer p-4 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3 font-semibold border-b border-transparent group-open:border-border min-h-[44px]">
                        <div className="space-y-1">
                            <h2 className="text-lg">{t('dividends.manualHeading')}</h2>
                            <p className="text-sm text-muted-foreground font-normal leading-relaxed">{t('dividends.manualSub')}</p>
                        </div>
                        <ChevronDown className="h-5 w-5 shrink-0 text-primary group-open:rotate-180 transition-transform" aria-hidden="true" />
                    </summary>
                    <div className="p-4 space-y-6">
                        {saveError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{t('dividends.saveError', { error: saveError })}</AlertDescription>
                            </Alert>
                        )}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">{t('dividends.manualAdd')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                                    <div><Label htmlFor="md-symbol">{t('dividends.colSymbol')}</Label><Input id="md-symbol" className="h-11 md:h-10" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} /></div>
                                    <div><Label htmlFor="md-fy">{t('dividends.fiscalYear')}</Label><Input id="md-fy" className="h-11 md:h-10" value={draft.fiscalYear} onChange={(e) => setDraft({ ...draft, fiscalYear: e.target.value })} /></div>
                                    <div><Label htmlFor="md-bonus">{t('dividends.bonusPct')}</Label><Input id="md-bonus" className="h-11 md:h-10" type="number" step="0.01" value={draft.bonusPercent} onChange={(e) => setDraft({ ...draft, bonusPercent: parseFloat(e.target.value) || 0 })} /></div>
                                    <div><Label htmlFor="md-cash">{t('dividends.cashPct')}</Label><Input id="md-cash" className="h-11 md:h-10" type="number" step="0.01" value={draft.cashPercent} onChange={(e) => setDraft({ ...draft, cashPercent: parseFloat(e.target.value) || 0 })} /></div>
                                    <div><Label htmlFor="md-income">{t('dividends.cashIncome')}</Label><Input id="md-income" className="h-11 md:h-10" type="number" step="0.01" value={draft.cashIncome} onChange={(e) => setDraft({ ...draft, cashIncome: parseFloat(e.target.value) || 0 })} /></div>
                                </div>
                                <Button onClick={addRow} disabled={isSaving} className="h-11 md:h-10 w-full sm:w-auto">
                                    <PlusCircle className="h-4 w-4 mr-2" aria-hidden="true" />{t('dividends.add')}
                                </Button>
                            </CardContent>
                        </Card>

                        {rows.length > 0 && (
                            <>
                                {/* Phones: cards */}
                                <ul className="space-y-3 md:hidden">
                                    {rows.map(row => (
                                        <li key={row.id} className={cn('surface p-4', row.disabled && 'opacity-60')}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <Link to={`/quarterly?symbol=${row.symbol}&tab=dividends`} className="font-semibold text-primary hover:underline">{row.symbol}</Link>
                                                    <p className="font-mono text-xs text-muted-foreground">{row.fiscalYear}</p>
                                                    {row.disabled && (
                                                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                                            {t('dividends.disabled')}
                                                            <Explain title={t('dividends.disabled')} text={row.disabledReason || t('dividends.disabledDefault')} />
                                                        </p>
                                                    )}
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => deleteRow(row.id)} className="h-11 w-11 text-destructive" aria-label={t('dividends.deleteEntry', { symbol: row.symbol })}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                                <div><dt className="text-muted-foreground">{t('dividends.bonusPct')}</dt><dd className="font-mono">{fmtPercent(row.bonusPercent, 2, false)}</dd></div>
                                                <div><dt className="text-muted-foreground">{t('dividends.cashPct')}</dt><dd className="font-mono">{fmtPercent(row.cashPercent, 2, false)}</dd></div>
                                                <div><dt className="text-muted-foreground">{t('dividends.cashIncome')}</dt><dd className="font-mono">{fmtMoney(row.cashIncome, true)}</dd></div>
                                            </dl>
                                        </li>
                                    ))}
                                </ul>

                                {/* Tablets and desktops: table */}
                                <div className="hidden md:block overflow-x-auto border border-border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{t('dividends.colSymbol')}</TableHead>
                                                <TableHead>{t('dividends.fiscalYear')}</TableHead>
                                                <TableHead>{t('dividends.bonusPct')}</TableHead>
                                                <TableHead>{t('dividends.cashPct')}</TableHead>
                                                <TableHead>{t('dividends.cashIncome')}</TableHead>
                                                <TableHead className="text-right"><span className="sr-only">{t('dividends.actions')}</span></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map(row => (
                                                <TableRow key={row.id} className={cn(row.disabled && "opacity-60")}>
                                                    <TableCell className="font-semibold">
                                                        <div className="flex items-center gap-2">
                                                            <Link to={`/quarterly?symbol=${row.symbol}&tab=dividends`} className="text-primary hover:underline">
                                                                {row.symbol}
                                                            </Link>
                                                            {row.disabled && (
                                                                <span className="flex items-center gap-1">
                                                                    <Badge variant="outline" className="text-[11px] border-0 px-1.5 py-0 bg-muted text-muted-foreground">{t('dividends.disabled')}</Badge>
                                                                    <Explain title={t('dividends.disabled')} text={row.disabledReason || t('dividends.disabledDefault')} />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">{row.fiscalYear}</TableCell>
                                                    <TableCell className="font-mono">{fmtPercent(row.bonusPercent, 2, false)}</TableCell>
                                                    <TableCell className="font-mono">{fmtPercent(row.cashPercent, 2, false)}</TableCell>
                                                    <TableCell className="font-mono">{fmtMoney(row.cashIncome, true)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => deleteRow(row.id)} className="text-destructive" aria-label={t('dividends.deleteEntry', { symbol: row.symbol })}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </div>
                </details>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background">
            <Header onRefresh={handleRefreshAuto} isRefreshing={isRefreshingAuto} />

            <main className="container px-4 py-6 space-y-6">
                <div>
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="gap-2 h-11 md:h-9"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('dividends.back')}</Button>
                    </Link>
                </div>

                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('dividends.title')}</h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        {isSimple ? t('dividends.introSimple') : t('dividends.introAdvanced')}
                    </p>
                </div>

                {fySelect}

                {isFetchingAuto && !portfolioData ? (
                    <div className="h-40 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                        {t('dividends.loading')}
                    </div>
                ) : portfolioData ? (
                    isSimple ? renderSimple() : renderAdvanced()
                ) : (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="leading-relaxed">{t('dividends.loadError')}</AlertDescription>
                    </Alert>
                )}

                {/* IPO & Corporate Issues Pipeline */}
                <div className="pt-4">
                    <IPOTable />
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default DividendsPage;
