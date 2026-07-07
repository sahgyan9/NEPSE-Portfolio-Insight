// src/services/quarterlyApi.ts
// API service layer for quarterly financial report endpoints (Flask :8000)

import type {
  UploadResponse,
  SymbolQuarterlyData,
  SymbolListItem,
} from '@/types/quarterly';

const BASE = 'http://localhost:8000';

// ── Upload PDF ──────────────────────────────────────────────────────────────
export async function uploadQuarterlyPdf(
  file: File,
  opts?: {
    overrideSymbol?: string;
    overrideSector?: string;
    allowOverwrite?: boolean;
  }
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('pdf', file);
  if (opts?.overrideSymbol) form.append('symbol', opts.overrideSymbol);
  if (opts?.overrideSector) form.append('sector', opts.overrideSector);
  if (opts?.allowOverwrite) form.append('overwrite', 'true');

  const res = await fetch(`${BASE}/api/quarterly/upload`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();

  // Map HTTP status to status field for uniform handling
  if (res.status === 409) return { ...data, status: 'duplicate' };
  if (res.status === 202) return { ...data, status: 'needs_confirmation' };
  if (!res.ok)           return { status: 'error', error: data.error || 'Upload failed' };
  return data as UploadResponse;
}

// ── Fetch quarterly data ─────────────────────────────────────────────────────
export async function fetchQuarterlyData(symbol: string) {
  const res = await fetch(`${BASE}/api/quarterly/fetch/${symbol.toUpperCase()}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch data for ${symbol}`);
  }
  return res.json();
}

// ── List all symbols with quarterly data ─────────────────────────────────────
export async function listQuarterlyStocks(): Promise<SymbolListItem[]> {
  const res = await fetch(`${BASE}/api/quarterly/list`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.symbols ?? [];
}

// ── Get all quarters for a symbol ────────────────────────────────────────────
export async function getQuarterlyData(symbol: string): Promise<SymbolQuarterlyData | null> {
  const res = await fetch(`${BASE}/api/quarterly/${symbol.toUpperCase()}`);
  if (!res.ok) return null;
  return res.json();
}

// ── Delete a specific quarter ─────────────────────────────────────────────────
export async function deleteQuarter(
  symbol: string,
  fy: string,
  quarter: number
): Promise<boolean> {
  // Flask route: /api/quarterly/<symbol>/<fy>/<quarter>
  // fy contains "/" which needs encoding → use dash format from DB
  const fyEncoded = encodeURIComponent(fy);
  const res = await fetch(
    `${BASE}/api/quarterly/${symbol.toUpperCase()}/${fyEncoded}/${quarter}`,
    { method: 'DELETE' }
  );
  return res.ok;
}
