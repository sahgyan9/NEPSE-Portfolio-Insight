import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { RESEARCH_STEPS, type ResearchStep } from "@/data/researchGuide";
import { SourceLinks } from "./SourceLinks";
import { cn } from "@/lib/utils";

const AVAILABILITY: Record<ResearchStep["availability"], { label: string; cls: string }> = {
  good: { label: "Usually available", cls: "border-success/40 bg-success/10 text-success" },
  partial: { label: "Sometimes available", cls: "border-warning/40 bg-warning/10 text-warning" },
  rare: { label: "Rarely available", cls: "border-border bg-muted text-muted-foreground" },
};

/** The six steps as an ordered, expandable list. */
export const ResearchSteps = () => (
  <Accordion type="multiple" className="surface divide-y divide-border px-4">
    {RESEARCH_STEPS.map((step, i) => {
      const av = AVAILABILITY[step.availability];
      return (
        <AccordionItem key={step.id} value={step.id} className="border-0">
          <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline">
            <span className="flex min-w-0 flex-1 items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold sm:text-base">{step.title}</span>
                <span className="block text-sm font-normal text-muted-foreground">In Nepal: {step.nepalEquivalent}</span>
              </span>
            </span>
            <Badge variant="outline" className={cn("hidden shrink-0 font-normal sm:inline-flex", av.cls)}>
              {av.label}
            </Badge>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-5 pl-9">
            <Badge variant="outline" className={cn("font-normal sm:hidden", av.cls)}>
              {av.label}
            </Badge>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why it matters</h4>
              <p className="text-sm leading-relaxed">{step.why}</p>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to look for</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {step.lookFor.map((t, k) => (
                  <li key={k}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Where to find it</h4>
              <SourceLinks sources={step.sources} />
            </div>
          </AccordionContent>
        </AccordionItem>
      );
    })}
  </Accordion>
);
