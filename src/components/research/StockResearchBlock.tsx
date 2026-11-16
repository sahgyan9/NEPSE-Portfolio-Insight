import { useMemo, useState } from "react";
import { ChevronDown, ClipboardCheck } from "lucide-react";
import { SectorResearchPanel } from "./SectorResearchPanel";
import { evaluateResearchChecks, isAutoTicked } from "@/lib/researchAutoChecks";
import type { QuarterRecord } from "@/types/quarterly";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

interface Props {
  symbol: string;
  sector?: string | null;
  /** Stored quarters for this stock, oldest first. When given, items the data can answer are ticked automatically. */
  quarters?: QuarterRecord[];
  /** Start expanded (used on pages that are already about one stock) */
  defaultOpen?: boolean;
  narrow?: boolean;
  className?: string;
}

/** Collapsible "Research before you buy" block for one stock, using the sector checklist. */
export const StockResearchBlock = ({ symbol, sector, quarters, defaultOpen = false, narrow, className }: Props) => {
  const { t } = useT();
  const [open, setOpen] = useState(defaultOpen);
  const auto = useMemo(
    () => (sector && quarters?.length ? evaluateResearchChecks(sector, quarters) : {}),
    [sector, quarters]
  );
  if (!sector) return null;

  const results = Object.values(auto);
  const filled = results.filter(isAutoTicked).length;
  const flagged = results.filter((r) => r.status === "flagged").length;
  const latest = quarters?.[quarters.length - 1];

  return (
    <div className={cn("rounded-md border border-border", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {t("research.stockTitle", { symbol })}
          {filled > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {t("research.filledFromData", { n: filled })}
              {flagged > 0 && <span className="text-warning">{t("research.needsLook", { n: flagged })}</span>}
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="border-t border-border p-3">
          <SectorResearchPanel
            subject={symbol.toUpperCase()}
            sector={sector}
            narrow={narrow}
            auto={auto}
            autoSource={latest?.quarter_label}
          />
        </div>
      )}
    </div>
  );
};
