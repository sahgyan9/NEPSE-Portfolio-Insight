import { useQuery } from "@tanstack/react-query";
import { translate } from "@/i18n";

// Dev: Vite proxy (same origin). Production build: the local portfolio server directly.
const BASE = import.meta.env.DEV ? "/api/portfolio-db/api" : "http://localhost:5001/api";

/** Where the cost per share came from. See tools/realized_gains.py. */
export type CostBasis = "recorded" | "estimated" | "unknown";
/** Whether broker fees and capital gains tax are already taken off the money received. */
export type FeesState = "bill" | "included" | "not_included";

export interface RealizedSale {
  date: string;
  fiscalYear: string;
  symbol: string;
  quantity: number;
  sellPrice: number | null;
  received: number | null;
  costPerShare: number | null;
  cost: number | null;
  profit: number | null;
  profitPct: number | null;
  costBasis: CostBasis;
  fees: FeesState;
  heldFrom: string | null;
  heldTo: string | null;
  /** Shares in this sale held under 365 days (first in, first out) */
  shortTermQty: number | null;
  billNo: string | null;
}

export interface RealizedTotal {
  profit: number;
  cost: number;
  received: number;
  sales: number;
  /** Sales left out of the totals because their cost is unknown */
  uncounted: number;
  /** Counted sales whose fees and tax are not yet taken off */
  feesMissing: number;
}

export interface RealizedSummary {
  asOf: string;
  currentFiscalYear: string;
  allTime: RealizedTotal;
  thisYear: RealizedTotal;
  byYear: (RealizedTotal & { fiscalYear: string })[];
  /** Newest first */
  sales: RealizedSale[];
}

export async function fetchRealized(): Promise<RealizedSummary> {
  const res = await fetch(`${BASE}/realized`);
  if (!res.ok) throw new Error(translate("realized.errStatus", { status: res.status }));
  const data = await res.json();
  if (!data.realized || data.realized.error) throw new Error(data.realized?.error || translate("realized.errNoData"));
  return data.realized as RealizedSummary;
}

export const REALIZED_QUERY_KEY = ["realized"] as const;

export const useRealizedGains = () =>
  useQuery({
    queryKey: REALIZED_QUERY_KEY,
    queryFn: fetchRealized,
    staleTime: 60 * 1000,
    retry: 1,
  });
