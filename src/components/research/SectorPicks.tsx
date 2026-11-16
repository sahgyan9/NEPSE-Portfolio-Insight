import { useMemo, useState } from "react";
import { ChevronDown, ListOrdered } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Explain } from "@/components/Explain";
import { useMySymbols, useSectorScreen } from "@/services/sectorScreenApi";
import type { SymbolListItem } from "@/types/quarterly";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { sectorLabel } from "@/data/researchGuide";

const OPEN_KEY = "pi_sector_picks_open";

interface Props {
  /** Stocks with stored quarterly data; used to find the sector of each holding */
  stocks: SymbolListItem[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  className?: string;
}

/**
 * Top-ranked companies in each sector from the quality screen, with the user's own
 * sectors first and their holdings marked. A research shortlist, not a buy list.
 */
export const SectorPicks = ({ stocks, selectedSymbol, onSelect, className }: Props) => {
  const { t } = useT();
  const { data: screen, isLoading, isError } = useSectorScreen();
  const { data: mine } = useMySymbols();
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleOpen = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {
        // Storage blocked: the choice lasts for this visit only.
      }
      return !o;
    });

  const heldBySector = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!mine) return out;
    for (const s of stocks) {
      if (s?.symbol && s.sector && s.symbol in mine.held) (out[s.sector] ||= []).push(s.symbol);
    }
    return out;
  }, [stocks, mine]);

  if (isLoading) return null;
  if (isError || !screen || Object.keys(screen.sectors).length === 0) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{t("research.picks_unavailable")}</p>;
  }

  const all = Object.entries(screen.sectors).filter(([, list]) => list?.length > 0);
  const yours = all.filter(([sector]) => heldBySector[sector]?.length);
  const others = all.filter(([sector]) => !heldBySector[sector]?.length);
  const visible = yours.length === 0 || showAll ? [...yours, ...others] : yours;
  const watch = new Set(mine?.watchlist ?? []);

  return (
    <section aria-label={t("research.picks_title")} className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center gap-1.5 pr-3">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="flex min-h-[44px] min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-3 text-left font-semibold"
        >
          <ListOrdered className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {t("research.picks_title")}
          {!open && yours.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {t("research.picks_summary", { mine: yours.length, all: all.length })}
            </span>
          )}
        </button>
        <Explain term="sectorLeaders" />
        <button
          type="button"
          onClick={toggleOpen}
          aria-label={open ? t("research.picks_collapse") : t("research.picks_expand")}
          className="flex h-11 w-11 items-center justify-center"
        >
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>
      {open && (
      <div className="border-t border-border p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{t("research.picks_hint")}</p>
        </div>
        {yours.length > 0 && others.length > 0 && (
          <Button variant="outline" size="sm" className="min-h-[44px] shrink-0 text-xs sm:min-h-0 sm:h-8" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("research.picks_mineOnly") : t("research.picks_showAll", { n: all.length })}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(([sector, list]) => {
          const held = heldBySector[sector] ?? [];
          const top = list.slice(0, 3);
          const heldOutside = held.filter((sym) => !top.some((t) => t.symbol === sym));
          return (
            <div key={sector} className="rounded-lg border border-border p-3">
              <h3 className="text-xs font-semibold text-muted-foreground">{sectorLabel(sector)}</h3>
              <ul className="mt-1.5 divide-y divide-border">
                {top.map((s, i) => {
                  const isHeld = !!mine && s.symbol in mine.held;
                  return (
                    <li key={s.symbol}>
                      <button
                        type="button"
                        onClick={() => onSelect(s.symbol)}
                        title={s.name}
                        aria-current={selectedSymbol === s.symbol ? "true" : undefined}
                        className={cn(
                          "flex min-h-[44px] w-full flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded px-1.5 py-1.5 text-left hover:bg-muted/60",
                          selectedSymbol === s.symbol && "bg-primary/10"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">#{s.rank || i + 1}</span>
                          <span className="font-mono text-sm font-semibold">{s.symbol}</span>
                          {isHeld && <Badge variant="outline" className="border-success/40 bg-success/10 px-1.5 py-0 text-[10px] font-normal text-success">{t("research.picks_youHold")}</Badge>}
                          {!isHeld && watch.has(s.symbol) && <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">{t("research.picks_watchlist")}</Badge>}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {t("research.picks_score", { v: s.score.toFixed(0) })} · P/E {s.pe > 0 ? s.pe.toFixed(1) : "—"} · ROE {s.roe.toFixed(0)}%
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {heldOutside.length > 0 && (
                <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  {t("research.picks_heldOutside")}{" "}
                  {heldOutside.map((sym, k) => (
                    <span key={sym}>
                      {k > 0 && ", "}
                      <button type="button" onClick={() => onSelect(sym)} className="font-mono text-foreground hover:underline">
                        {sym}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>
      </div>
      )}
    </section>
  );
};
