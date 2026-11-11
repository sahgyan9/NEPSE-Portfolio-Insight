import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
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
import { PortfolioHealthScore } from "@/components/PortfolioHealthScore";
import { SectorAllocationChart } from "@/components/SectorAllocationChart";
import { TopHoldingsBars } from "@/components/dashboard/TopHoldingsBars";
import { ReturnVsMarket } from "@/components/dashboard/ReturnVsMarket";
import { FindingsList } from "@/components/dashboard/FindingsList";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { useRiskData } from "@/services/riskApi";
import { SectionHeading } from "@/components/SectionHeading";
import { JumpLinks } from "@/components/JumpLinks";
import { toast } from "@/hooks/use-toast";

const Section = ({ id, question, hint, children }: { id: string; question: string; hint?: string; children: ReactNode }) => (
  <section id={id} className="space-y-3">
    <SectionHeading title={question} hint={hint} route="/" section={id} />
    {children}
  </section>
);

const Index = () => {
  const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();

  const { holdings, summary, sectorData, topPerformers, worstPerformers, isLoading, error, lastUpdated, refetch, isDbConnected, isEmpty, dividendFiscalYear, setDividendFiscalYear } =
    usePortfolioAnalytics();

  const risk = useRiskData();
  const riskData = risk.data?.risk;
  const initialLoad = isLoading && holdings.length === 0;

  const handleRefresh = async () => {
    await refetch();
    risk.refetch();
    toast({
      title: "Data refreshed",
      description: lastUpdated ? `Portfolio data updated at ${lastUpdated.toLocaleTimeString()}` : "Portfolio data has been updated.",
    });
  };

  const handlePortfolioImported = async () => {
    await refetch();
    risk.refetch();
    toast({ title: "Portfolio imported", description: "Your holdings are loaded." });
  };

  useEffect(() => {
    if (error) {
      toast({ title: "Live data notice", description: error, variant: "default" });
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={handleRefresh} isRefreshing={isLoading} />

      {isEmpty ? (
        <main className="container px-4 py-16">
          <div className="mx-auto max-w-xl space-y-6 text-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Load your portfolio</h2>
              <p className="mt-2 text-muted-foreground">
                Import your holdings once and every chart and summary fills in. Nothing is entered by hand.
              </p>
            </div>
            <PortfolioImportZone onImported={handlePortfolioImported} />
          </div>
        </main>
      ) : (
        <main className="container space-y-8 px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {isDbConnected ? "Portfolio from your local database" : "Demo portfolio"}. Live prices via the NEPSE server.
            </span>
            {lastUpdated && (
              <span className="flex items-center gap-1">
                {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          <JumpLinks />

          <MarketContextDisplay compact />

          {/* 1. How am I doing? */}
          <Section id="summary" question="How am I doing?">
            <PortfolioSummaryCards summary={summary} loading={initialLoad} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <PortfolioValueTrendChart summary={summary} ready={!isLoading} />
              </div>
              <div className="lg:col-span-2">
                <ReturnVsMarket performance={riskData?.performance} loading={risk.isLoading} />
              </div>
            </div>
          </Section>

          {/* 2. What do I own? */}
          <Section id="holdings-overview" question="What do I own?">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectorAllocationChart data={sectorData} loading={initialLoad} />
              <TopHoldingsBars holdings={holdings} loading={initialLoad} />
            </div>
          </Section>

          {/* 3. What should I look at? */}
          <Section
            id="attention"
            question="What should I look at?"
            hint="Most important first. These are observations from your numbers, not instructions."
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {risk.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : risk.isError ? (
                  <div className="surface flex items-start gap-2 p-4 text-sm text-muted-foreground">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>Risk analysis is not available. Make sure the portfolio server is running, then press Refresh.</span>
                  </div>
                ) : (
                  <FindingsList findings={riskData?.findings ?? []} limit={5} />
                )}
                <Link to="/risk" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Full risk analysis <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <PortfolioHealthScore holdings={holdings} />
            </div>
          </Section>

          {/* Drill-down */}
          <Section id="details" question="Details" hint="Tables and per-stock views.">
            <div className="space-y-4">
              <section id="holdings" className="space-y-2">
                <SectionHeading title="Holdings" route="/" section="holdings" />
                <HoldingsTable holdings={holdings} dividendFiscalYear={dividendFiscalYear} onDividendFiscalYearChange={setDividendFiscalYear} />
              </section>
              <section id="watchlist" className="space-y-2">
                <SectionHeading title="Watchlist" route="/" section="watchlist" />
                <WatchlistTable />
              </section>
              <PerformanceChart holdings={holdings} />
              <TopPerformers topPerformers={topPerformers} worstPerformers={worstPerformers} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <section className="space-y-2 lg:col-span-2" id="news">
                  <SectionHeading title="News" route="/" section="news" />
                  <PortfolioNewsFeed holdings={holdings} />
                </section>
                <DividendSummaryCard holdings={holdings} />
              </div>
              <section id="ai">
                <AIRecommendations holdings={holdings} summary={summary} apiKey={apiKey} />
              </section>
            </div>
          </Section>

          <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
        </main>
      )}

      <AIChatbot holdings={holdings} summary={summary} />
    </div>
  );
};

export default Index;
