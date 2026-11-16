import { MapPin } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { RESEARCH_STEPS, type ResearchStep } from "@/data/researchGuide";
import { useT } from "@/i18n";
import { SourceLinks } from "./SourceLinks";
import { cn } from "@/lib/utils";

const AVAILABILITY: Record<ResearchStep["availability"], string> = {
  good: "border-success/40 bg-success/10 text-success",
  partial: "border-warning/40 bg-warning/10 text-warning",
  rare: "border-border bg-muted text-muted-foreground",
};

/** One-line "where to find this" hint. */
export const WhereHint = ({ text, className }: { text: string; className?: string }) => {
  const { t } = useT();
  return (
    <p className={cn("flex items-start gap-1.5 text-sm leading-relaxed text-muted-foreground", className)}>
      <MapPin className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground">{t("research.whereLabel")}: </span>
        {text}
      </span>
    </p>
  );
};

/** The six steps as an ordered, expandable list. Each step is one yes/no question. */
export const ResearchSteps = () => {
  const { t } = useT();
  return (
    <Accordion type="multiple" className="surface divide-y divide-border px-4">
      {RESEARCH_STEPS.map((step, i) => {
        const avLabel = t(`research.av_${step.availability}`);
        return (
          <AccordionItem key={step.id} value={step.id} className="border-0">
            <AccordionTrigger className="min-h-[44px] gap-3 py-4 text-left hover:no-underline">
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-normal text-muted-foreground">{step.title}</span>
                  <span className="block text-sm font-semibold leading-relaxed sm:text-base">{step.question}</span>
                </span>
              </span>
              <Badge variant="outline" className={cn("hidden shrink-0 font-normal sm:inline-flex", AVAILABILITY[step.availability])}>
                {avLabel}
              </Badge>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-5 sm:pl-9">
              <Badge variant="outline" className={cn("font-normal sm:hidden", AVAILABILITY[step.availability])}>
                {avLabel}
              </Badge>
              <WhereHint text={step.where} />
              <p className="text-sm leading-relaxed text-muted-foreground">{t("research.inNepal", { text: step.nepalEquivalent })}</p>
              <div>
                <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t("research.whyTitle")}</h4>
                <p className="text-sm leading-relaxed">{step.why}</p>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t("research.lookForTitle")}</h4>
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                  {step.lookFor.map((q, k) => (
                    <li key={k}>{q}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t("research.sourcesTitle")}</h4>
                <SourceLinks sources={step.sources} />
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};
