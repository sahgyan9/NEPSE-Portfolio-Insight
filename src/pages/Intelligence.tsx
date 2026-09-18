import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AIChatbot } from '@/components/AIChatbot';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { usePortfolioAnalytics } from '@/hooks/usePortfolio';
import { useApiKey } from '@/hooks/useApiKey';
import { ArrowLeft, Brain, TrendingUp, AlertTriangle, CheckCircle, ExternalLink, RefreshCw, Award, ShieldCheck, Layers, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { PortfolioHealthScore } from '@/components/PortfolioHealthScore';
import { Badge } from '@/components/ui/badge';

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

interface SectorExposure {
    sector: string;
    weight: number;
}

interface ValuationWarning {
    symbol: string;
    type: 'OVERVALUED' | 'UNDERVALUED';
    message: string;
    pe: number;
}

interface OptimizationData {
    totalValue: number;
    holdingCount: number;
    volatilityScore: number;
    sectorExposure: SectorExposure[];
    suggestion: string;
    valuationWarnings: ValuationWarning[];
}

export default function IntelligencePage() {
    const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();
    const { holdings, summary, isLoading: portfolioLoading, refetch } = usePortfolioAnalytics();

    const [macroResearch, setMacroResearch] = useState<MacroPaper[]>([]);
    const [optimization, setOptimization] = useState<OptimizationData | null>(null);
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

            // Fetch Portfolio Optimization
            const optUrl = import.meta.env.DEV
                ? '/api/portfolio-db/api/portfolio-optimization'
                : 'http://localhost:5001/api/portfolio-optimization';
            const optRes = await fetch(optUrl);
            if (optRes.ok) {
                const data = await optRes.json();
                if (data.optimization && !data.optimization.error) {
                    setOptimization(data.optimization);
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
                title: 'Error',
                description: 'Failed to load intelligence data.',
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
            title: 'Intelligence Refreshed',
            description: 'Macro research and portfolio metrics updated.',
        });
    };

    // Helper to get volatility color
    const getVolatilityColor = (score: number) => {
        if (score > 0.3) return 'text-red-500';
        if (score < 0.18) return 'text-yellow-500';
        return 'text-green-500';
    };

    return (
        <div className="min-h-screen bg-background">
            <Header
                onRefresh={handleRefresh}
                isRefreshing={isLoading || portfolioLoading}
            />

            <main className="container px-4 py-6">
                <div className="mb-6">
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>

                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <Brain className="w-8 h-8 text-primary" />
                            Macro Intelligence
                        </h1>
                        <p className="text-muted-foreground">
                            Quantitative portfolio optimization and Nepal macro-economic policy research.
                        </p>
                    </div>
                    <Button onClick={() => handleRefresh()} disabled={isLoading} variant="outline" className="gap-2">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Sync Data
                    </Button>
                </div>

                <div className="space-y-6">
                    {/* FULL WIDTH: Portfolio Health Score */}
                    <PortfolioHealthScore holdings={holdings} />

                    {/* Multi-Factor Sector Leaders (Top 3 per Sector) */}
                    {Object.keys(quarterlyPerformers).length > 0 && (
                        <Card className="border-amber-500/20 bg-gradient-to-br from-card to-amber-500/5">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                                    <CardTitle className="flex items-center gap-2">
                                        <Award className="w-6 h-6 text-amber-500" />
                                        <span>Multi-Factor Sector Leaders (Top 3 per Sector)</span>
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                                            {latestPeriod || "Active Market Universe"}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                            {Object.keys(quarterlyPerformers).length} Sectors Evaluated
                                        </Badge>
                                    </div>
                                </div>
                                <CardDescription className="text-xs text-muted-foreground flex flex-col gap-1.5">
                                    <span>
                                        Ranked across 213 eligible operating NEPSE equities using an institutional 5-pillar composite model (Asness-Frazzini-Pedersen QMJ / Piotroski F-Score) with empirical Bayesian shrinkage (k=8):
                                    </span>
                                    <div className="flex flex-wrap gap-2 text-[11px] font-mono pt-1">
                                        <span className="bg-muted px-2 py-0.5 rounded text-foreground/90 border">P: Profitability (30-35%)</span>
                                        <span className="bg-muted px-2 py-0.5 rounded text-foreground/90 border">G: Growth (15-20%)</span>
                                        <span className="bg-muted px-2 py-0.5 rounded text-foreground/90 border">S: Safety (15-30%)</span>
                                        <span className="bg-muted px-2 py-0.5 rounded text-foreground/90 border">Y: Payout (10-15%)</span>
                                        <span className="bg-muted px-2 py-0.5 rounded text-foreground/90 border">V: Valuation (15%)</span>
                                    </div>
                                </CardDescription>

                                {/* Sector Filter Pills */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 no-scrollbar">
                                    <Button
                                        size="sm"
                                        variant={selectedSector === 'ALL' ? 'default' : 'outline'}
                                        onClick={() => setSelectedSector('ALL')}
                                        className="h-7 text-xs rounded-full px-3 shrink-0"
                                    >
                                        All Sectors ({Object.keys(quarterlyPerformers).length})
                                    </Button>
                                    {Object.keys(quarterlyPerformers).map((sec) => (
                                        <Button
                                            key={sec}
                                            size="sm"
                                            variant={selectedSector === sec ? 'default' : 'outline'}
                                            onClick={() => setSelectedSector(sec)}
                                            className="h-7 text-xs rounded-full px-3 shrink-0"
                                        >
                                            {sec}
                                        </Button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                    {Object.entries(quarterlyPerformers)
                                        .filter(([sector]) => selectedSector === 'ALL' || selectedSector === sector)
                                        .map(([sector, stocks]: [string, any[]]) => {
                                            if (!stocks || stocks.length === 0) return null;
                                            return (
                                                <div key={sector} className="p-4 rounded-xl border bg-background/60 hover:border-amber-500/30 transition-all flex flex-col justify-between space-y-4">
                                                    <div>
                                                        <div className="flex items-center justify-between pb-2 border-b">
                                                            <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                                                                {sector}
                                                            </h3>
                                                            <span className="text-[11px] text-muted-foreground/80 font-mono">
                                                                {stocks.length} Top Pick{stocks.length > 1 ? 's' : ''}
                                                            </span>
                                                        </div>

                                                        {/* Top 3 Stocks List */}
                                                        <div className="divide-y divide-border/60">
                                                            {stocks.slice(0, 3).map((stock: any, idx: number) => {
                                                                const rank = stock.rank || idx + 1;
                                                                const isFirst = rank === 1;
                                                                const pillars = stock.pillars || {};
                                                                const check = stock.checklist;

                                                                return (
                                                                    <div key={stock.symbol} className={`py-3 first:pt-2 last:pb-0 ${isFirst ? 'bg-amber-500/5 -mx-2 px-2 rounded-lg' : ''}`}>
                                                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                                                                    isFirst 
                                                                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                                                                        : 'bg-muted text-muted-foreground border'
                                                                                }`}>
                                                                                    #{rank}
                                                                                </span>
                                                                                <div>
                                                                                    <Link
                                                                                        to={`/quarterly?symbol=${stock.symbol}`}
                                                                                        className="text-base font-bold font-mono text-foreground border-b border-dashed border-primary/40 hover:border-solid hover:text-primary transition-all cursor-pointer"
                                                                                        title={`Analyze ${stock.symbol} fundamentals`}
                                                                                    >
                                                                                        {stock.symbol}
                                                                                    </Link>
                                                                                    {stock.name && (
                                                                                        <p className="text-[11px] text-muted-foreground truncate max-w-[170px]" title={stock.name}>
                                                                                            {stock.name}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex flex-col items-end gap-1">
                                                                                <Badge className={`border-none font-bold text-[11px] ${
                                                                                    stock.score >= 65 
                                                                                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15' 
                                                                                        : stock.score >= 55
                                                                                            ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/15'
                                                                                            : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/15'
                                                                                }`}>
                                                                                    Score: {stock.score.toFixed(1)}
                                                                                </Badge>
                                                                                {check && (
                                                                                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5" title="Piotroski-style checklist signals passed">
                                                                                        <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
                                                                                        {check.passed}/{check.assessable} signals
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Key Metrics Grid */}
                                                                        <div className="grid grid-cols-3 gap-1.5 text-[11px] text-muted-foreground pt-1">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] text-muted-foreground/70">ROE</span>
                                                                                <span className="font-semibold text-foreground font-mono">{stock.roe.toFixed(1)}%</span>
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] text-muted-foreground/70">EPS (TTM)</span>
                                                                                <span className="font-semibold text-foreground font-mono">{stock.eps > 0 ? stock.eps.toFixed(1) : '-'}</span>
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] text-muted-foreground/70">P/E</span>
                                                                                <span className="font-semibold text-foreground font-mono">{stock.pe > 0 ? stock.pe.toFixed(1) : '-'}</span>
                                                                            </div>
                                                                            {stock.netMargin !== undefined && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] text-muted-foreground/70">Margin</span>
                                                                                    <span className="font-semibold text-foreground font-mono">{stock.netMargin.toFixed(1)}%</span>
                                                                                </div>
                                                                            )}
                                                                            {stock.divYield !== undefined && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] text-muted-foreground/70">Div Yield</span>
                                                                                    <span className="font-semibold text-emerald-400 font-mono">{stock.divYield > 0 ? stock.divYield.toFixed(1) + '%' : '-'}</span>
                                                                                </div>
                                                                            )}
                                                                            {stock.epsGrowth !== undefined && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] text-muted-foreground/70">EPS YoY</span>
                                                                                    <span className={`font-semibold font-mono ${stock.epsGrowth >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                                                        {stock.epsGrowth >= 0 ? "+" : ""}{stock.epsGrowth.toFixed(1)}%
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* 5 Pillars Micro-Bar */}
                                                                        {pillars && Object.keys(pillars).length > 0 && (
                                                                            <div 
                                                                                className="mt-2 pt-1.5 border-t border-dashed border-border/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground"
                                                                                title="5 Pillars (Percentiles 0-100): P=Profitability, G=Growth, S=Safety, Y=Payout, V=Valuation"
                                                                            >
                                                                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Pillars</span>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span title="Profitability" className="px-1 py-0.2 rounded bg-muted">P:{pillars.P !== undefined && pillars.P !== null ? pillars.P.toFixed(0) : '-'}</span>
                                                                                    <span title="Growth" className="px-1 py-0.2 rounded bg-muted">G:{pillars.G !== undefined && pillars.G !== null ? pillars.G.toFixed(0) : '-'}</span>
                                                                                    <span title="Safety" className="px-1 py-0.2 rounded bg-muted">S:{pillars.S !== undefined && pillars.S !== null ? pillars.S.toFixed(0) : 'Unv'}</span>
                                                                                    <span title="Payout / Yield" className="px-1 py-0.2 rounded bg-muted">Y:{pillars.Y !== undefined && pillars.Y !== null ? pillars.Y.toFixed(0) : '-'}</span>
                                                                                    <span title="Valuation" className="px-1 py-0.2 rounded bg-muted">V:{pillars.V !== undefined && pillars.V !== null ? pillars.V.toFixed(0) : '-'}</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* TWO COLUMN GRID: Macro Research & Portfolio Optimizer */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT COLUMN: NRB Policy & Macro Research */}
                        <Card className="h-full border-muted-foreground/20">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-purple-500" />
                                    NRB Policy & Macro Research
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Live feed of the most highly cited academic papers from OpenAlex regarding Nepal's monetary policy, banking liquidity, and NEPSE market efficiency.
                                </p>
                                
                                {macroResearch.length > 0 ? (
                                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                        {macroResearch.map((paper, idx) => (
                                            <div key={idx} className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                                <h4 className="font-semibold text-sm mb-2 leading-tight">{paper.title}</h4>
                                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                                                    <span className="bg-background px-2 py-1 rounded border">Year: {paper.publication_year}</span>
                                                    <span className="bg-background px-2 py-1 rounded border flex items-center gap-1">
                                                        Citations: <strong className="text-foreground">{paper.cited_by_count}</strong>
                                                    </span>
                                                </div>
                                                <div className="flex gap-3">
                                                    <a href={paper.url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-primary hover:underline">
                                                        View Paper <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                    {paper.open_access_pdf && (
                                                        <a href={paper.open_access_pdf} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-red-500 hover:underline">
                                                            Download PDF
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center text-muted-foreground">
                                        {isLoading ? "Fetching latest macro-economic research..." : "No research data found."}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* RIGHT COLUMN: Quantitative Portfolio Optimizer */}
                        <Card className="border-primary/20 shadow-lg">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-blue-500" />
                                    Quantitative Portfolio Optimizer
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {optimization ? (
                                    <div className="space-y-6">
                                        {/* Volatility Score */}
                                        <div className="p-4 rounded-lg bg-background border flex justify-between items-center">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Variance Drag (Volatility Beta)</p>
                                                <p className={`text-3xl font-bold ${getVolatilityColor(optimization.volatilityScore)}`}>
                                                    {optimization.volatilityScore.toFixed(3)}
                                                </p>
                                            </div>
                                            <div className="text-right max-w-[200px]">
                                                {optimization.volatilityScore > 0.3 ? (
                                                    <span className="flex items-center gap-1 text-red-500 text-sm font-medium"><AlertTriangle className="w-4 h-4"/> High Risk</span>
                                                ) : optimization.volatilityScore < 0.18 ? (
                                                    <span className="flex items-center gap-1 text-yellow-500 text-sm font-medium"><AlertTriangle className="w-4 h-4"/> Over-defensive</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-green-500 text-sm font-medium"><CheckCircle className="w-4 h-4"/> Balanced Risk</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Suggestion Text */}
                                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                                            <strong>AI Suggestion:</strong> {optimization.suggestion}
                                        </div>

                                        {/* Valuation Warnings */}
                                        {optimization.valuationWarnings && optimization.valuationWarnings.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold mb-3 text-sm">Valuation Anomalies</h4>
                                                <div className="space-y-2">
                                                    {optimization.valuationWarnings.map((warn, idx) => (
                                                        <div key={idx} className={`p-3 rounded border text-sm flex gap-3 ${warn.type === 'OVERVALUED' ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                                                            {warn.type === 'OVERVALUED' ? <AlertTriangle className="w-5 h-5 text-red-500 shrink-0"/> : <CheckCircle className="w-5 h-5 text-green-500 shrink-0"/>}
                                                            <div>
                                                                <span className="font-bold">{warn.symbol}</span> 
                                                                <span className="text-muted-foreground ml-2">(P/E: {warn.pe.toFixed(1)})</span>
                                                                <p className="mt-1">{warn.message}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Sector Exposure */}
                                        <div>
                                            <h4 className="font-semibold mb-3 text-sm">Sector Allocation Weights</h4>
                                            <div className="space-y-2">
                                                {optimization.sectorExposure.map((sec, idx) => (
                                                    <div key={idx} className="flex items-center justify-between">
                                                        <span className="text-sm text-muted-foreground">{sec.sector}</span>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary" style={{ width: `${sec.weight * 100}%` }}></div>
                                                            </div>
                                                            <span className="text-sm font-mono w-12 text-right">{(sec.weight * 100).toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center text-muted-foreground">
                                        {isLoading ? "Running mathematical optimization..." : "No portfolio data available."}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
                
                {/* Footer */}
                <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            </main>

            {/* AI Chatbot */}
            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
}
