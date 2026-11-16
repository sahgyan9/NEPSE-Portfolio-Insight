import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AIChatbot } from '@/components/AIChatbot';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/Explain';
import { usePortfolioAnalytics } from '@/hooks/usePortfolio';
import { useApiKey } from '@/hooks/useApiKey';
import { ExternalLink, RefreshCw, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useViewMode } from '@/hooks/useViewMode';
import { useT } from '@/i18n';

interface SectorLeaderPillars {
    P?: number;
    G?: number;
    S?: number;
    Y?: number;
    V?: number;
}

interface SectorLeaderChecklist {
    passed: number;
    assessable: number;
}

interface SectorLeader {
    symbol: string;
    name?: string;
    sector: string;
    score: number;
    composite?: number;
    coverage?: number;
    rank?: number;
    sector_rank?: number;
    period?: string;
    roe: number;
    roa?: number;
    eps: number;
    bvps?: number;
    pe: number;
    pb?: number;
    epsGrowth?: number;
    revGrowth?: number;
    profitGrowth?: number;
    netMargin?: number;
    divYield?: number;
    pillars?: SectorLeaderPillars;
    checklist?: SectorLeaderChecklist;
    turnover?: number;
    historyDepth?: number;
    qualityModifier?: number;
    qualityDetail?: string;
}

interface MacroPaper {
    title: string;
    publication_year: number;
    cited_by_count: number;
    url: string;
    open_access_pdf: string | null;
}

