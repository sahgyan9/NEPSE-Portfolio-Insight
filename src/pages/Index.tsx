import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { toast } from "@/hooks/use-toast";
import { STORAGE_KEYS } from "@/lib/constants";
import { TrendingUp, Activity, Coins, ArrowRight, BookOpen, CheckCircle2, Loader2, Brain, Newspaper } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Index = () => {
  const [apiKey, setApiKey] = useState("");

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
    isDbConnected
  } = usePortfolioAnalytics();

  useEffect(() => {
    // Load API key from localStorage
    const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    if (savedKey) {
      setApiKey(savedKey);
    }

    // Pre-populate with provided key
    const defaultKey = "AIzaSyCXEgV6ChL8LLkENETsJoSVIAKsgqSl8Tg";
    if (!savedKey) {
      setApiKey(defaultKey);
      localStorage.setItem(STORAGE_KEYS.apiKey, defaultKey);
    }
  }, []);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEYS.apiKey, key);
  };

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Data Refreshed",
      description: lastUpdated
        ? `Portfolio data updated at ${lastUpdated.toLocaleTimeString()}`
        : "Portfolio data has been updated.",
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
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      <main className="container px-4 py-6 space-y-6 relative">
        {/* Quick Section Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sticky top-[100px] z-40 bg-background/95 backdrop-blur-md py-2 mb-4">
          {[
            { id: 'summary', label: 'Summary', icon: <Activity className="w-3 h-3 mr-1" /> },
            { id: 'holdings', label: 'Holdings', icon: <Coins className="w-3 h-3 mr-1" /> },
            { id: 'watchlist', label: 'Watchlist', icon: <BookOpen className="w-3 h-3 mr-1" /> },
            { id: 'charts', label: 'Charts', icon: <TrendingUp className="w-3 h-3 mr-1" /> },
            { id: 'news', label: 'News & Perf', icon: <Newspaper className="w-3 h-3 mr-1" /> },
            { id: 'ai', label: 'AI Insights', icon: <Brain className="w-3 h-3 mr-1" /> },
          ].map(s => (
            <Button 
              key={s.id} 
              variant="ghost" 
              size="sm" 
              className="rounded-full text-xs h-8 whitespace-nowrap bg-muted/40 hover:bg-primary/20 hover:text-primary transition-all font-medium"
              onClick={() => {
                const el = document.getElementById(s.id);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.scrollY - 140;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }}
            >
              {s.icon} {s.label}
            </Button>
          ))}
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

        {/* Top/Worst Performers & News Feed */}
        <section id="news" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopPerformers topPerformers={topPerformers} worstPerformers={worstPerformers} />
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
        <footer className="text-center py-8 border-t border-border/40">
          <p className="text-sm text-muted-foreground">
            Data as of Nov 30, 2025 • Investment advice based on{" "}
            <span className="text-primary">The Intelligent Investor</span> principles
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Disclaimer: This is not financial advice. Always do your own research.
          </p>
        </footer>
      </main>

      {/* AI Chatbot - Floating */}
      <AIChatbot holdings={holdings} summary={summary} />
    </div>
  );
};

export default Index;
