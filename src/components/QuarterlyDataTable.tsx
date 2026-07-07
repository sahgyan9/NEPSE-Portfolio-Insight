// src/components/QuarterlyDataTable.tsx
// Metric table matching the reference screenshot layout:
// Rows = metrics, Columns = quarters (most recent right), YoY column with colour coding

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { QuarterRecord } from '@/types/quarterly';

interface QuarterlyDataTableProps {
  quarters: QuarterRecord[];   // sorted oldest → newest
  mode: 'screen1' | 'screen2'; // which metric set to display
}

// ── Formatter helpers ─────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined, decimals = 2): string => {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtCr = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  return `${(v / 10_000_000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
};

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(2)}%`;
};

const smartFormat = (key: string, v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  const lKey = key.toLowerCase();
  
  if (lKey.includes('margin') || lKey.includes('ratio') || lKey.includes('roe') || lKey.includes('roa') || lKey.includes('npl') || lKey.includes('car') || lKey.includes('rate') || lKey.includes('spread') || lKey.includes('yield')) {
    return `${v.toFixed(2)} %`;
  }
  
  if (lKey.includes('eps') || lKey.includes('book value') || lKey.includes('shares') || lKey.includes('number of')) {
    return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  // Otherwise, financial figure
  return `${(v / 10_000_000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
};

// ── YoY chip ──────────────────────────────────────────────────────────────────
const YoYChip = ({ value }: { value: number | null | undefined }) => {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  const up = value > 0;
  const zero = Math.abs(value) < 0.01;
  if (zero) return <span className="text-xs text-muted-foreground">{value.toFixed(2)} %</span>;
  return (
    <span className={`text-xs ${up ? 'text-green-500' : 'text-red-500'}`}>
      {value.toFixed(2)} %
    </span>
  );
};

// ── Row definition types ──────────────────────────────────────────────────────
interface RowDef {
  label: string;
  getValue: (q: QuarterRecord) => string;
  getYoY?: (q: QuarterRecord) => number | null | undefined;
  highlight?: boolean;
}

// ── Screen 1 rows (ratio metrics) ─────────────────────────────────────────────
const SCREEN1_ROWS: RowDef[] = [
  { label: 'PE Ratio', getValue: q => fmt(q.computed.pe_ratio) },
  { label: 'PB Ratio', getValue: q => fmt(q.computed.pb_ratio) },
  { label: 'PS Ratio', getValue: q => fmt(q.computed.ps_ratio) },
  { label: 'ROE TTM', getValue: q => fmtPct(q.computed.roe_ttm) },
  { label: 'ROA TTM', getValue: q => fmtPct(q.computed.roa_ttm) },
  { label: 'Net Margin TTM', getValue: q => fmtPct(q.computed.net_margin) },
  { label: 'Asset Turnover TTM', getValue: q => fmtPct(q.computed.asset_turnover) },
  {
    label: 'EPS TTM',
    getValue: q => fmt(q.computed.eps_ttm),
    getYoY: q => q.yoy.eps_ttm,
    highlight: true,
  },
  {
    label: 'BVPS',
    getValue: q => fmt(q.computed.bvps),
    getYoY: q => q.yoy.bvps,
  },
  {
    label: 'Net Profit Till Qtr',
    getValue: q => fmtCr(q.computed.net_profit_till_qtr),
    getYoY: q => q.yoy.net_profit_till_qtr,
    highlight: true,
  },
  {
    label: 'Revenue Till Qtr',
    getValue: q => fmtCr(q.computed.revenue_till_qtr),
    getYoY: q => q.yoy.revenue_till_qtr,
    highlight: true,
  },
  {
    label: 'Net Profit TTM',
    getValue: q => fmtCr(q.computed.net_profit_ttm),
    getYoY: q => q.yoy.net_profit_ttm,
  },
  {
    label: 'Revenue TTM',
    getValue: q => fmtCr(q.computed.revenue_ttm),
    getYoY: q => q.yoy.revenue_ttm,
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export const QuarterlyDataTable = ({ quarters, mode }: QuarterlyDataTableProps) => {
  // Show all available quarters (usually up to 8) for Screen 1
  // For Screen 2, only show quarters that have balance sheet data (raw keys exist)
  const displayQ = mode === 'screen1' 
    ? quarters 
    : quarters.filter(q => q.raw && Object.keys(q.raw).length > 0);

  let rows: RowDef[] = [];
  
  if (mode === 'screen1') {
    rows = SCREEN1_ROWS;
  } else {
    // Dynamically generate Screen 2 rows based on keys present in raw data
    // Use the raw_keys_order from the most recent quarter to maintain sorting
    const rawKeysOrder = displayQ.length > 0 && displayQ[displayQ.length - 1].raw_keys_order 
      ? displayQ[displayQ.length - 1].raw_keys_order! 
      : [];
      
    // Fallback: If some keys exist in raw but not in raw_keys_order, append them
    const allKeys = new Set(rawKeysOrder);
    displayQ.forEach(q => {
      if (q.raw) {
        Object.keys(q.raw).forEach(key => allKeys.add(key));
      }
    });
    
    rows = Array.from(allKeys).map(key => ({
      label: key,
      getValue: q => smartFormat(key, q.raw?.[key]),
      getYoY: q => q.yoy?.[key], // Now that we parse bs_yoy, it's available in q.yoy
    }));
  }

  if (displayQ.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No quarters available yet. Upload a PDF to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-48 border-b border-border">
              {mode === 'screen2' ? 'Particular' : 'Metric'}
            </th>
            {mode === 'screen2' && (
              <th className="text-center px-3 py-3 font-semibold text-muted-foreground border-b border-border text-xs w-20">
                YoY
              </th>
            )}
            {displayQ.map((q, i) => (
              <th key={`${q.fy}-${q.quarter}`}
                className={`text-right px-4 py-3 font-semibold border-b border-border font-mono text-xs
                  ${i === displayQ.length - 1 ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {q.quarter_label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={row.label}
              className={`border-b border-border/50 transition-colors hover:bg-muted/30
                ${row.highlight ? 'font-semibold' : ''}
                ${rowIdx % 2 === 0 ? '' : 'bg-muted/10'}`}
            >
              {/* Metric label */}
              <td className="px-4 py-3 text-foreground">
                <div className="flex flex-col">
                  <span>{row.label}</span>
                  {mode === 'screen1' && row.getYoY && <span className="text-xs text-muted-foreground mt-0.5 font-normal">YOY</span>}
                </div>
              </td>

              {/* Standalone YoY column (Screen 2 only) */}
              {mode === 'screen2' && (
                <td className="px-3 py-3 text-center align-middle">
                  {row.getYoY 
                    ? <YoYChip value={row.getYoY(displayQ[displayQ.length - 1])} /> 
                    : <span className="text-muted-foreground text-xs">—</span>
                  }
                </td>
              )}

              {/* Per-quarter values */}
              {displayQ.map((q, i) => (
                <td key={`${q.fy}-${q.quarter}`}
                  className={`px-4 py-3 text-right font-mono
                    ${i === displayQ.length - 1 ? 'text-primary font-semibold' : 'text-foreground'}`}
                >
                  <div className="flex flex-col items-end">
                    <span>{row.getValue(q)}</span>
                    {mode === 'screen1' && row.getYoY && (
                      <div className="mt-0.5 font-normal">
                        <YoYChip value={row.getYoY(q)} />
                      </div>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
