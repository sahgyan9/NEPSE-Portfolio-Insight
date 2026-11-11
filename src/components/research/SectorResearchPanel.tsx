import { Checkbox } from "@/components/ui/checkbox";
import { getSectorResearch } from "@/data/researchGuide";
import { useResearchTicks } from "@/hooks/useResearchTicks";
import { SourceLinks } from "./SourceLinks";
import { cn } from "@/lib/utils";

interface Props {
  /** Ticks are saved per subject: a stock symbol, or "sector:Name" on the research page */
  subject: string;
  sector: string;
  className?: string;
  /** Single column for narrow containers such as cards and dialogs */
  narrow?: boolean;
}

const Group = ({
  title,
  prefix,
  items,
  tone,
  isTicked,
  toggle,
  subject,
}: {
  title: string;
  prefix: string;
  items: string[];
  tone?: "warn";
  isTicked: (id: string) => boolean;
  toggle: (id: string) => void;
  subject: string;
}) => (
  <div>
    <h5 className={cn("mb-1.5 text-xs font-semibold uppercase tracking-wide", tone === "warn" ? "text-warning" : "text-muted-foreground")}>{title}</h5>
    <ul className="space-y-1.5">
      {items.map((text, i) => {
        const id = `${prefix}:${i}`;
        const domId = `${subject}-${id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
        const done = isTicked(id);
        return (
          <li key={id} className="flex items-start gap-2">
            <Checkbox id={domId} checked={done} onCheckedChange={() => toggle(id)} className="mt-0.5" />
            <label htmlFor={domId} className={cn("cursor-pointer text-sm leading-snug", done && "text-muted-foreground line-through")}>
              {text}
            </label>
          </li>
        );
      })}
    </ul>
  </div>
);

/** What to read and check for a stock in this sector, with ticks saved on this device. */
export const SectorResearchPanel = ({ subject, sector, className, narrow }: Props) => {
  const info = getSectorResearch(sector);
  const { isTicked, toggle, ticked } = useResearchTicks(subject);
  if (!info) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No sector-specific checklist for "{sector}" yet. The general steps on the Research page still apply.
      </p>
    );
  }
  const total = info.keyNumbers.length + info.questions.length + info.redFlags.length;
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {info.sector}. Regulator: <span className="text-foreground">{info.regulator}</span>
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {ticked.length} of {total} checked
        </p>
      </div>
      <div className={cn("grid grid-cols-1 gap-5", !narrow && "md:grid-cols-3")}>
        <Group title="Key numbers to find" prefix="kn" items={info.keyNumbers} isTicked={isTicked} toggle={toggle} subject={subject} />
        <Group title="Questions to ask" prefix="q" items={info.questions} isTicked={isTicked} toggle={toggle} subject={subject} />
        <Group title="Red flags to look for" prefix="rf" items={info.redFlags} tone="warn" isTicked={isTicked} toggle={toggle} subject={subject} />
      </div>
      <div>
        <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Where to look</h5>
        <SourceLinks sources={info.sources} />
      </div>
      <p className="text-xs text-muted-foreground">Ticks are saved in this browser only.</p>
    </div>
  );
};
