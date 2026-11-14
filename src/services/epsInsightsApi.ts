/** Personalised EPS insights from the local portfolio server (tools/eps_insights.py). */
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.DEV ? "/api/portfolio-db/api" : "http://localhost:5001/api";

export type EpsFlagSeverity = "high" | "medium" | "low" | "info";

export interface EpsFlag {
  code: string;
  severity: EpsFlagSeverity;
  text: string;
}

export type GrowthState = "profit" | "turned_to_loss" | "turned_profitable" | "still_loss" | null;

export interface EpsHistoryPoint {
  label: string;
  ttm_eps: number;
  annualized_eps: number | null;
}

export interface EpsHolding {
  symbol: string;
  company: string;
  sector: string;
  latest_quarter: string;
  fy: string;
  quarter: number;
  shares: number;
  ytd_profit: number;
  ttm_profit: number | null;
  ttm_eps: number | null;
  annualized_eps: number | null;
  growth_yoy_pct: number | null;
  growth_state: GrowthState;
  price: number | null;
  price_date: string | null;
  market_pe: number | null;
  market_earnings_yield_pct: number | null;
  sector_median_pe: number | null;
  avg_cost: number;
  quantity: number;
  pe_at_cost: number | null;
  earnings_yield_on_cost_pct: number | null;
  share_of_yearly_profit: number | null;
  payback_years: number | null;
  gain_pct: number | null;
  eps_history: EpsHistoryPoint[];
  notes: string[];
  flags: EpsFlag[];
}

export interface EpsPortfolio {
  holdings_counted: number;
  share_of_yearly_profit: number | null;
  total_cost: number | null;
  total_market_value: number | null;
  earnings_yield_on_cost_pct: number | null;
  market_earnings_yield_pct: number | null;
  pe_at_cost: number | null;
  market_pe: number | null;
}

export interface EpsInsights {
  generated_at: string;
  method: string;
  sector_median_pe: Record<string, number>;
  portfolio: EpsPortfolio;
  holdings: EpsHolding[];
  skipped: { symbol: string; reason: string }[];
}

export async function fetchEpsInsights(): Promise<EpsInsights> {
  const res = await fetch(`${BASE}/eps-insights`);
  if (!res.ok) throw new Error(`EPS insights unavailable (${res.status})`);
  const data = await res.json();
  if (!data.insights || data.insights.error) {
    throw new Error(data.insights?.error || "No EPS insights returned");
  }
  return data.insights as EpsInsights;
}

export const useEpsInsights = () =>
  useQuery({
    queryKey: ["eps-insights"],
    queryFn: fetchEpsInsights,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
