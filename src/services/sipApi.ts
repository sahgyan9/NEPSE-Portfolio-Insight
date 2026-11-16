import { useQuery } from "@tanstack/react-query";
import { translate } from "@/i18n";

// Dev: Vite proxy (same origin). Production build: the local portfolio server directly.
const BASE = import.meta.env.DEV ? "/api/portfolio-db/api" : "http://localhost:5001/api";

export type SipRowKind = "instalment" | "dividend_units" | "redemption";

export interface SipRow {
  date: string;
  kind: SipRowKind;
  units: number;
  /** Rupees paid (instalment) or received (redemption); 0 for dividend units */
  amount: number;
  navPaid: number | null;
  charge: number | null;
  /** Latest NAV against the NAV paid, as a fraction */
  navChange?: number;
}

/** Units credited as dividend (no cash paid) */
export interface SipDividend {
  date: string;
  units: number;
  /** Fiscal year the dividend belongs to, such as "2081/82", when the record names it */
  fiscalYear: string | null;
  /** Percent the fund declared for that fiscal year, when known */
  declaredPercent: number | null;
  valueNow: number | null;
}

export interface SipFund {
  symbol: string;
  name: string;
  totalPaid: number;
  totalRedeemed: number;
  /** Units used for the value: the demat balance when known, else the statement total */
  units: number;
  dematUnits: number | null;
  statementUnits: number;
  dividendUnits: number;
  /** Dividend units at the latest NAV */
  dividendValue: number | null;
  dividends: SipDividend[];
  avgCost: number | null;
  nav: number | null;
  navDate: string | null;
  value: number | null;
  gain: number | null;
  gainPct: number | null;
  /** Yearly rate that accounts for the date of every instalment (XIRR), as a fraction */
  yearlyReturn: number | null;
  instalmentCount: number;
  usualAmount: number | null;
  firstDate: string;
  lastDate: string;
  lowestNavPaid: number | null;
  highestNavPaid: number | null;
  rows: SipRow[];
}

export interface SipSummary {
  asOf: string;
  funds: SipFund[];
}

export async function fetchSip(): Promise<SipSummary> {
  const res = await fetch(`${BASE}/sip`);
  if (!res.ok) throw new Error(translate("sip.errStatus", { status: res.status }));
  const data = await res.json();
  if (!data.sip || data.sip.error) throw new Error(data.sip?.error || translate("sip.errNoData"));
  return data.sip as SipSummary;
}

export const useSipData = () =>
  useQuery({
    queryKey: ["sip"],
    queryFn: fetchSip,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
