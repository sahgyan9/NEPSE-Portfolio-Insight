import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { AIChatbot } from '@/components/AIChatbot';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { usePortfolioAnalytics } from '@/hooks/usePortfolio';
import { STORAGE_KEYS } from '@/lib/constants';
import { ArrowLeft, Brain, TrendingUp, AlertTriangle, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

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
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.apiKey) || '');
    const { holdings, summary, isLoading: portfolioLoading, refetch } = usePortfolioAnalytics();
    
    const [macroResearch, setMacroResearch] = useState<MacroPaper[]>([]);
    const [optimization, setOptimization] = useState<OptimizationData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleApiKeyChange = (key: string) => {
        setApiKey(key);
        localStorage.setItem(STORAGE_KEYS.apiKey, key);
    };

    const fetchIntelligence = async (force: boolean = false) => {
        setIsLoading(true);
        try {
            // Fetch Macro Research
            const macroRes = await fetch(`http://localhost:5001/api/macro-research?force=${force}`);
            if (macroRes.ok) {
                const data = await macroRes.json();
                if (data.research && Array.isArray(data.research)) {
                    setMacroResearch(data.research);
                }
            }

            // Fetch Portfolio Optimization
            const optRes = await fetch('http://localhost:5001/api/portfolio-optimization');
            if (optRes.ok) {
                const data = await optRes.json();
                if (data.optimization && !data.optimization.error) {
                    setOptimization(data.optimization);
                }
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
                apiKey={apiKey}
                onApiKeyChange={handleApiKeyChange}
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: Portfolio Optimizer */}
                    <div className="space-y-6">
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

                    {/* RIGHT COLUMN: Macro Policy Watcher */}
                    <div className="space-y-6">
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
                    </div>
                </div>
                
                {/* Footer */}
                <footer className="text-center py-8 mt-8 border-t border-border/40">
                    <p className="text-sm text-muted-foreground">
                        Optimization uses frontier market heuristics • Research data provided by OpenAlex (Free Open Access)
                    </p>
                </footer>
            </main>

            {/* AI Chatbot */}
            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
}
