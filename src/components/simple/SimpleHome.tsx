import { Link } from "react-router-dom";
import { ArrowRight, ChartColumn, TriangleAlert } from "lucide-react";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FindingsList } from "@/components/dashboard/FindingsList";
import { NewsEventsCard } from "@/components/news/NewsEventsCard";
import type { StockHolding } from "@/data/portfolioData";
import type { LivePortfolioSummary } from "@/types";
import type { RiskData } from "@/services/riskApi";
import { useViewMode } from "@/hooks/useViewMode";
import { PlainSummary } from "./PlainSummary";
import { HoldingCards } from "./HoldingCards";

interface Props {
  holdings: StockHolding[];
  summary: LivePortfolioSummary;
  loading: boolean;
  risk: { data?: RiskData; isLoading: boolean; isError: boolean };
}

const Block = ({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) => (
  <section id={id} className="space-y-3" aria-labelledby={`${id}-title`}>
    <div>
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </section>
);

/** Plain-language home for new investors: one column, phone first. */
export const SimpleHome = ({ holdings, summary, loading, risk }: Props) => {
  const { t } = useT();
  const { setMode } = useViewMode();

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-8 leading-relaxed">
      <Block id="summary" title={t("simple.howTitle")}>
        <PlainSummary summary={summary} performance={risk.data?.performance} loading={loading} />
      </Block>

      <Block id="attention" title={t("simple.attentionTitle")} hint={t("simple.attentionHint")}>
        {risk.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : risk.isError ? (
          <div className="surface flex items-start gap-2 p-4 text-sm leading-relaxed text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>{t("home.riskUnavailable")}</span>
          </div>
        ) : (
          <FindingsList findings={risk.data?.findings ?? []} limit={3} />
        )}
        <Link
          to="/risk"
          className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("simple.attentionLink")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Block>

      <Block id="events" title={t("simple.eventsTitle")}>
        <NewsEventsCard symbols={holdings.map((h) => h.scrip)} limit={5} />
      </Block>

      <Block id="shares" title={t("simple.sharesTitle")} hint={t("simple.sharesHint")}>
        <HoldingCards holdings={holdings} loading={loading} />
      </Block>

      <div className="space-y-4 border-t border-border pt-6">
        <Button variant="outline" className="h-12 w-full text-base" onClick={() => setMode("advanced")}>
          <ChartColumn className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("simple.showAll")}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">{t("common.notAdvice")}</p>
      </div>
    </div>
  );
};
