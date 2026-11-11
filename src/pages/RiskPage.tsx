import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AIChatbot } from "@/components/AIChatbot";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { useRiskData } from "@/services/riskApi";
import { fmtDateLong, fmtFrac } from "@/components/charts";
import { Explain } from "@/components/Explain";
import { FindingsList } from "@/components/dashboard/FindingsList";
import { RiskHeadline } from "@/components/risk/RiskHeadline";
import { MoneyVsRisk } from "@/components/risk/MoneyVsRisk";
import { GrowthOf100 } from "@/components/risk/GrowthOf100";
import { RiskReturnScatter } from "@/components/risk/RiskReturnScatter";
import { CorrelationHeatmap } from "@/components/risk/CorrelationHeatmap";
import { HoldingsRiskTable } from "@/components/risk/HoldingsRiskTable";
import { ValuationPeers } from "@/components/risk/ValuationPeers";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";

const RiskPage = () => {
  const { apiKey, setApiKey } = useApiKey();
  const { holdings, summary, isLoading: portfolioLoading, refetch } = usePortfolioAnalytics();
  const q = useRiskData();
  const risk = q.data?.risk;
  const location = useLocation();

  // Jump to a section when arriving from a link such as /risk#correlation, once the data is drawn.
  useEffect(() => {
    if (!location.hash || !risk) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ block: "start" });
  }, [location.hash, risk]);

  const handleRefresh = async () => {
    await refetch();
    q.refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={handleRefresh} isRefreshing={portfolioLoading || q.isFetching} />

      <main className="container space-y-6 px-4 py-6">
        <SectionHeading as="h1" title="Risk" route="/risk" hint="How much your portfolio swings, where that risk comes from, and whether it is spread out." />

        {q.isError && (
          <div className="surface flex items-start gap-2 p-4 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium">Risk data is not available.</p>
              <p className="text-muted-foreground">{(q.error as Error)?.message}. Start the portfolio server, then try again.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => q.refetch()}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {!q.isError && !q.isLoading && !risk && (
          <div className="surface p-4 text-sm text-muted-foreground">
            The server returned no risk figures. Re-run the optimisation tool to regenerate them.
          </div>
        )}

        <RiskHeadline risk={risk} loading={q.isLoading} />

        {risk && risk.findings.length > 0 && (
          <section id="findings" className="space-y-2 scroll-mt-20">
            <h2 className="text-base font-semibold">What stands out</h2>
            <FindingsList findings={risk.findings} limit={8} />
          </section>
        )}

        <div id="money-vs-risk" className="scroll-mt-20">
          <MoneyVsRisk risk={risk} loading={q.isLoading} />
        </div>
        <div id="growth" className="scroll-mt-20">
          <GrowthOf100 risk={risk} loading={q.isLoading} />
        </div>
        <div id="scatter" className="scroll-mt-20">
          <RiskReturnScatter risk={risk} loading={q.isLoading} />
        </div>
        <div id="correlation" className="scroll-mt-20">
          <CorrelationHeatmap risk={risk} loading={q.isLoading} />
        </div>
        <div id="holdings-risk" className="scroll-mt-20">
          <HoldingsRiskTable holdings={risk?.holdings} loading={q.isLoading} />
        </div>
        <div id="valuation" className="scroll-mt-20">
          <ValuationPeers warnings={q.data?.valuationWarnings} loading={q.isLoading} />
        </div>

        {risk && (
          <section id="coverage" className="surface scroll-mt-20 space-y-2 p-4 text-sm">
            <h2 className="flex items-center gap-1.5 text-base font-semibold">
              About these numbers <Explain term="proxied" />
            </h2>
            <p className="text-muted-foreground">{risk.disclaimer}</p>
            <p className="text-muted-foreground">
              Based on {risk.lookbackWeeks} weeks of prices up to {fmtDateLong(risk.asOf)}.
            </p>
            <p className="text-muted-foreground">
              Risk was measured directly for {fmtFrac(risk.coverage.measuredWeight, 0)} of your money.
              {risk.coverage.proxied.length > 0 && (
                <>
                  {" "}
                  The rest is estimated because the holding has too little price history:{" "}
                  {risk.coverage.proxied.map((p) => `${p.symbol} (from ${p.method})`).join(", ")}.
                </>
              )}
            </p>
          </section>
        )}

        <Footer apiKey={apiKey} onApiKeyChange={setApiKey} />
      </main>

      <AIChatbot holdings={holdings} summary={summary} />
    </div>
  );
};

export default RiskPage;
