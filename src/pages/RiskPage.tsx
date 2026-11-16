import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChartNoAxesCombined, TriangleAlert } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AIChatbot } from "@/components/AIChatbot";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { useViewMode } from "@/hooks/useViewMode";
import { useRiskData } from "@/services/riskApi";
import { fmtFrac } from "@/components/charts";
import { fmtDate } from "@/i18n/format";
import { useT } from "@/i18n";
import { Explain } from "@/components/Explain";
import { FindingsList } from "@/components/dashboard/FindingsList";
import { RiskHeadline } from "@/components/risk/RiskHeadline";
import { RiskSummary } from "@/components/risk/RiskSummary";
import { MoneyVsRisk } from "@/components/risk/MoneyVsRisk";
import { GrowthOf100 } from "@/components/risk/GrowthOf100";
import { RiskReturnScatter } from "@/components/risk/RiskReturnScatter";
import { CorrelationHeatmap } from "@/components/risk/CorrelationHeatmap";
import { HoldingsRiskTable } from "@/components/risk/HoldingsRiskTable";
import { ValuationPeers } from "@/components/risk/ValuationPeers";
import { sectorLabel } from "@/lib/findingText";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";

/** Sections shown only in the advanced view (a finding's link can still open one in the simple view). */
const ADVANCED_SECTIONS = ["growth", "scatter", "correlation", "holdings-risk", "valuation"] as const;
type AdvancedSection = (typeof ADVANCED_SECTIONS)[number];

const RiskPage = () => {
  const { t } = useT();
  const { isSimple, setMode } = useViewMode();
  const { apiKey, setApiKey } = useApiKey();
  const { holdings, summary, isLoading: portfolioLoading, refetch } = usePortfolioAnalytics();
  const q = useRiskData();
  const risk = q.data?.risk;
  const location = useLocation();
  const hash = location.hash.slice(1);

  // Jump to a section when arriving from a link such as /risk#correlation, once the data is drawn.
  useEffect(() => {
    if (!hash || !risk) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ block: "start" });
  }, [hash, risk, isSimple]);

  const handleRefresh = async () => {
    await refetch();
    q.refetch();
  };

  const showFull = () => {
    setMode("advanced");
    window.scrollTo({ top: 0 });
  };

  const renderSection = (id: AdvancedSection) => {
    switch (id) {
      case "growth":
        return <GrowthOf100 risk={risk} loading={q.isLoading} />;
      case "scatter":
        return <RiskReturnScatter risk={risk} loading={q.isLoading} />;
      case "correlation":
        return <CorrelationHeatmap risk={risk} loading={q.isLoading} />;
      case "holdings-risk":
        return <HoldingsRiskTable holdings={risk?.holdings} loading={q.isLoading} />;
      case "valuation":
        return <ValuationPeers warnings={q.data?.valuationWarnings} loading={q.isLoading} />;
    }
  };

  // In the simple view, a finding's "See the detail" link may point at an advanced-only section: show just that one.
  const requested = (ADVANCED_SECTIONS as readonly string[]).includes(hash) ? (hash as AdvancedSection) : null;

  const findings = risk?.findings ?? [];

  const findingsSection = risk && (
    <section id="findings" className="scroll-mt-20 space-y-2">
      <h2 className="text-base font-semibold">{isSimple ? t("risk.findingsSimple") : t("risk.findingsTitle")}</h2>
      <FindingsList findings={findings} limit={isSimple ? findings.length : 8} />
    </section>
  );

  const coverageSection = risk && (
    <section id="coverage" className="surface scroll-mt-20 space-y-2 p-4 text-sm leading-relaxed">
      <h2 className="flex items-center gap-1.5 text-base font-semibold">
        {t("risk.aboutTitle")} <Explain term="proxied" />
      </h2>
      <p className="text-muted-foreground">{t("risk.disclaimer")}</p>
      <p className="text-muted-foreground">{t("risk.basedOn", { weeks: risk.lookbackWeeks, date: fmtDate(risk.asOf) })}</p>
      <p className="text-muted-foreground">
        {t("risk.measuredShare", { pct: fmtFrac(risk.coverage.measuredWeight, 0) })}
        {risk.coverage.proxied.length > 0 && (
          <>
            {" "}
            {t("risk.proxiedList", {
              list: risk.coverage.proxied
                .map((p) => {
                  const m = p.method.match(/^(.*) sector average$/);
                  const method = m ? t("risk.methodSector", { sector: sectorLabel(m[1]) }) : t("risk.methodMarket");
                  return `${p.symbol} (${method})`;
                })
                .join(", "),
            })}
          </>
        )}
      </p>
    </section>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={handleRefresh} isRefreshing={portfolioLoading || q.isFetching} />

      <main className="container space-y-6 px-4 py-6">
        <SectionHeading as="h1" title={t("risk.title")} route="/risk" hint={t("risk.hint")} />

        {q.isError && (
          <div className="surface flex items-start gap-2 p-4 text-sm" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-medium">{t("risk.errTitle")}</p>
              <p className="leading-relaxed text-muted-foreground">
                {(q.error as Error)?.message}. {t("risk.errHelp")}
              </p>
              <Button size="sm" variant="outline" className="mt-2 h-10 sm:h-9" onClick={() => q.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {!q.isError && !q.isLoading && !risk && (
          <div className="surface p-4 text-sm leading-relaxed text-muted-foreground">{t("risk.noData")}</div>
        )}

        {isSimple ? (
          <>
            <RiskSummary risk={risk} loading={q.isLoading} />

            {findingsSection}

            {requested && (
              <div id={requested} className="scroll-mt-20">
                {renderSection(requested)}
              </div>
            )}

            {(risk || q.isLoading) && (
              <section className="space-y-2">
                <h2 className="text-base font-semibold">{t("risk.whereTitle")}</h2>
                <div id="money-vs-risk" className="scroll-mt-20">
                  <MoneyVsRisk risk={risk} loading={q.isLoading} />
                </div>
              </section>
            )}

            {coverageSection}

            {risk && (
              <div className="flex justify-center">
                <Button variant="outline" className="h-11 gap-2" onClick={showFull}>
                  <ChartNoAxesCombined className="h-4 w-4" aria-hidden="true" />
                  {t("risk.showFull")}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <RiskHeadline risk={risk} loading={q.isLoading} />

            {risk && findings.length > 0 && findingsSection}

            <div id="money-vs-risk" className="scroll-mt-20">
              <MoneyVsRisk risk={risk} loading={q.isLoading} />
            </div>
            {ADVANCED_SECTIONS.map((id) => (
              <div key={id} id={id} className="scroll-mt-20">
                {renderSection(id)}
              </div>
            ))}

            {coverageSection}
          </>
        )}

        <Footer apiKey={apiKey} onApiKeyChange={setApiKey} />
      </main>

      <AIChatbot holdings={holdings} summary={summary} />
    </div>
  );
};

export default RiskPage;
