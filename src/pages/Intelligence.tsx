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
                : 'http://localhost:8000/api/quarterly/top-performers';
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
                title: 'Could not load data',
                description: 'Sector screen or policy research failed to load.',
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
            title: 'Data refreshed',
            description: 'Sector screen and policy research updated.',
        });
    };

    const PILLARS: { key: keyof SectorLeaderPillars; label: string }[] = [
        { key: 'P', label: 'Profitability' },
        { key: 'G', label: 'Growth' },
        { key: 'S', label: 'Safety' },
        { key: 'Y', label: 'Payout' },
        { key: 'V', label: 'Valuation' },
    ];
    const sectors = Object.keys(quarterlyPerformers);

    return (
        <div className="min-h-screen bg-background">
            <Header onRefresh={handleRefresh} isRefreshing={isLoading || portfolioLoading} />

            <main className="container space-y-8 px-4 py-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Sector screen and policy research</h1>
                        <p className="text-sm text-muted-foreground">
                            A company-quality screen to start your own research, and recent academic papers on Nepal's economy.
                        </p>
                    </div>
                    <Button onClick={() => handleRefresh()} disabled={isLoading} variant="outline" size="sm" className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <div className="surface flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <p className="text-muted-foreground">Looking for portfolio risk? It has its own page.</p>
                    <div className="flex gap-4">
                        <Link to="/risk" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Risk <ArrowRight className="h-3.5 w-3.5" /></Link>
                        <Link to="/research" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Research checklist <ArrowRight className="h-3.5 w-3.5" /></Link>
                    </div>
                </div>

                {/* Quality screen */}
                <section className="space-y-3" id="screen">
                    <div>
                        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
                            Which companies look strongest within their sector?
                            <Explain term="sectorLeaders" />
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                            This is a quality screen, a list of companies worth researching further. It is not a list of stocks to buy. A backtest found no evidence that holding the highest-ranked companies beat the average of their sector.
                            {latestPeriod && <> Data period: <span className="font-mono text-foreground">{latestPeriod}</span>.</>}
                        </p>
                    </div>

                    {sectors.length === 0 ? (
                        <div className="surface p-6 text-center text-sm text-muted-foreground">
                            {isLoading ? 'Loading the screen...' : 'No screen data available. Start the NEPSE server and refresh.'}
                        </div>
                    ) : (
                        <>
                            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                                <Button size="sm" variant={selectedSector === 'ALL' ? 'default' : 'outline'} onClick={() => setSelectedSector('ALL')} className="h-8 shrink-0 text-xs">
                                    All sectors ({sectors.length})
                                </Button>
                                {sectors.map((sec) => (
                                    <Button key={sec} size="sm" variant={selectedSector === sec ? 'default' : 'outline'} onClick={() => setSelectedSector(sec)} className="h-8 shrink-0 text-xs">
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
                                                                            <span className="font-mono text-xs text-muted-foreground">#{rank}</span>
                                                                            <Link to={`/quarterly?symbol=${stock.symbol}`} className="font-mono text-base font-semibold hover:underline">
                                                                                {stock.symbol}
                                                                            </Link>
                                                                        </div>
                                                                        {stock.name && <p className="max-w-[200px] truncate text-xs text-muted-foreground" title={stock.name}>{stock.name}</p>}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="font-mono text-sm font-semibold">{stock.score.toFixed(1)}</p>
                                                                        <p className="text-[11px] text-muted-foreground">quality score</p>
                                                                        {check && (
                                                                            <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground" title="Checklist signals passed">
                                                                                <ShieldCheck className="h-3 w-3" /> {check.passed}/{check.assessable} checks
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                                                    <div><span className="block text-muted-foreground">ROE</span><span className="font-mono">{stock.roe.toFixed(1)}%</span></div>
                                                                    <div><span className="block text-muted-foreground">P/E</span><span className="font-mono">{stock.pe > 0 ? stock.pe.toFixed(1) : '-'}</span></div>
                                                                    <div><span className="block text-muted-foreground">Div. yield</span><span className="font-mono">{stock.divYield !== undefined && stock.divYield > 0 ? `${stock.divYield.toFixed(1)}%` : '-'}</span></div>
                                                                </div>

                                                                {Object.keys(pillars).length > 0 && (
                                                                    <ul className="mt-2.5 space-y-1" aria-label="Factor scores, 0 to 100">
                                                                        {PILLARS.map(({ key, label }) => {
                                                                            const v = pillars[key];
                                                                            const has = v !== undefined && v !== null;
                                                                            return (
                                                                                <li key={key} className="grid grid-cols-[84px_1fr_28px] items-center gap-2 text-[11px]">
                                                                                    <span className="text-muted-foreground">{label}</span>
                                                                                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                                                        {has && <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, v as number))}%` }} />}
                                                                                    </span>
                                                                                    <span className="text-right font-mono">{has ? (v as number).toFixed(0) : 'n/a'}</span>
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
                        <h2 className="text-lg font-semibold">What does recent research say about Nepal's economy?</h2>
                        <p className="text-sm text-muted-foreground">The most cited papers from OpenAlex on Nepal's monetary policy, bank liquidity and the NEPSE market.</p>
                    </div>
                    {macroResearch.length > 0 ? (
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {macroResearch.map((paper, idx) => (
                                <li key={idx} className="surface p-4">
                                    <h4 className="mb-2 text-sm font-semibold leading-snug">{paper.title}</h4>
                                    <p className="mb-3 text-xs text-muted-foreground">
                                        {paper.publication_year} &middot; cited {paper.cited_by_count} times
                                    </p>
                                    <div className="flex gap-4 text-xs">
                                        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                            View paper <ExternalLink className="h-3 w-3" />
                                        </a>
                                        {paper.open_access_pdf && (
                                            <a href={paper.open_access_pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                                PDF <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="surface p-6 text-center text-sm text-muted-foreground">
                            {isLoading ? 'Loading papers...' : 'No research data found.'}
                        </div>
                    )}
                </section>

                <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            </main>

            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
}
