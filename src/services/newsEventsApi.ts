/** Structured news events from nepse_server.py (built by tools/extract_news_events.py). */
import { useQuery } from "@tanstack/react-query";

// nepse_server.py listens on 8002 (app.run(..., port=8002)); the dev proxy targets the same port.
const BASE = import.meta.env.DEV ? "/api/nepse-server" : "http://localhost:8002";

export type NewsEventType =
  | "dividend_proposed"
  | "dividend_approved"
  | "book_closure"
  | "bonus_listed"
  | "price_adjustment"
  | "right_share"
  | "agm"
  | "quarterly_result"
  | "rating_change"
  | "ipo_fpo"
  | "debenture"
  | "auction"
  | "promoter_sale"
  | "merger_acquisition"
  | "lock_in_expiry"
  | "incident"
  | "csr"
  | "management_change"
  | "investment_or_expansion"
  | "business_update"
  | "market_roundup"
  | "other";

export type ActionKind =
  | "last_buy_day"
  | "book_closure"
  | "agm"
  | "issue_open"
  | "issue_close"
  | "lock_in_end"
  | "auction_open";

/** Fields vary by event type; every value may be missing (null) when the source did not state it. */
export interface NewsEventFields {
  bonus_pct?: number | null;
  cash_pct?: number | null;
  total_pct?: number | null;
  fiscal_year?: string | null;
  book_close_date?: string | null;
  book_close_date_bs?: string | null;
  last_buy_date?: string | null;
  agm_date?: string | null;
  agm_date_bs?: string | null;
  ratio?: string | null;
  ratio_pct?: number | null;
  stage?: string | null;
  open_date?: string | null;
  close_date?: string | null;
  quarter?: number | null;
  profit_change_pct?: number | null;
  profit_direction?: "up" | "down" | "loss" | null;
  eps?: number | null;
  direction?: "upgrade" | "downgrade" | "reaffirm" | "assigned" | null;
  rating?: string | null;
  instrument?: "ipo" | "fpo" | "mutual_fund" | null;
  share_kind?: "promoter" | "ordinary" | null;
  units?: string | null;
  expiry_date?: string | null;
  kind?: string | null;
  denied?: boolean;
  reason?: "bonus" | "right_share" | null;
  popularity_list?: boolean;
  [key: string]: unknown;
}

export interface NewsEvent {
  /** Stable hash of the article link. Same article attached to two symbols shares an id. */
  id: string;
  symbol: string;
  event_type: NewsEventType;
  headline: string;
  date: string | null;
  link: string;
  fields: NewsEventFields;
  action_date: string | null;
  action_kind: ActionKind | null;
  is_roundup: boolean;
  subject_match: boolean | null;
  confidence: "high" | "low";
}

export interface NewsEventsResponse {
  generated_at: string | null;
  today: string;
  events: NewsEvent[];
  upcoming: NewsEvent[];
}

export const fetchNewsEvents = async (symbols?: string[]): Promise<NewsEventsResponse> => {
  const q = symbols && symbols.length ? `?symbols=${encodeURIComponent(symbols.join(","))}` : "";
  const res = await fetch(`${BASE}/api/news/events${q}`);
  if (!res.ok) throw new Error(`news events ${res.status}`);
  return res.json();
};

/** All events, or only those for the given symbols. */
export const useNewsEvents = (symbols?: string[], enabled = true) => {
  const key = symbols ? [...symbols].map((s) => s.toUpperCase()).sort() : [];
  return useQuery({
    queryKey: ["news-events", key],
    queryFn: () => fetchNewsEvents(symbols ? key : undefined),
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
};
