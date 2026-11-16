import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { getSectorResearch } from "@/data/researchGuide";
import { useResearchTicks } from "@/hooks/useResearchTicks";
import { isAutoTicked, type AutoCheck } from "@/lib/researchAutoChecks";
import { SourceLinks } from "./SourceLinks";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { WhereHint } from "./ResearchSteps";

interface Props {
  /** Ticks are saved per subject: a stock symbol, or "sector:Name" on the research page */
  subject: string;
  sector: string;
  className?: string;
  /** Single column for narrow containers such as cards and dialogs */
  narrow?: boolean;
  /** Items answered from stored quarterly data, keyed by item id ("kn:0"). These are ticked and locked. */
  auto?: Record<string, AutoCheck>;
  /** Label of the quarter the auto results come from, e.g. "Q1 FY 2083/84" */
  autoSource?: string;
}

const Group = ({
  title,
  prefix,
  items,
  tone,
  isTicked,
  toggle,
  subject,
  auto,
}: {
  title: string;
  prefix: string;
  items: string[];
  tone?: "warn";
  isTicked: (id: string) => boolean;
  toggle: (id: string) => void;
  subject: string;
  auto?: Record<string, AutoCheck>;
}) => (
  <div>
    <h5 className={cn("mb-1.5 text-xs font-semibold", tone === "warn" ? "text-warning" : "text-muted-foreground")}>{title}</h5>
    <ul className="space-y-1">
      {items.map((text, i) => {
        const id = `${prefix}:${i}`;
        const domId = `${subject}-${id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
        const result = auto?.[id];
        const locked = isAutoTicked(result);
        const done = locked || isTicked(id);
        const flagged = result?.status === "flagged";
        const problem = flagged || result?.status === "suspect";
        return (
          <li key={id} className="flex items-start gap-2.5 py-1.5">
            <Checkbox
              id={domId}
              checked={done}
              disabled={locked}
              onCheckedChange={() => toggle(id)}
              className="mt-1 h-5 w-5"
              aria-describedby={result ? `${domId}-data` : undefined}
            />
            <div className="min-w-0">
              <label
                htmlFor={domId}
                className={cn(
                  "text-sm leading-relaxed",
                  !locked && "cursor-pointer",
                  done && !flagged && "text-muted-foreground",
                  done && !locked && "line-through"
                )}
              >
                {text}
              </label>
              {result && (
                <p
                  id={`${domId}-data`}
                  className={cn("mt-0.5 flex items-start gap-1 text-xs leading-snug", problem ? "text-warning" : "text-foreground")}
                >
                  {problem && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />}
                  <span>{result.detail}</span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);

/** What to read and check for a stock in this sector. Items the data can answer are filled in; the rest are manual ticks saved on this device. */
export const SectorResearchPanel = ({ subject, sector, className, narrow, auto, autoSource }: Props) => {
  const { t } = useT();
  const info = getSectorResearch(sector);
  const { isTicked, toggle, ticked } = useResearchTicks(subject);
  if (!info) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{t("research.noSector", { sector })}</p>;
  }
  const total = info.keyNumbers.length + info.questions.length + info.redFlags.length;
  const autoIds = Object.keys(auto ?? {}).filter((id) => isAutoTicked(auto?.[id]));
  const checked = new Set([...ticked, ...autoIds]).size;
  const groupProps = { isTicked, toggle, subject, auto };
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {info.label}. {t("research.regulator", { name: info.regulator })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("research.checkedCount", { checked, total })}
          {autoIds.length > 0 && t("research.fromData", { n: autoIds.length })}
        </p>
      </div>
      <WhereHint text={info.where} />
      <div className={cn("grid grid-cols-1 gap-5", !narrow && "md:grid-cols-3")}>
        <Group title={t("research.group_kn")} prefix="kn" items={info.keyNumbers} {...groupProps} />
        <Group title={t("research.group_q")} prefix="q" items={info.questions} {...groupProps} />
        <Group title={t("research.group_rf")} prefix="rf" items={info.redFlags} tone="warn" {...groupProps} />
      </div>
      <div>
        <h5 className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("research.whereToLook")}</h5>
        <SourceLinks sources={info.sources} />
      </div>
      <p className="text-xs text-muted-foreground">
        {autoIds.length > 0
          ? t("research.ticksAuto", { source: autoSource ?? t("research.ticksLatest") })
          : t("research.ticksLocal")}
      </p>
    </div>
  );
};
