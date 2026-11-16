import { QUICK_CHECKS, RESEARCH_STEPS } from "@/data/researchGuide";
import { useT } from "@/i18n";
import { WhereHint } from "./ResearchSteps";

/** "Before you buy: 5 questions": the most important look-for items of the six steps, for simple view. */
export const QuickChecks = () => {
  const { t } = useT();
  const items = QUICK_CHECKS.map(({ stepId, index }) => {
    const step = RESEARCH_STEPS.find((s) => s.id === stepId);
    return step ? { key: `${stepId}-${index}`, question: step.lookFor[index], where: step.where } : null;
  }).filter((x): x is { key: string; question: string; where: string } => !!x && !!x.question);

  return (
    <section aria-labelledby="quick-checks" className="space-y-2">
      <div>
        <h2 id="quick-checks" className="text-lg font-semibold">{t("research.quickTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("research.quickHint")}</p>
      </div>
      <ol className="surface divide-y divide-border">
        {items.map((item, i) => (
          <li key={item.key} className="flex items-start gap-3 p-4">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs" aria-hidden="true">
              {i + 1}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[15px] font-medium leading-relaxed">{item.question}</p>
              <WhereHint text={item.where} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
