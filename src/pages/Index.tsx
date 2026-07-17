import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PortfolioSummaryCards } from "@/components/PortfolioSummaryCards";
import { HoldingsTable } from "@/components/HoldingsTable";
import { PerformanceChart } from "@/components/PerformanceChart";
import { PortfolioValueTrendChart } from "@/components/PortfolioValueTrendChart";
import { AIRecommendations } from "@/components/AIRecommendations";
import { TopPerformers } from "@/components/TopPerformers";
import { DividendSummaryCard } from "@/components/DividendTracker";
import { MarketContextDisplay } from "@/components/MarketContext";
import { AIChatbot } from "@/components/AIChatbot";
import { WatchlistTable } from "@/components/WatchlistTable";
import { PortfolioNewsFeed } from "@/components/PortfolioNewsFeed";
import { PortfolioImportZone } from "@/components/PortfolioImportZone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { toast } from "@/hooks/use-toast";
import { TrendingUp, Activity, Coins, ArrowRight, BookOpen, CheckCircle2, Loader2, Brain, Newspaper, Award } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Index = () => {
  const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();

  // Use live portfolio data from ShareBazaar API
  const {
    holdings,
    summary,
    sectorData,
    topPerformers,
    worstPerformers,
    isLoading,
    error,
    lastUpdated,
    refetch,
    isDbConnected,
    isEmpty
  } = usePortfolioAnalytics();

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Data Refreshed",
      description: lastUpdated
        ? `Portfolio data updated at ${lastUpdated.toLocaleTimeString()}`
        : "Portfolio data has been updated.",
    });
  };

  const handlePortfolioImported = async () => {
    await refetch();
    toast({
      title: "Portfolio imported",
      description: "Your holdings are loaded. Welcome aboard!",
    });
  };

  // Show toast when there's an error fetching live data
  useEffect(() => {
    if (error) {
      toast({
        title: "Live Data Notice",
        description: error,
        variant: "default",
      });
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      {isEmpty ? (
        <main className="container px-4 py-16 relative">
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Welcome — let's load your portfolio</h2>
              <p className="text-muted-foreground mt-2">
                Import your holdings once and every chart, score and insight fills in automatically.
                Nothing is entered by hand.
              </p>
            </div>
            <PortfolioImportZone onImported={handlePortfolioImported} />
          </div>
        </main>
      ) : (
      <main className="container px-4 py-6 space-y-6 relative">
        {/* Quick Section Navigation */}
        <div className="w-full sticky top-[64px] z-40 bg-background/80 backdrop-blur-md py-2 mb-6">
          <div className="flex flex-wrap md:grid md:grid-cols-7 gap-1.5 justify-center w-full">
            {[
              { id: 'summary', label: 'Summary', icon: <Activity className="w-3 h-3" /> },
              { id: 'holdings', label: 'Holdings', icon: <Coins className="w-3 h-3" /> },
              { id: 'watchlist', label: 'Watchlist', icon: <BookOpen className="w-3 h-3" /> },
              { id: 'charts', label: 'Charts', icon: <TrendingUp className="w-3 h-3" /> },
              { id: 'performers', label: 'Performers', icon: <Award className="w-3 h-3" /> },
              { id: 'news', label: 'News Feed', icon: <Newspaper className="w-3 h-3" /> },
              { id: 'ai', label: 'AI Insights', icon: <Brain className="w-3 h-3" /> },
            ].map(s => (
              <Button 
                key={s.id} 
                variant="ghost" 
                size="sm" 
                className="flex-1 md:w-full min-w-[90px] text-[11px] h-7 bg-muted/20 hover:bg-primary/10 hover:text-primary transition-all font-medium border border-border/30 rounded-full flex items-center justify-center gap-1 text-foreground"
                onClick={() => {
                  const el = document.getElementById(s.id);
                  if (el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 128;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
              >
                {s.icon}
                <span>{s.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Live Data Status Banner */}
        {isLoading && (
          <Alert className="border-blue-500/50 bg-blue-500/10">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              Fetching live data from ShareBazaar API...
            </AlertDescription>
          </Alert>
        )}
        {!isLoading && lastUpdated && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-600 dark:text-green-400">
              {isDbConnected ? "📦 Portfolio from database • " : ""}Live data fetched from ShareBazaar API • Last updated: {lastUpdated.toLocaleTimeString()}
            </AlertDescription>
          </Alert>
        )}

        {/* Market Context Widget */}
        <section id="market-context">
          <MarketContextDisplay compact />
        </section>

        {/* Summary Cards */}
        <section id="summary">
          <PortfolioSummaryCards summary={summary} />
        </section>

        {/* Holdings Table */}
        <section id="holdings">
          <HoldingsTable holdings={holdings} />
        </section>

        {/* Watchlist Table */}
        <section id="watchlist">
          <WatchlistTable />
        </section>

        {/* Portfolio Value Trend Chart */}
        <section id="charts" className="relative z-20">
          <PortfolioValueTrendChart summary={summary} />
        </section>

        {/* Performance Chart */}
        <section className="relative z-10">
          <PerformanceChart holdings={holdings} />
        </section>

        {/* Top/Worst Performers */}
        <section id="performers" className="relative z-10">
          <TopPerformers topPerformers={topPerformers} worstPerformers={worstPerformers} />
        </section>

        {/* News Feed */}
        <section id="news" className="relative z-10">
          <PortfolioNewsFeed holdings={holdings} />
        </section>

        {/* AI Recommendations */}
        <section id="ai">
          <AIRecommendations holdings={holdings} summary={summary} apiKey={apiKey} />
        </section>

        {/* Quick Navigation Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/fundamentals">
            <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Fundamental Analysis
                </CardTitle>
                <CardDescription>P/E, P/B, dividends & valuation scores</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="gap-2 group-hover:text-primary">
                  View Analysis <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link to="/market">
            <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Market Overview
                </CardTitle>
                <CardDescription>NEPSE index, top gainers & losers</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="gap-2 group-hover:text-primary">
                  View Market <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link to="/intelligence">
            <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  Macro Intelligence
                </CardTitle>
                <CardDescription>Policy research & portfolio optimization</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="gap-2 group-hover:text-primary">
                  View Intelligence <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          <DividendSummaryCard holdings={holdings} />
        </section>

        {/* Footer */}
        <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
      </main>
      )}

      {/* AI Chatbot - Floating */}
      <AIChatbot holdings={holdings} summary={summary} />
    </div>
  );
};

export default Index;
