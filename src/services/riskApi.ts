/** Portfolio risk data from the local optimisation endpoint. */
import { useQuery } from "@tanstack/react-query";
import { translate } from "@/i18n";

const BASE = import.meta.env.DEV ? "/api/portfolio-db/api" : "http://localhost:5001/api";

export type FindingSeverity = "high" | "medium" | "low" | "info";

export interface RiskFinding {
  severity: FindingSeverity;
  code: string;
  title: string;
  detail: string;
  symbols: string[];
  /**
   * Raw values behind title/detail (symbol, sector, percent numbers such as 23.4, counts),
   * used to rebuild the sentence in the reader's language. Absent in reports made
   * before this field existed; see src/lib/findingText.ts.
   */
  params?: Record<string, string | number | boolean>;
}

export interface RiskHolding {
  symbol: string;
  company: string;
  sector: string;
  quantity: number;
  price: number;
  priceSource?: string;
  value: number;
  cost: number;
  gainPct: number;
  weight: number;
  riskShare: number;
  volatility: number | null;
  beta: number | null;
  avgCorrelation: number | null;
  return1y: number | null;
  maxDrawdown: number | null;
  measured: boolean;
}

export interface RiskSector {
  sector: string;
  weight: number;
  riskShare: number;
  holdings: number;
}

export interface ValuationWarning {
  symbol: string;
  type: "OVERVALUED" | "UNDERVALUED" | "LOSS_MAKING";
  message: string;
  pe?: number | null;
  sectorMedianPe?: number | null;
}

export interface RiskData {
  asOf: string;
  lookbackWeeks: number;
  riskLevel: string;
  disclaimer: string;
  portfolio: {
    value: number;
    cost: number;
    holdingCount: number;
    volatility: number;
    volatilityVsMarket: number;
    beta: number;
    diversificationRatio: number;
    effectiveHoldings: number;
    averageCorrelation: number;
    weeklyVar95: number;
    weeklyCvar95: number;
    weeklyVar95Amount: number;
    maxDrawdown: number;
    return1y: number;
    worstWeek: number;
    bestWeek: number;
  };
  market: { name: string; volatility: number; maxDrawdown: number; return1y: number };
  performance: {
    xirr: number | null;
    benchmarkXirr: number | null;
    billedShare?: number;
    firstFlow?: string;
    note?: string;
    /** Names the `home.rvmNote_<noteCode>` template; absent in reports saved before it existed. */
    noteCode?: string;
    noteParams?: Record<string, string | number>;
  };
  coverage: { measuredWeight: number; proxied: { symbol: string; method: string }[] };
  holdings: RiskHolding[];
  sectors: RiskSector[];
  correlation: { symbols: string[]; matrix: number[][] };
  history: { date: string; portfolio: number; market: number; drawdown: number }[];
  findings: RiskFinding[];
}

export interface OptimizationResponse {
  totalValue: number;
  holdingCount: number;
  volatilityScore: number;
  sectorExposure: { sector: string; weight: number; riskShare?: number }[];
  suggestion: string;
  valuationWarnings: ValuationWarning[];
  risk?: RiskData;
  error?: string;
}

export async function fetchOptimization(): Promise<OptimizationResponse> {
  const res = await fetch(`${BASE}/portfolio-optimization`);
  if (!res.ok) throw new Error(translate("risk.errStatus", { status: res.status }));
  const data = await res.json();
  if (!data.optimization || data.optimization.error) {
    throw new Error(data.optimization?.error || translate("risk.errNoData"));
  }
  return data.optimization as OptimizationResponse;
}

/** Shared by the dashboard and the risk page; react-query de-duplicates the request. */
export const useRiskData = () =>
  useQuery({
    queryKey: ["portfolio-optimization"],
    queryFn: fetchOptimization,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
