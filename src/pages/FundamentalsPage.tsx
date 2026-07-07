/**
 * Fundamentals Analysis Page
 * ==========================
 * 
 * Comprehensive view of portfolio fundamentals including:
 * - Portfolio health score
 * - Individual stock valuations
 * - Dividend tracking
 * - Educational thresholds guide
 */

import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { PortfolioHealthScore } from '@/components/PortfolioHealthScore';
import { StockValuationCard } from '@/components/StockValuationCard';
import { DividendTracker } from '@/components/DividendTracker';
import { MetricThresholdsGuide } from '@/components/MetricThresholdsGuide';
import { AIChatbot } from '@/components/AIChatbot';
import { Badge } from '@/components/ui/badge';
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
import { STORAGE_KEYS } from '@/lib/constants';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const FundamentalsPage = () => {
    const [apiKey, setApiKey] = useState(() =>
        localStorage.getItem(STORAGE_KEYS.apiKey) || ''
    );
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'score' | 'pe' | 'pb' | 'dividend' | 'gainLoss'>('score');
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
            }

            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return result;
    }, [holdings, searchQuery, sectorFilter, sortBy, sortOrder]);

    const handleApiKeyChange = (key: string) => {
        setApiKey(key);
        localStorage.setItem(STORAGE_KEYS.apiKey, key);
    };

    const handleRefresh = async () => {
        await refetch();
        toast({
            title: 'Data Refreshed',
            description: 'Portfolio data has been updated.',
        });
    };

    return (
        <div className="min-h-screen bg-background">
            <Header
                apiKey={apiKey}
                onApiKeyChange={handleApiKeyChange}
                onRefresh={handleRefresh}
                isRefreshing={isLoading}
            />

            <main className="container px-4 py-6">
                {/* Back Navigation */}
                <div className="mb-6">
                    <Link to="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>

                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Fundamental Analysis</h1>
                    <p className="text-muted-foreground">
                        Deep dive into your portfolio's valuation metrics, dividend potential, and investment health
                    </p>
                    {lastUpdated && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </p>
                    )}
                </div>

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="grid grid-cols-4 w-full max-w-lg">
                        <TabsTrigger value="overview" className="gap-2">
                            <PieChart className="w-4 h-4" />
                            <span className="hidden sm:inline">Overview</span>
                        </TabsTrigger>
                        <TabsTrigger value="valuations" className="gap-2">
                            <TrendingUp className="w-4 h-4" />
                            <span className="hidden sm:inline">Valuations</span>
                        </TabsTrigger>
                        <TabsTrigger value="dividends" className="gap-2">
                            <Coins className="w-4 h-4" />
                            <span className="hidden sm:inline">Dividends</span>
                        </TabsTrigger>
                        <TabsTrigger value="learn" className="gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span className="hidden sm:inline">Learn</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <PortfolioHealthScore holdings={holdings} />

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <QuickStatCard
                                label="Avg P/E Ratio"
                                value={calculateAverage(holdings, 'peRatio').toFixed(1)}
                                status={calculateAverage(holdings, 'peRatio') < 20 ? 'good' : 'warning'}
                                benchmark="< 20 is good"
                            />
                            <QuickStatCard
                                label="Avg P/B Ratio"
                                value={calculateAverage(holdings, 'pbRatio').toFixed(2)}
                                status={calculateAverage(holdings, 'pbRatio') < 2 ? 'good' : 'warning'}
                                benchmark="< 2 is good"
                            />
                            <QuickStatCard
                                label="Avg Dividend Yield"
                                value={`${calculateAverage(holdings, 'dividendYield').toFixed(1)}%`}
                                status={calculateAverage(holdings, 'dividendYield') > 3 ? 'good' : 'neutral'}
                                benchmark="> 3% is good"
                            />
                            <QuickStatCard
                                label="Value Stocks"
                                value={`${holdings.filter(h => calculateValuationScore(h).overallScore >= 65).length}/${holdings.length}`}
                                status="neutral"
                                benchmark="Score ≥ 65"
                            />
                        </div>
                    </TabsContent>

                    {/* Valuations Tab */}
                    <TabsContent value="valuations" className="space-y-6">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-3">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search stocks..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            <Select value={sectorFilter} onValueChange={setSectorFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Sector" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sectors</SelectItem>
                                    {sectors.map((sector) => (
                                        <SelectItem key={sector} value={sector}>
                                            {sector}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="score">Health Score</SelectItem>
                                    <SelectItem value="pe">P/E Ratio</SelectItem>
                                    <SelectItem value="pb">P/B Ratio</SelectItem>
                                    <SelectItem value="dividend">Dividend Yield</SelectItem>
                                    <SelectItem value="gainLoss">Gain/Loss %</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            >
                                {sortOrder === 'asc' ? (
                                    <SortAsc className="w-4 h-4" />
                                ) : (
                                    <SortDesc className="w-4 h-4" />
                                )}
                            </Button>

                            <div className="flex border rounded-md">
                                <Button
                                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                    size="icon"
                                    onClick={() => setViewMode('grid')}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                    size="icon"
                                    onClick={() => setViewMode('list')}
                                >
                                    <List className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Results count */}
                        <div className="text-sm text-muted-foreground">
                            Showing {filteredHoldings.length} of {holdings.length} holdings
                        </div>

                        {/* Stock Cards */}
                        <div className={
                            viewMode === 'grid'
                                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                                : 'space-y-4'
                        }>
                            {filteredHoldings.map((holding) => (
                                <StockValuationCard
                                    key={holding.scrip}
                                    holding={holding}
                                    showDetails={viewMode === 'grid'}
                                />
                            ))}
                        </div>

                        {filteredHoldings.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">No holdings match your filters</p>
                            </div>
                        )}
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

                {/* Footer */}
                <footer className="text-center py-8 mt-8 border-t border-border/40">
                    <p className="text-sm text-muted-foreground">
                        Valuation metrics based on{' '}
                        <span className="text-primary">Benjamin Graham's</span> value investing principles
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Disclaimer: This is educational content, not financial advice.
                    </p>
                </footer>
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

// Quick stat card component
const QuickStatCard = ({
    label,
    value,
    status,
    benchmark,
}: {
    label: string;
    value: string;
    status: 'good' | 'warning' | 'neutral';
    benchmark: string;
}) => {
    const statusColors = {
        good: 'bg-green-500/10 border-green-500/20 text-green-600',
        warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600',
        neutral: 'bg-muted border-border text-foreground',
    };

    return (
        <div className={`p-4 rounded-lg border ${statusColors[status]}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <Badge variant="outline" className="mt-2 text-xs">
                {benchmark}
            </Badge>
        </div>
    );
};

export default FundamentalsPage;
