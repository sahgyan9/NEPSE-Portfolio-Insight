/**
 * Valuation Page
 * ==============
 *
 * Compares each stock's price with what the company earns and owns.
 * Simple mode: a short explainer and one small card per stock.
 * Advanced mode: portfolio health, every valuation card, a price check table,
 * dividends and the thresholds guide.
 *
 * The page describes numbers. It never says what to buy, sell or hold.
 */

import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PortfolioHealthScore } from '@/components/PortfolioHealthScore';
import { StockValuationCard, SimpleValuationCard } from '@/components/StockValuationCard';
import { DividendTracker } from '@/components/DividendTracker';
import { MetricThresholdsGuide } from '@/components/MetricThresholdsGuide';
import { AIChatbot } from '@/components/AIChatbot';
import { Explain } from '@/components/Explain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortfolioAnalytics } from '@/hooks/usePortfolio';
import { calculateValuationScore } from '@/lib/valuationScoring';
import { useApiKey } from '@/hooks/useApiKey';
import { useViewMode } from '@/hooks/useViewMode';
import { useT } from '@/i18n';
import { fmtMoney, fmtDate, fmtPercent } from '@/i18n/format';
import {
    LayoutGrid,
    List,
    Search,
    SortAsc,
    SortDesc,
    Filter,
    BookOpen,
    PieChart,
    Coins,
    TrendingUp,
    ArrowLeft,
    Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import type { StockHolding } from '@/data/portfolioData';

type SortKey = 'score' | 'pe' | 'pb' | 'dividend' | 'gainLoss' | 'graham' | 'peg' | 'earningsYield';

/** Which plain sentence describes a holding in the price check. Conditions are unchanged. */
type PriceCheck = 'deepCheap' | 'cheap' | 'average' | 'expensive';

const priceCheckOf = (h: StockHolding): PriceCheck => {
    const isGrahamUndervalued = h.grahamNumber ? h.currentPrice < h.grahamNumber : false;
    const isDeep = h.grahamNumber ? h.currentPrice < h.grahamNumber * 0.67 : false;
    if (isDeep) return 'deepCheap';
    if (isGrahamUndervalued) return 'cheap';
    if (h.grahamNumber && h.currentPrice > h.grahamNumber * 1.5) return 'expensive';
    return 'average';
};

const CHECK_KEY: Record<PriceCheck, string> = {
    deepCheap: 'valuation.signalDeepCheap',
    cheap: 'valuation.signalCheap',
    average: 'valuation.signalAverage',
    expensive: 'valuation.signalExpensive',
};

const FundamentalsPage = () => {
    const { t } = useT();
    const { isSimple, setMode } = useViewMode();
    const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortKey>('score');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [sectorFilter, setSectorFilter] = useState<string>('all');

    const {
        holdings,
        summary,
        isLoading,
        lastUpdated,
        refetch,
    } = usePortfolioAnalytics();

    // Get unique sectors
    const sectors = useMemo(() => {
        const sectorSet = new Set(holdings.map(h => h.sector));
        return Array.from(sectorSet).sort();
    }, [holdings]);

    // Filter and sort holdings
    const filteredHoldings = useMemo(() => {
        let result = [...holdings];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                h =>
                    h.scrip.toLowerCase().includes(query) ||
                    h.fullName.toLowerCase().includes(query)
            );
        }

        // Sector filter
        if (sectorFilter !== 'all') {
            result = result.filter(h => h.sector === sectorFilter);
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'score':
                    comparison = calculateValuationScore(a).overallScore - calculateValuationScore(b).overallScore;
                    break;
                case 'pe':
                    comparison = (a.peRatio || 999) - (b.peRatio || 999);
                    break;
                case 'pb':
                    comparison = (a.pbRatio || 999) - (b.pbRatio || 999);
                    break;
                case 'dividend':
                    comparison = (a.dividendYield || 0) - (b.dividendYield || 0);
                    break;
                case 'gainLoss':
                    comparison = a.gainLossPercent - b.gainLossPercent;
                    break;
                case 'graham': {
                    // Sort by discount % to Graham Number: (Graham - LTP) / Graham
                    const aDisc = a.grahamNumber ? (a.grahamNumber - a.currentPrice) / a.grahamNumber : -999;
                    const bDisc = b.grahamNumber ? (b.grahamNumber - b.currentPrice) / b.grahamNumber : -999;
                    comparison = aDisc - bDisc;
                    break;
                }
                case 'peg':
                    comparison = (a.pegRatio || 999) - (b.pegRatio || 999);
                    break;
                case 'earningsYield':
                    comparison = (a.earningsYield || -999) - (b.earningsYield || -999);
                    break;
            }

            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return result;
    }, [holdings, searchQuery, sectorFilter, sortBy, sortOrder]);

    const handleRefresh = async () => {
        await refetch();
        toast({
            title: t('valuation.refreshedTitle'),
            description: t('valuation.refreshedDesc'),
        });
    };

    const updatedText = lastUpdated
        ? `${fmtDate(lastUpdated)} ${lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        : null;

    const screenerRows = holdings.filter(h => h.sector !== 'Mutual Fund');
    const avgPe = calculateAverage(holdings, 'peRatio');
    const avgPb = calculateAverage(holdings, 'pbRatio');
    const avgDividend = calculateAverage(holdings, 'dividendYield');
    const cheapCount = holdings.filter(h => calculateValuationScore(h).overallScore >= 65).length;

    const filterControl = 'h-11 w-full sm:h-10';

    return (
        <div className="min-h-screen bg-background">
            <Header
                onRefresh={handleRefresh}
                isRefreshing={isLoading}
            />

            <main className="container px-4 py-6">
                {/* Back Navigation */}
                <div className="mb-4">
                    <Link to="/">
                        <Button variant="ghost" className="h-11 gap-2 px-3">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            {t('valuation.back')}
                        </Button>
                    </Link>
                </div>

                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{t('valuation.pageTitle')}</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {t('valuation.pageSub')}
                    </p>
                    {updatedText && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            {t('valuation.updated', { time: updatedText })}
                        </p>
                    )}
                </div>

                {isSimple ? (
                    <div className="space-y-6">
                        {/* Three-sentence explainer */}
                        <section className="surface space-y-2 p-4 sm:p-5">
                            <h2 className="flex items-center gap-2 text-base font-semibold">
                                <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                                {t('valuation.simpleExplainTitle')}
                            </h2>
                            <p className="text-sm leading-relaxed">
                                {t('valuation.simpleExplain1')} {t('valuation.simpleExplain2')} {t('valuation.simpleExplain3')}
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-base font-semibold">{t('valuation.simpleYourStocks')}</h2>
                            {holdings.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">{t('valuation.simpleEmpty')}</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {holdings.map((holding) => (
                                        <SimpleValuationCard key={holding.scrip} holding={holding} />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="surface space-y-3 p-4 sm:p-5">
                            <p className="text-sm leading-relaxed text-muted-foreground">{t('valuation.simpleShowAllHint')}</p>
                            <Button className="h-11 w-full sm:w-auto" onClick={() => setMode('advanced')}>
                                {t('valuation.showAll')}
                            </Button>
                        </section>
                    </div>
                ) : (
                    <Tabs defaultValue="overview" className="space-y-6">
                        <TabsList className="grid h-auto w-full max-w-2xl grid-cols-2 gap-1 sm:grid-cols-5">
                            <TabsTrigger value="overview" className="min-h-11 gap-2">
                                <PieChart className="h-4 w-4" aria-hidden="true" />
                                {t('valuation.tabOverview')}
                            </TabsTrigger>
                            <TabsTrigger value="valuations" className="min-h-11 gap-2">
                                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                                {t('valuation.tabStocks')}
                            </TabsTrigger>
                            <TabsTrigger value="screener" className="min-h-11 gap-2">
                                <Search className="h-4 w-4" aria-hidden="true" />
                                {t('valuation.tabScreener')}
                            </TabsTrigger>
                            <TabsTrigger value="dividends" className="min-h-11 gap-2">
                                <Coins className="h-4 w-4" aria-hidden="true" />
                                {t('valuation.tabDividends')}
                            </TabsTrigger>
                            <TabsTrigger value="learn" className="min-h-11 gap-2">
                                <BookOpen className="h-4 w-4" aria-hidden="true" />
                                {t('valuation.tabLearn')}
                            </TabsTrigger>
                        </TabsList>

                        {/* Overview Tab */}
                        <TabsContent value="overview" className="space-y-6">
                            <PortfolioHealthScore holdings={holdings} />

                            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-4">
                                <QuickStatCard
                                    label={t('valuation.statAvgPe')}
                                    term="pe"
                                    value={avgPe.toFixed(1)}
                                    benchmark={t('valuation.benchPe')}
                                />
                                <QuickStatCard
                                    label={t('valuation.statAvgPb')}
                                    term="pb"
                                    value={avgPb.toFixed(2)}
                                    benchmark={t('valuation.benchPb')}
                                />
                                <QuickStatCard
                                    label={t('valuation.statAvgDividend')}
                                    term="dividendYield"
                                    value={fmtPercent(avgDividend, 1, false)}
                                    benchmark={t('valuation.benchDividend')}
                                />
                                <QuickStatCard
                                    label={t('valuation.statCheapCount')}
                                    value={`${cheapCount}/${holdings.length}`}
                                    benchmark={t('valuation.benchCheapCount')}
                                    note={t('valuation.lowPriceNote')}
                                />
                            </div>
                        </TabsContent>

                        {/* Valuations Tab */}
                        <TabsContent value="valuations" className="space-y-6">
                            {/* Filters */}
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                <div className="relative min-w-0 sm:min-w-[200px] sm:flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                    <Input
                                        placeholder={t('valuation.searchPlaceholder')}
                                        aria-label={t('valuation.searchAria')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-11 pl-9 sm:h-10"
                                    />
                                </div>

                                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                                    <SelectTrigger className={`${filterControl} sm:w-[180px]`} aria-label={t('valuation.sectorLabel')}>
                                        <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
                                        <SelectValue placeholder={t('valuation.sectorLabel')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('valuation.sectorAll')}</SelectItem>
                                        {sectors.map((sector) => (
                                            <SelectItem key={sector} value={sector}>
                                                {sector}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="flex gap-3">
                                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                                        <SelectTrigger className={`${filterControl} min-w-0 flex-1 sm:w-[190px] sm:flex-none`} aria-label={t('valuation.sortLabel')}>
                                            <SelectValue placeholder={t('valuation.sortLabel')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="score">{t('valuation.sortScore')}</SelectItem>
                                            <SelectItem value="pe">{t('valuation.sortPe')}</SelectItem>
                                            <SelectItem value="pb">{t('valuation.sortPb')}</SelectItem>
                                            <SelectItem value="dividend">{t('valuation.sortDividend')}</SelectItem>
                                            <SelectItem value="gainLoss">{t('valuation.sortGain')}</SelectItem>
                                            <SelectItem value="graham">{t('valuation.sortGraham')}</SelectItem>
                                            <SelectItem value="peg">{t('valuation.sortPeg')}</SelectItem>
                                            <SelectItem value="earningsYield">{t('valuation.sortEarningsYield')}</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 shrink-0 sm:h-10 sm:w-10"
                                        aria-label={sortOrder === 'asc' ? t('valuation.sortAsc') : t('valuation.sortDesc')}
                                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                    >
                                        {sortOrder === 'asc' ? (
                                            <SortAsc className="h-4 w-4" aria-hidden="true" />
                                        ) : (
                                            <SortDesc className="h-4 w-4" aria-hidden="true" />
                                        )}
                                    </Button>

                                    <div className="flex shrink-0 rounded-md border">
                                        <Button
                                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                            size="icon"
                                            className="h-11 w-11 sm:h-10 sm:w-10"
                                            aria-label={t('valuation.viewGrid')}
                                            aria-pressed={viewMode === 'grid'}
                                            onClick={() => setViewMode('grid')}
                                        >
                                            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                            size="icon"
                                            className="h-11 w-11 sm:h-10 sm:w-10"
                                            aria-label={t('valuation.viewList')}
                                            aria-pressed={viewMode === 'list'}
                                            onClick={() => setViewMode('list')}
                                        >
                                            <List className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Results count */}
                            <div className="text-sm text-muted-foreground">
                                {t('valuation.showing', { shown: filteredHoldings.length, total: holdings.length })}
                            </div>

                            {/* Stock Cards */}
                            <div className={
                                viewMode === 'grid'
                                    ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
                                    : 'space-y-4'
                            }>
                                {filteredHoldings.map((holding) => (
                                    <StockValuationCard
                                        key={holding.scrip}
                                        holding={holding}
                                        showDetails={viewMode === 'grid'}
                                        allHoldings={holdings}
                                    />
                                ))}
                            </div>

                            {filteredHoldings.length === 0 && (
                                <div className="py-12 text-center">
                                    <p className="text-muted-foreground">{t('valuation.noMatch')}</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Price check Tab */}
                        <TabsContent value="screener" className="space-y-6">
                            <div className="rounded-lg border bg-card p-4 sm:p-6">
                                <div className="mb-4">
                                    <h2 className="mb-1 text-lg font-bold sm:text-xl">{t('valuation.screenerTitle')}</h2>
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        {t('valuation.screenerSub')}
                                    </p>
                                    <p className="mt-2 flex items-start gap-1.5 text-sm leading-relaxed text-muted-foreground">
                                        <Info className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        {t('valuation.lowPriceNote')}
                                    </p>
                                </div>

                                {screenerRows.length === 0 ? (
                                    <p className="p-8 text-center text-muted-foreground">{t('valuation.screenerNone')}</p>
                                ) : (
                                    <>
                                        {/* Phone: one card per stock */}
                                        <ul className="space-y-3 md:hidden">
                                            {screenerRows.map(h => {
                                                const discountPercent = h.grahamNumber
                                                    ? ((h.grahamNumber - h.currentPrice) / h.grahamNumber) * 100
                                                    : null;
                                                return (
                                                    <li key={h.scrip} className="rounded-lg border p-3">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <span className="font-bold">{h.scrip}</span>
                                                            <span className="min-w-0 truncate text-sm text-muted-foreground">{h.sector}</span>
                                                        </div>
                                                        <dl className="mt-2 space-y-1 text-sm">
                                                            <Row label={t('valuation.colLtp')} value={fmtMoney(h.currentPrice, true)} />
                                                            <Row label={t('valuation.colGraham')} value={h.grahamNumber ? fmtMoney(h.grahamNumber, true) : '-'} />
                                                            <Row label={t('valuation.colGap')} value={discountPercent !== null ? fmtPercent(discountPercent, 1, false) : '-'} />
                                                            <Row label={t('valuation.colPeg')} value={h.pegRatio !== null && h.pegRatio !== undefined ? h.pegRatio.toFixed(2) : '-'} />
                                                            <Row label={t('valuation.colEarningsYield')} value={h.earningsYield !== null && h.earningsYield !== undefined ? fmtPercent(h.earningsYield, 2, false) : '-'} />
                                                        </dl>
                                                        <p className="mt-2 flex items-start gap-1.5 border-t pt-2 text-sm font-medium leading-relaxed">
                                                            <Info className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                                            {t(CHECK_KEY[priceCheckOf(h)])}
                                                        </p>
                                                    </li>
                                                );
                                            })}
                                        </ul>

                                        {/* Tablet and desktop: table */}
                                        <div className="hidden overflow-x-auto rounded-md border md:block">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-muted/50">
                                                        <th className="p-3 text-left font-semibold text-muted-foreground">{t('valuation.colScrip')}</th>
                                                        <th className="p-3 text-left font-semibold text-muted-foreground">{t('valuation.colSector')}</th>
                                                        <th className="p-3 text-right font-semibold text-muted-foreground">{t('valuation.colLtp')}</th>
                                                        <th className="p-3 text-right font-semibold text-muted-foreground">
                                                            <span className="inline-flex items-center gap-1">{t('valuation.colGraham')} <Explain title={t('valuation.xGrahamTitle')} text={t('valuation.xGrahamText')} /></span>
                                                        </th>
                                                        <th className="p-3 text-right font-semibold text-muted-foreground">{t('valuation.colGap')}</th>
                                                        <th className="p-3 text-right font-semibold text-muted-foreground">
                                                            <span className="inline-flex items-center gap-1">{t('valuation.colPeg')} <Explain title={t('valuation.xPegTitle')} text={t('valuation.xPegText')} /></span>
                                                        </th>
                                                        <th className="p-3 text-right font-semibold text-muted-foreground">
                                                            <span className="inline-flex items-center gap-1">{t('valuation.colEarningsYield')} <Explain title={t('valuation.xEarningsYieldTitle')} text={t('valuation.xEarningsYieldText')} /></span>
                                                        </th>
                                                        <th className="p-3 text-left font-semibold text-muted-foreground">{t('valuation.colShows')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {screenerRows.map(h => {
                                                        const discountPercent = h.grahamNumber
                                                            ? ((h.grahamNumber - h.currentPrice) / h.grahamNumber) * 100
                                                            : null;
                                                        return (
                                                            <tr key={h.scrip} className="border-b transition-colors hover:bg-muted/30">
                                                                <td className="p-3 font-bold">{h.scrip}</td>
                                                                <td className="p-3 text-muted-foreground">{h.sector}</td>
                                                                <td className="p-3 text-right font-mono font-semibold">{fmtMoney(h.currentPrice, true)}</td>
                                                                <td className="p-3 text-right font-mono">{h.grahamNumber ? fmtMoney(h.grahamNumber, true) : '-'}</td>
                                                                <td className="p-3 text-right font-mono font-semibold">
                                                                    {discountPercent !== null ? fmtPercent(discountPercent, 1, false) : '-'}
                                                                </td>
                                                                <td className="p-3 text-right font-mono">
                                                                    {h.pegRatio !== null && h.pegRatio !== undefined ? h.pegRatio.toFixed(2) : '-'}
                                                                </td>
                                                                <td className="p-3 text-right font-mono">
                                                                    {h.earningsYield !== null && h.earningsYield !== undefined ? fmtPercent(h.earningsYield, 2, false) : '-'}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className="inline-flex items-start gap-1.5 leading-relaxed">
                                                                        <Info className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                                                        {t(CHECK_KEY[priceCheckOf(h)])}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </TabsContent>

                        {/* Dividends Tab */}
                        <TabsContent value="dividends">
                            <DividendTracker holdings={holdings} />
                        </TabsContent>

                        {/* Learn Tab */}
                        <TabsContent value="learn">
                            <MetricThresholdsGuide />
                        </TabsContent>
                    </Tabs>
                )}

                {/* Footer */}
                <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            </main>

            {/* AI Chatbot - Floating */}
            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
};

// Helper function to calculate average
const calculateAverage = (
    holdings: { peRatio: number | null; pbRatio: number | null; dividendYield: number | null }[],
    metric: 'peRatio' | 'pbRatio' | 'dividendYield'
): number => {
    const values = holdings
        .map(h => h[metric])
        .filter((v): v is number => v !== null && v > 0);

    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
};

// Label and value on one line, for the stacked phone cards
const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-right font-mono font-medium">{value}</dd>
    </div>
);

// Quick stat card component
const QuickStatCard = ({
    label,
    value,
    benchmark,
    term,
    note,
}: {
    label: string;
    value: string;
    benchmark: string;
    term?: 'pe' | 'pb' | 'dividendYield';
    note?: string;
}) => (
    <div className="rounded-lg border border-border bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {label}
            {term && <Explain term={term} />}
        </p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benchmark}</p>
        {note && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </div>
);

export default FundamentalsPage;
