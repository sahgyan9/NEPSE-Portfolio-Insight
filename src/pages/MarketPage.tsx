/**
 * Market Overview Page
 * ====================
 * 
 * Real-time NEPSE market data including:
 * - NEPSE Index
 * - Market summary
 * - Top gainers/losers
 * - Sector indices
 */

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MarketContextDisplay } from '@/components/MarketContext';
import { FundamentalsArchiveCard } from '@/components/FundamentalsArchiveCard';
import { AIChatbot } from '@/components/AIChatbot';
import { Button } from '@/components/ui/button';
import { usePortfolioAnalytics } from '@/hooks/usePortfolio';
import { useApiKey } from '@/hooks/useApiKey';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const MarketPage = () => {
    const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();

    const { holdings, summary, isLoading, refetch } = usePortfolioAnalytics();

    const handleRefresh = async () => {
        await refetch();
        toast({
            title: 'Data Refreshed',
            description: 'Market data has been updated.',
        });
    };

    return (
        <div className="min-h-screen bg-background">
            <Header
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
                    <h1 className="text-3xl font-bold mb-2">Market Overview</h1>
                    <p className="text-muted-foreground">
                        Real-time Nepal Stock Exchange (NEPSE) market data and indices
                    </p>
                </div>

                {/* Market Context Display */}
                <MarketContextDisplay />

                {/* All-company fundamentals archive (build history for later analysis) */}
                <FundamentalsArchiveCard />

                {/* Educational Note */}
                <div className="mt-8 p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-semibold mb-2">📊 Understanding NEPSE Market</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div>
                            <p className="font-medium text-foreground mb-1">Market Hours</p>
                            <p>Sunday - Thursday: 10:30 AM - 3:30 PM</p>
                            <p>Friday & Saturday: Closed</p>
                        </div>
                        <div>
                            <p className="font-medium text-foreground mb-1">Circuit Breakers</p>
                            <p>Stock price limit: ±15% per day (since Apr 2026)</p>
                            <p>Market halt: NEPSE index moves ±8% in a day</p>
                        </div>
                        <div>
                            <p className="font-medium text-foreground mb-1">Settlement</p>
                            <p>T+2 settlement (trade + 2 days)</p>
                        </div>
                        <div>
                            <p className="font-medium text-foreground mb-1">Index Base</p>
                            <p>NEPSE Index base: 100 (Feb 1994)</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            </main>

            {/* AI Chatbot - Floating */}
            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
};

export default MarketPage;
