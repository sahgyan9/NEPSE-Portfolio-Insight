import { useState } from "react";
import { Header } from "@/components/Header";
import { SectionHeading } from "@/components/SectionHeading";
import { Footer } from "@/components/Footer";
import { AIChatbot } from "@/components/AIChatbot";
import { ResearchSteps } from "@/components/research/ResearchSteps";
import { SectorResearchPanel } from "@/components/research/SectorResearchPanel";
import { EpsHoldingsTable } from "@/components/research/EpsHoldingsTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { SECTOR_RESEARCH } from "@/data/researchGuide";

const ResearchPage = () => {
  const { apiKey, setApiKey } = useApiKey();
  const { holdings, summary, isLoading, refetch } = usePortfolioAnalytics();
  const [sector, setSector] = useState<string>(SECTOR_RESEARCH[0]?.sector ?? "");

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={refetch} isRefreshing={isLoading} />

      <main className="container space-y-8 px-4 py-6">
        <div className="max-w-3xl">
          <SectionHeading as="h1" title="Research before you buy" route="/research" />
          <p className="mt-1 text-sm text-muted-foreground">
            The scores in this app summarise numbers. They cannot read a report or judge a management team. Work through these six steps for any company before putting money in. Each step names the Nepal source to use.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">The six steps</h2>
          <ResearchSteps />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Your holdings: earnings check</h2>
            <p className="text-sm text-muted-foreground">What each holding earns against the price you paid.</p>
          </div>
          <EpsHoldingsTable />
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">What to check for each sector</h2>
              <p className="text-sm text-muted-foreground">Different businesses need different numbers. Pick a sector.</p>
            </div>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger className="w-[220px]" aria-label="Sector">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                {SECTOR_RESEARCH.map((s) => (
                  <SelectItem key={s.sector} value={s.sector}>
                    {s.sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="surface p-4 sm:p-5">
            <SectorResearchPanel subject={`sector:${sector}`} sector={sector} />
          </div>
        </section>

        <Footer apiKey={apiKey} onApiKeyChange={setApiKey} />
      </main>

      <AIChatbot holdings={holdings} summary={summary} />
    </div>
  );
};

export default ResearchPage;
