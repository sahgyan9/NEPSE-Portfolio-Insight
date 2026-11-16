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
import { PortfolioHealthScore } from "@/components/PortfolioHealthScore";
import { SectorAllocationChart } from "@/components/SectorAllocationChart";
import { TopHoldingsBars } from "@/components/dashboard/TopHoldingsBars";
import { ReturnVsMarket } from "@/components/dashboard/ReturnVsMarket";
import { FindingsList } from "@/components/dashboard/FindingsList";
import { SimpleHome } from "@/components/simple/SimpleHome";
import { DatabaseDownState, NoPortfolioState } from "@/components/simple/HomeStates";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { useViewMode } from "@/hooks/useViewMode";
import { useRiskData } from "@/services/riskApi";
import { SectionHeading } from "@/components/SectionHeading";
import { JumpLinks } from "@/components/JumpLinks";
import { toast } from "@/hooks/use-toast";
import { useT } from "@/i18n";

const timeOf = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const Section = ({ id, question, hint, children }: { id: string; question: string; hint?: string; children: ReactNode }) => (
  <section id={id} className="space-y-3">
    <SectionHeading title={question} hint={hint} route="/" section={id} />
    {children}
  </section>
);

const Index = () => {
  const { t } = useT();
  const { isSimple } = useViewMode();
  const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();

  const { holdings, summary, sectorData, topPerformers, worstPerformers, isLoading, error, lastUpdated, refetch, dbConnection, isEmpty, dividendFiscalYear, setDividendFiscalYear } =
    usePortfolioAnalytics();

  const risk = useRiskData();
  const riskData = risk.data?.risk;
  const initialLoad = isLoading && holdings.length === 0;
  // Database could not be reached and there is nothing real to show yet
  const dbDown = dbConnection === "unreachable" && holdings.length === 0;

  const handleRefresh = async () => {
    await refetch();
    risk.refetch();
    toast({
      title: t("home.refreshedTitle"),
      description: lastUpdated ? t("home.refreshedAt", { time: timeOf(lastUpdated) }) : t("home.refreshedBody"),
    });
  };

  const handlePortfolioImported = async () => {
    await refetch();
    risk.refetch();
    toast({ title: t("home.importedTitle"), description: t("home.importedBody") });
  };

  useEffect(() => {
    // The hook's message is technical English; show a plain translated notice instead.
    if (error) {
      toast({ title: t("home.priceNoticeTitle"), description: t("home.priceNoticeBody"), variant: "default" });
    }
  }, [error, t]);

  const connectionLine = (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-relaxed text-muted-foreground">
      {dbConnection === "connecting" ? (
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t("home.statusConnecting")}
        </span>
      ) : dbConnection === "unreachable" ? (
        <span className="flex items-center gap-1.5 text-warning">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("home.statusUnreachable")}
        </span>
      ) : (
        <span>{t("home.statusOk")}</span>
      )}
      {lastUpdated && (
        <span className="flex items-center gap-1">
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          {t("common.updated", { time: timeOf(lastUpdated) })}
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={handleRefresh} isRefreshing={isLoading} />

      {dbDown ? (
        <main className="container px-4 py-10 sm:py-16">
          <DatabaseDownState onRetry={() => refetch()} retrying={isLoading} />
        </main>
      ) : isEmpty ? (
        <main className="container px-4 py-10 sm:py-16">
          <NoPortfolioState onImported={handlePortfolioImported} />
        </main>
      ) : isSimple ? (
        <main className="container space-y-6 px-4 py-6">
          <div className="mx-auto w-full max-w-[640px]">{connectionLine}</div>
          <SimpleHome
            holdings={holdings}
            summary={summary}
            loading={initialLoad}
            risk={{ data: riskData, isLoading: risk.isLoading, isError: risk.isError }}
          />
          <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
        </main>
      ) : (
        <main className="container space-y-8 px-4 py-6">
          {connectionLine}

          <JumpLinks />

          <MarketContextDisplay compact />

          {/* 1. How am I doing? */}
          <Section id="summary" question={t("home.qSummary")}>
            <PortfolioSummaryCards summary={summary} loading={initialLoad} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="min-w-0 lg:col-span-3">
                <PortfolioValueTrendChart summary={summary} ready={!isLoading} />
              </div>
              <div className="min-w-0 lg:col-span-2">
                <ReturnVsMarket performance={riskData?.performance} loading={risk.isLoading} />
              </div>
            </div>
          </Section>

          {/* 2. What do I own? */}
          <Section id="holdings-overview" question={t("home.qHoldings")}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectorAllocationChart data={sectorData} loading={initialLoad} />
              <TopHoldingsBars holdings={holdings} loading={initialLoad} />
            </div>
          </Section>

          {/* 3. What should I look at? */}
          <Section id="attention" question={t("home.qAttention")} hint={t("home.hintAttention")}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="min-w-0 space-y-3">
                {risk.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : risk.isError ? (
                  <div className="surface flex items-start gap-2 p-4 text-sm leading-relaxed text-muted-foreground">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    <span>{t("home.riskUnavailable")}</span>
                  </div>
                ) : (
                  <FindingsList findings={riskData?.findings ?? []} limit={5} />
                )}
                <Link to="/risk" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary hover:underline">
                  {t("home.fullRisk")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              <PortfolioHealthScore holdings={holdings} />
            </div>
          </Section>

          {/* Drill-down */}
          <Section id="details" question={t("home.qDetails")} hint={t("home.hintDetails")}>
            <div className="space-y-4">
              <section id="holdings" className="space-y-2">
                <SectionHeading title={t("home.holdingsTitle")} route="/" section="holdings" />
                <HoldingsTable holdings={holdings} dividendFiscalYear={dividendFiscalYear} onDividendFiscalYearChange={setDividendFiscalYear} />
              </section>
              <section id="watchlist" className="space-y-2">
                <SectionHeading title={t("home.watchlistTitle")} route="/" section="watchlist" />
                <WatchlistTable />
              </section>
              <PerformanceChart holdings={holdings} />
              <TopPerformers topPerformers={topPerformers} worstPerformers={worstPerformers} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <section className="min-w-0 space-y-2 lg:col-span-2" id="news">
                  <SectionHeading title={t("home.newsTitle")} route="/" section="news" />
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
