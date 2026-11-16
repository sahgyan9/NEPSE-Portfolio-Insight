/** Sector quality screen (tools/score_sector_leaders.py export) and the user's own symbols. */
import { useQuery } from "@tanstack/react-query";
import { translate } from "@/i18n";

const NEPSE = import.meta.env.DEV ? "/api/nepse-server" : "http://localhost:8002";
const DB = import.meta.env.DEV ? "/api/portfolio-db/api" : "http://localhost:5001/api";

export interface ScreenStock {
  symbol: string;
  name?: string;
  sector: string;
  score: number;
  rank?: number;
  roe: number;
  pe: number;
  divYield?: number;
  checklist?: { passed: number; assessable: number };
}

export interface SectorScreen {
  period: string;
  /** Sector -> top-ranked companies, best first */
  sectors: Record<string, ScreenStock[]>;
}

async function fetchSectorScreen(): Promise<SectorScreen> {
  const res = await fetch(`${NEPSE}/api/quarterly/top-performers`);
  if (!res.ok) throw new Error(translate("sector.loadError", { status: res.status }));
  const data = await res.json();
  return { period: data.latestPeriod || "", sectors: data.periods?.[data.latestPeriod] || {} };
}

export const useSectorScreen = () =>
  useQuery({
    queryKey: ["sector-screen"],
    queryFn: fetchSectorScreen,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

export interface MySymbols {
  /** Symbol -> shares held */
  held: Record<string, number>;
  /** Symbol -> average purchase price per share */
  avgCost: Record<string, number>;
  watchlist: string[];
}

async function fetchMySymbols(): Promise<MySymbols> {
  const [h, w] = await Promise.all([fetch(`${DB}/holdings`), fetch(`${DB}/watchlist`)]);
  const held: Record<string, number> = {};
  const avgCost: Record<string, number> = {};
  if (h.ok) {
    for (const it of (await h.json()).holdings || []) {
      if (!it?.symbol) continue;
      const sym = String(it.symbol).toUpperCase();
      held[sym] = Number(it.quantity) || 0;
      const cost = Number(it.avgCost);
      if (Number.isFinite(cost) && cost > 0) avgCost[sym] = cost;
    }
  }
  const watchlist: string[] = [];
  if (w.ok) {
    for (const it of (await w.json()).watchlist || []) {
      const sym = it?.symbol ? String(it.symbol).toUpperCase() : "";
      if (sym && !(sym in held)) watchlist.push(sym);
    }
  }
  return { held, avgCost, watchlist };
}

export const useMySymbols = () =>
  useQuery({
    queryKey: ["my-symbols"],
    queryFn: fetchMySymbols,
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
