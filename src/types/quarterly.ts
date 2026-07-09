// src/types/quarterly.ts
// TypeScript types for quarterly financial report data

export type QuarterlyRaw = Record<string, number | null>;

export interface QuarterlyComputed {
  pe_ratio: number | null;
  pb_ratio: number | null;
  ps_ratio: number | null;
  eps_ttm: number | null;
  eps_reported: number | null;
  bvps: number | null;
  roe_ttm: number | null;
  roa_ttm: number | null;
  net_margin: number | null;
  asset_turnover: number | null;
  net_profit_till_qtr: number | null;
  revenue_till_qtr: number | null;
  net_profit_ttm: number | null;
  revenue_ttm: number | null;
  roe_reported: number | null;
  // Derived metrics
  graham_number?: number | null;
  earnings_yield?: number | null;
  peg_ratio?: number | null;
  debt_to_equity?: number | null;
  net_interest_margin?: number | null;
  dupont_net_margin?: number | null;
  dupont_asset_turnover?: number | null;
  dupont_equity_multiplier?: number | null;
  dupont_roe?: number | null;
}

export interface QuarterlyYoY {
  eps_ttm: number | null;
  bvps: number | null;
  net_profit_till_qtr: number | null;
  revenue_till_qtr: number | null;
  net_profit_ttm: number | null;
  revenue_ttm: number | null;
}

export interface QuarterRecord {
  symbol: string;
  sector: string;
  company_name: string;
  company_detected: boolean;
  fy: string;                   // e.g. "2082-83"
  quarter: number;              // 1, 2, 3, or 4
  quarter_label: string;        // e.g. "Q3 FY 2082/83"
  period_end_text: string | null;
  parsed_at: string;
  pdf_filename: string;
  raw: QuarterlyRaw;
  computed: QuarterlyComputed;
  yoy: QuarterlyYoY;
}

export interface SymbolQuarterlyData {
  symbol: string;
  sector: string | null;
  company_name: string | null;
  quarter_count: number;
  quarters: QuarterRecord[];
  last_updated: string | null;
}

export interface SymbolListItem {
  symbol: string;
  company_name: string | null;
  sector: string | null;
  quarter_count: number;
  last_updated: string | null;
}

// Upload response variants
export type UploadStatus = 'success' | 'duplicate' | 'needs_confirmation' | 'error';

export interface UploadSuccessResponse {
  status: 'success';
  message: string;
  symbol: string;
  company_name: string;
  fy: string;
  quarter: number;
  quarter_label: string;
  period_end_text: string | null;
  parsed_at: string;
  raw: QuarterlyRaw;
  computed: QuarterlyComputed;
  yoy: QuarterlyYoY;
}

export interface UploadDuplicateResponse {
  status: 'duplicate';
  message: string;
  symbol: string;
  fy: string;
  quarter: number;
  quarter_label: string;
}

export interface UploadNeedsConfirmationResponse {
  status: 'needs_confirmation';
  message: string;
  detected_company_name: string;
  detected_fy: string;
  detected_quarter: number;
  quarter_label: string;
  partial_result: Partial<QuarterRecord>;
}

export interface UploadErrorResponse {
  status: 'error';
  error: string;
}

export type UploadResponse =
  | UploadSuccessResponse
  | UploadDuplicateResponse
  | UploadNeedsConfirmationResponse
  | UploadErrorResponse;
