import { useState } from "react";
import { ChevronDown, ClipboardCheck } from "lucide-react";
import { SectorResearchPanel } from "./SectorResearchPanel";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  sector?: string | null;
  /** Start expanded (used on pages that are already about one stock) */
  defaultOpen?: boolean;
  narrow?: boolean;
  className?: string;
}

/** Collapsible "Research before you buy" block for one stock, using the sector checklist. */
export const StockResearchBlock = ({ symbol, sector, defaultOpen = false, narrow, className }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  if (!sector) return null;
  return (
    <div className={cn("rounded-md border border-border", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          Research checklist for {symbol}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border p-3">
          <SectorResearchPanel subject={symbol.toUpperCase()} sector={sector} narrow={narrow} />
        </div>
      )}
    </div>
  );
};
