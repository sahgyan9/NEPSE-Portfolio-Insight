import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Header } from "@/components/Header";
import { SectionHeading } from "@/components/SectionHeading";
import { Footer } from "@/components/Footer";
import { AIChatbot } from "@/components/AIChatbot";
import { ResearchSteps } from "@/components/research/ResearchSteps";
import { QuickChecks } from "@/components/research/QuickChecks";
import { SectorResearchPanel } from "@/components/research/SectorResearchPanel";
import { EpsHoldingsTable } from "@/components/research/EpsHoldingsTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { useViewMode } from "@/hooks/useViewMode";
import { SECTOR_RESEARCH } from "@/data/researchGuide";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

const ResearchPage = () => {
  const { t } = useT();
  const { isSimple } = useViewMode();
  const { apiKey, setApiKey } = useApiKey();
  const { holdings, summary, isLoading, refetch } = usePortfolioAnalytics();
  const [sector, setSector] = useState<string>(SECTOR_RESEARCH[0]?.sector ?? "");
  const [showFull, setShowFull] = useState(false);

  const steps = (
    <section className="space-y-3" aria-labelledby="research-steps">
      <div>
        <h2 id="research-steps" className="text-lg font-semibold">{t("research.stepsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("research.stepsHint")}</p>
      </div>
      <ResearchSteps />
    </section>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={refetch} isRefreshing={isLoading} />

      <main className="container space-y-8 px-4 py-6">
        <div className="max-w-3xl">
          <SectionHeading as="h1" title={t("research.pageTitle")} route="/research" />
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("research.intro")}</p>
        </div>

        {isSimple ? (
          <>
            <QuickChecks />
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowFull((v) => !v)}
                aria-expanded={showFull}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-left text-sm font-medium"
              >
                {showFull ? t("research.fullHide") : t("research.fullShow")}
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground", showFull && "rotate-180")} aria-hidden="true" />
              </button>
              {showFull && steps}
            </div>
          </>
        ) : (
          steps
        )}

        <section className="space-y-3" aria-labelledby="research-eps">
          <div>
            <h2 id="research-eps" className="text-lg font-semibold">{t("research.epsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("research.epsHint")}</p>
          </div>
          <EpsHoldingsTable />
        </section>

        <section className="space-y-3" aria-labelledby="research-sector">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="research-sector" className="text-lg font-semibold">{t("research.sectorTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("research.sectorHint")}</p>
            </div>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger className="h-11 w-full sm:w-[240px]" aria-label={t("research.sectorLabel")}>
                <SelectValue placeholder={t("research.sectorLabel")} />
              </SelectTrigger>
              <SelectContent>
                {SECTOR_RESEARCH.map((s) => (
                  <SelectItem key={s.sector} value={s.sector}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="surface p-4 sm:p-5">
            <SectorResearchPanel subject={`sector:${sector}`} sector={sector} />
          </div>
        </section>

        <p className="text-xs leading-relaxed text-muted-foreground">{t("research.notAdvice")}</p>

        <Footer apiKey={apiKey} onApiKeyChange={setApiKey} />
      </main>

      <AIChatbot holdings={holdings} summary={summary} />
    </div>
  );
};

export default ResearchPage;