export default function IntelligencePage() {
    const { t } = useT();
    const { isSimple } = useViewMode();
    const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();
    const { holdings, summary, isLoading: portfolioLoading, refetch } = usePortfolioAnalytics();

    const [macroResearch, setMacroResearch] = useState<MacroPaper[]>([]);
    const [quarterlyPerformers, setQuarterlyPerformers] = useState<Record<string, SectorLeader[]>>({});
    const [latestPeriod, setLatestPeriod] = useState<string>('');
    const [selectedSector, setSelectedSector] = useState<string>('ALL');
    const [isLoading, setIsLoading] = useState(false);

    const fetchIntelligence = async (force: boolean = false) => {
        setIsLoading(true);
        try {
            // Fetch Macro Research
            const macroUrl = import.meta.env.DEV
                ? `/api/portfolio-db/api/macro-research?force=${force}`
                : `http://localhost:5001/api/macro-research?force=${force}`;
            const macroRes = await fetch(macroUrl);
            if (macroRes.ok) {
                const data = await macroRes.json();
                if (data.research && Array.isArray(data.research)) {
                    setMacroResearch(data.research);
                }
            }

            // Fetch Quarterly Top Performers
            const performersUrl = import.meta.env.DEV
                ? '/api/nepse-server/api/quarterly/top-performers'
                : 'http://localhost:8002/api/quarterly/top-performers';
            const perfRes = await fetch(performersUrl);
            if (perfRes.ok) {
                const perfData = await perfRes.json();
                setLatestPeriod(perfData.latestPeriod || '');
                const latestData = perfData.periods?.[perfData.latestPeriod] || {};
                setQuarterlyPerformers(latestData);
            }
        } catch (error) {
            console.error("Failed to fetch intelligence data", error);
            toast({
                title: t('sector.errorTitle'),
                description: t('sector.errorBody'),
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchIntelligence();
    }, []);

    const handleRefresh = async () => {
        await refetch();
        await fetchIntelligence(true);
        toast({
            title: t('sector.refreshedTitle'),
            description: t('sector.refreshedBody'),
        });
    };

    const PILLARS: { key: keyof SectorLeaderPillars; label: string }[] = [
        { key: 'P', label: t('sector.pillarP') },
        { key: 'G', label: t('sector.pillarG') },
        { key: 'S', label: t('sector.pillarS') },
        { key: 'Y', label: t('sector.pillarY') },
        { key: 'V', label: t('sector.pillarV') },
    ];
    const sectors = Object.keys(quarterlyPerformers);

    return (
        <div className="min-h-screen bg-background">
            <Header onRefresh={handleRefresh} isRefreshing={isLoading || portfolioLoading} />

            <main className="container space-y-8 px-4 py-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{t('sector.pageTitle')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('sector.pageIntro')}
                        </p>
                    </div>
                    <Button onClick={() => handleRefresh()} disabled={isLoading} variant="outline" size="sm" className="min-h-[44px] gap-2 md:min-h-0">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                        {t('common.refresh')}
                    </Button>
                </div>

                <div className="surface flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <p className="text-muted-foreground">{t('sector.riskPrompt')}</p>
                    <div className="flex flex-wrap gap-x-4">
                        <Link to="/risk" className="inline-flex min-h-[44px] items-center gap-1 font-medium text-primary hover:underline md:min-h-0">{t('sector.linkRisk')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
                        <Link to="/research" className="inline-flex min-h-[44px] items-center gap-1 font-medium text-primary hover:underline md:min-h-0">{t('sector.linkResearch')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
                    </div>
                </div>

                {/* Quality screen */}
                <section className="space-y-3" id="screen">
                    <div>
                        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
                            {t('sector.screenTitle')}
                            <Explain term="sectorLeaders" />
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                            {t('sector.screenIntro')}
                            {latestPeriod && <> {t('sector.period', { period: latestPeriod })}</>}
                        </p>
                        <div className="mt-3 max-w-3xl rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed">
                            <p>{t('sector.orderNote')}</p>
                            <Link to="/research" className="mt-1 inline-flex min-h-[44px] items-center gap-1 font-medium text-primary hover:underline md:min-h-0">
                                {t('sector.orderNoteLink')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        </div>
                        {isSimple && (
                            <div className="mt-3 max-w-3xl rounded-md border border-border p-3 text-sm leading-relaxed">
                                <p className="font-semibold">{t('sector.howTitle')}</p>
                                <p className="mt-1">{t('sector.how1')} {t('sector.how2')} {t('sector.how3')}</p>
                            </div>
                        )}
                    </div>

                    {sectors.length === 0 ? (
                        <div className="surface p-6 text-center text-sm text-muted-foreground">
                            {isLoading ? t('sector.loading') : t('sector.empty')}
                        </div>
                    ) : (
                        <>
                            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('sector.sectorFilter')}>
                                <Button size="sm" variant={selectedSector === 'ALL' ? 'default' : 'outline'} onClick={() => setSelectedSector('ALL')} aria-pressed={selectedSector === 'ALL'} className="h-11 shrink-0 text-xs md:h-8">
                                    {t('sector.allSectors', { n: sectors.length })}
                                </Button>
                                {sectors.map((sec) => (
                                    <Button key={sec} size="sm" variant={selectedSector === sec ? 'default' : 'outline'} onClick={() => setSelectedSector(sec)} aria-pressed={selectedSector === sec} className="h-11 shrink-0 text-xs md:h-8">
                                        {sec}
                                    </Button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {Object.entries(quarterlyPerformers)
                                    .filter(([sector]) => selectedSector === 'ALL' || selectedSector === sector)
                                    .map(([sector, stocks]) => {
                                        if (!stocks || stocks.length === 0) return null;
                                        return (
                                            <div key={sector} className="surface p-4">
                                                <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sector}</h3>
                                                <div className="divide-y divide-border">
                                                    {stocks.slice(0, 3).map((stock, idx) => {
                                                        const rank = stock.rank || idx + 1;
                                                        const pillars = stock.pillars || {};
                                                        const check = stock.checklist;
                                                        return (
                                                            <div key={stock.symbol} className="py-3 last:pb-0">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs text-muted-foreground">{t('sector.rank', { n: rank })}</span>
                                                                            <Link to={`/quarterly?symbol=${stock.symbol}`} className="font-mono text-base font-semibold hover:underline">
                                                                                {stock.symbol}
                                                                            </Link>
                                                                        </div>
                                                                        {stock.name && <p className="max-w-[200px] truncate text-xs text-muted-foreground" title={stock.name}>{stock.name}</p>}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="font-mono text-sm font-semibold">{stock.score.toFixed(1)}</p>
                                                                        <p className="text-xs text-muted-foreground">{t('sector.score')}</p>
                                                                        {check && (
                                                                            <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted-foreground" title={t('sector.checksTitle')}>
                                                                                <ShieldCheck className="h-3 w-3" aria-hidden="true" /> {t('sector.checks', { passed: check.passed, total: check.assessable })}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                                                    <div><span className="block text-muted-foreground">{t('sector.roe')}</span><span className="font-mono">{stock.roe.toFixed(1)}%</span></div>
                                                                    <div><span className="block text-muted-foreground">{t('sector.pe')}</span><span className="font-mono">{stock.pe > 0 ? stock.pe.toFixed(1) : '-'}</span></div>
                                                                    <div><span className="block text-muted-foreground">{t('sector.divYield')}</span><span className="font-mono">{stock.divYield !== undefined && stock.divYield > 0 ? `${stock.divYield.toFixed(1)}%` : '-'}</span></div>
                                                                </div>

                                                                {Object.keys(pillars).length > 0 && (
                                                                    <ul className="mt-2.5 space-y-1" aria-label={t('sector.pillarsLabel')}>
                                                                        {PILLARS.map(({ key, label }) => {
                                                                            const v = pillars[key];
                                                                            const has = v !== undefined && v !== null;
                                                                            return (
                                                                                <li key={key} className="grid grid-cols-[96px_1fr_28px] items-center gap-2 text-xs">
                                                                                    <span className="text-muted-foreground">{label}</span>
                                                                                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                                                        {has && <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, v as number))}%` }} />}
                                                                                    </span>
                                                                                    <span className="text-right font-mono">{has ? (v as number).toFixed(0) : t('sector.na')}</span>
                                                                                </li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </>
                    )}
                </section>

                {/* Policy research */}
                <section className="space-y-3" id="policy">
                    <div>
                        <h2 className="text-lg font-semibold">{t('sector.policyTitle')}</h2>
                        <p className="text-sm text-muted-foreground">{t('sector.policyIntro')}</p>
                    </div>
                    {macroResearch.length > 0 ? (
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {macroResearch.map((paper, idx) => (
                                <li key={idx} className="surface p-4">
                                    <h4 className="mb-2 text-sm font-semibold leading-snug">{paper.title}</h4>
                                    <p className="mb-3 text-xs text-muted-foreground">
                                        {t('sector.cited', { year: paper.publication_year, n: paper.cited_by_count })}
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 text-sm">
                                        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-primary hover:underline md:min-h-0">
                                            {t('sector.viewPaper')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                        </a>
                                        {paper.open_access_pdf && (
                                            <a href={paper.open_access_pdf} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-primary hover:underline md:min-h-0">
                                                {t('sector.pdf')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                            </a>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="surface p-6 text-center text-sm text-muted-foreground">
                            {isLoading ? t('sector.loadingPapers') : t('sector.noPapers')}
                        </div>
                    )}
                </section>

                <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            </main>

            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
}
