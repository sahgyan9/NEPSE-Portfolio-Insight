// src/components/QuarterlyDataTable.tsx
// Metric table: rows = metrics, columns = quarters (most recent right), with a year-on-year chip.
// Below the md breakpoint each metric becomes a card (latest value large, earlier quarters small).

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/Explain';
import type { GlossaryKey } from '@/lib/glossary';
import { useT } from '@/i18n';
import { fmtMoneyCompact, fmtMoney, fmtPercent } from '@/i18n/format';
import type { QuarterRecord } from '@/types/quarterly';

interface QuarterlyDataTableProps {
  quarters: QuarterRecord[];   // sorted oldest to newest
  mode: 'screen1' | 'screen2'; // which metric set to display
  /** Simple view: only the few numbers that matter most for the sector. */
  simple?: boolean;
  /** Called by the "Show all numbers" button in simple view. */
  onShowAll?: () => void;
}

const DASH = '-';

// ── Formatter helpers ─────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined, decimals = 2): string => {
  if (v === null || v === undefined) return DASH;
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtPct = (v: number | null | undefined): string => fmtPercent(v, 2, false);

const smartFormat = (key: string, v: number | null | undefined): string => {
  if (v === null || v === undefined) return DASH;
  const lKey = key.toLowerCase();

  if (lKey.includes('margin') || lKey.includes('ratio') || lKey.includes('roe') || lKey.includes('roa') || lKey.includes('npl') || lKey.includes('car') || lKey.includes('rate') || lKey.includes('spread') || lKey.includes('yield')) {
    return fmtPercent(v, 2, false);
  }

  if (lKey.includes('eps') || lKey.includes('book value') || lKey.includes('shares') || lKey.includes('number of')) {
    return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  // Otherwise, a money figure
  return fmtMoneyCompact(v);
};

// ── Year-on-year chip: arrow and sign as well as colour ──────────────────────
const YoYChip = ({ value }: { value: number | null | undefined }) => {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs">{DASH}</span>;
  if (Math.abs(value) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden="true" />{fmtPercent(value, 2, false)}
      </span>
    );
  }
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${up ? 'text-success' : 'text-destructive'}`}>
      {up ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
      {fmtPercent(value, 2)}
    </span>
  );
};

interface RowDef {
  /** Stable id. Ratio rows use it for the label key (quarterly.row_<id>). */
  id: string;
  /** Resolved label for rows built from published names. */
  label?: string;
  getValue: (q: QuarterRecord) => string;
  getYoY?: (q: QuarterRecord) => number | null | undefined;
  highlight?: boolean;
  /** Glossary entry to explain this metric */
  term?: GlossaryKey;
  /** True when quarterly.def_<id> holds a short definition */
  hasDef?: boolean;
}

const raw = (key: string) => (q: QuarterRecord) => smartFormat(key, q.raw?.[key]);
const cr = (v: number | null | undefined) => (v === null || v === undefined ? DASH : fmtMoneyCompact(v));
const rs = (v: number | null | undefined) => (v ? fmtMoney(v, true) : DASH);
const pct = (v: number | null | undefined) => (v ? fmtPct(v) : DASH);
const num = (v: number | null | undefined) => (v ? fmt(v) : DASH);

// ── Ratio rows ────────────────────────────────────────────────────────────────
const SCREEN1_ROWS: RowDef[] = [
  { id: 'pe', getValue: q => fmt(q.computed.pe_ratio), term: 'pe' },
  { id: 'pb', getValue: q => fmt(q.computed.pb_ratio), term: 'pb' },
  { id: 'ps', getValue: q => fmt(q.computed.ps_ratio), hasDef: true },
  { id: 'roe', getValue: q => fmtPct(q.computed.roe_ttm), term: 'roe' },
  { id: 'roa', getValue: q => fmtPct(q.computed.roa_ttm), hasDef: true },
  { id: 'netMargin', getValue: q => fmtPct(q.computed.net_margin), hasDef: true },
  { id: 'assetTurnover', getValue: q => fmtPct(q.computed.asset_turnover), hasDef: true },
  { id: 'eps', getValue: q => (q.computed.eps_ttm == null ? DASH : fmtMoney(q.computed.eps_ttm, true)), getYoY: q => q.yoy.eps_ttm, highlight: true, term: 'ttmEps' },
  { id: 'bvps', getValue: q => (q.computed.bvps == null ? DASH : fmtMoney(q.computed.bvps, true)), getYoY: q => q.yoy.bvps, term: 'bookValue' },
  { id: 'npTillQtr', getValue: q => cr(q.computed.net_profit_till_qtr), getYoY: q => q.yoy.net_profit_till_qtr, highlight: true, hasDef: true },
  { id: 'revTillQtr', getValue: q => cr(q.computed.revenue_till_qtr), getYoY: q => q.yoy.revenue_till_qtr, highlight: true, hasDef: true },
  { id: 'npTtm', getValue: q => cr(q.computed.net_profit_ttm), getYoY: q => q.yoy.net_profit_ttm, hasDef: true },
  { id: 'revTtm', getValue: q => cr(q.computed.revenue_ttm), getYoY: q => q.yoy.revenue_ttm, hasDef: true },
  { id: 'graham', getValue: q => rs(q.computed.graham_number), hasDef: true },
  { id: 'earningsYield', getValue: q => pct(q.computed.earnings_yield), hasDef: true },
  { id: 'peg', getValue: q => fmt(q.computed.peg_ratio), hasDef: true },
  { id: 'de', getValue: q => fmt(q.computed.debt_to_equity), hasDef: true },
  { id: 'nim', getValue: q => pct(q.computed.net_interest_margin), hasDef: true },
  { id: 'opMargin', getValue: q => pct(q.computed.operating_profit_margin), hasDef: true },
  { id: 'revPerShare', getValue: q => rs(q.computed.revenue_per_share), hasDef: true },
  { id: 'qoq', getValue: q => pct(q.computed.qoq_profit_momentum), hasDef: true },
  { id: 'l2a', getValue: q => pct(q.computed.loan_to_asset), hasDef: true },
  { id: 'eff', getValue: q => pct(q.computed.efficiency_ratio), hasDef: true },
  { id: 'intCov', getValue: q => num(q.computed.interest_coverage), hasDef: true },
  { id: 'fixedAsset', getValue: q => num(q.computed.fixed_asset_turnover), hasDef: true },
  { id: 'invYield', getValue: q => pct(q.computed.investment_yield), hasDef: true },
  { id: 'combined', getValue: q => pct(q.computed.combined_ratio), hasDef: true },
  { id: 'dpNetMargin', getValue: q => pct(q.computed.dupont_net_margin), hasDef: true },
  { id: 'dpAssetTurnover', getValue: q => fmt(q.computed.dupont_asset_turnover, 4), hasDef: true },
  { id: 'dpEquityMultiplier', getValue: q => fmt(q.computed.dupont_equity_multiplier), hasDef: true },
  { id: 'dpRoe', getValue: q => pct(q.computed.dupont_roe), highlight: true, term: 'roe', hasDef: true },
];

// Extra rows used by the simple view (they read figures that the balance sheet tab already shows).
const EXTRA_ROWS: RowDef[] = [
  { id: 'netProfit', getValue: raw('Net Profit'), getYoY: q => (q.yoy as unknown as Record<string, number | null> | undefined)?.['Net Profit'], hasDef: true },
  { id: 'revenue', getValue: q => smartFormat('Revenue', q.raw?.['Revenue'] ?? q.raw?.['Revenue from Contract with Customers'] ?? q.raw?.['Revenue from Operation'] ?? q.raw?.['Revenue from Operations'] ?? q.raw?.['Total Revenue'] ?? q.raw?.['Interest Income']), hasDef: true },
  { id: 'npl', getValue: raw('NPL'), term: 'npl' },
  { id: 'car', getValue: raw('CAR'), term: 'car' },
];

const ALL_ROWS = [...SCREEN1_ROWS, ...EXTRA_ROWS];

// Simple view: candidates in order of importance; the first 5 that have a value are shown.
const SIMPLE_BANK = ['netProfit', 'eps', 'bvps', 'npl', 'car', 'roe', 'nim'];
const SIMPLE_INSURANCE = ['netProfit', 'eps', 'bvps', 'roe', 'pe', 'combined'];
const SIMPLE_OTHER = ['revenue', 'netProfit', 'eps', 'bvps', 'roe', 'netMargin'];

// Published row names mapped to translation ids and glossary entries
const RAW_IDS: Record<string, string> = {
  'paid up capital': 'paidUpCapital', 'total equity': 'totalEquity', 'net profit': 'netProfit',
  'number of shares': 'numShares', 'total assets': 'totalAssets', 'operating profit': 'operatingProfit',
  'borrowings': 'borrowings', 'reserve and surplus': 'reserves', 'reserves and surplus': 'reserves', 'reserves': 'reserves',
  'eps(rs.)': 'eps', 'eps': 'eps', 'roe': 'roe', 'book value(rs.)': 'bookValue', 'book value': 'bookValue',
  'interest income': 'interestIncome', 'net interest income': 'netInterestIncome',
  'total operating income': 'totalOperatingIncome', 'car': 'car',
  'loans and advances to customers': 'loans', 'cost of funds': 'costOfFunds', 'npl': 'npl',
  'deposits from customers': 'deposits', 'eps reported': 'epsReported', 'book value reported': 'bvReported',
  'roe reported': 'roeReported', 'current liabilities': 'currentLiabilities', 'current assets': 'currentAssets',
  'gross profit': 'grossProfit', 'revenue': 'revenue', 'total revenue': 'totalRevenue',
  'loans and advances to bfis': 'loansBfis', 'credit to deposit ratio': 'cdRatio', 'cd ratio': 'cdRatio',
  'base rate': 'baseRate', 'interest spread rate': 'spread', 'distributable profit': 'distributable',
  'investment securities': 'invSecurities', 'retained earnings': 'retained', 'investments': 'investments',
  'investment': 'investments', 'share premium': 'sharePremium', 'net premium': 'netPremium',
  'net claim payment': 'netClaim', 'total expenses': 'totalExpenses', 'management expenses': 'mgmtExpenses',
  'insurance fund': 'insuranceFund', 'gross premium': 'grossPremium', 'ebitda': 'ebitda', 'solvency ratio': 'solvency',
};
const RAW_TERMS: Record<string, GlossaryKey> = { car: 'car', npl: 'npl', eps: 'eps', roe: 'roe', bookValue: 'bookValue' };

// ── Metric label with its info button ────────────────────────────────────────
const MetricName = ({ row, label }: { row: RowDef; label: string }) => {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-1.5 text-left">
      <span>{label}</span>
      {row.term ? (
        <Explain term={row.term} />
      ) : row.hasDef ? (
        <Explain title={label} text={t(`quarterly.def_${row.id}`)} />
      ) : null}
    </span>
  );
};

// ── Phone layout: one card per metric ────────────────────────────────────────
const PREVIOUS_SHOWN = 3;

const MetricCard = ({
  row, label, displayQ, mode,
}: { row: RowDef; label: string; displayQ: QuarterRecord[]; mode: 'screen1' | 'screen2' }) => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const latest = displayQ[displayQ.length - 1];
  const previous = displayQ.slice(0, -1).reverse(); // newest first
  const shown = open ? previous : previous.slice(0, PREVIOUS_SHOWN);
  const yoy = row.getYoY?.(latest);
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium leading-relaxed text-foreground"><MetricName row={row} label={label} /></p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="font-mono text-xl font-semibold text-primary">{row.getValue(latest)}</p>
        <span className="font-mono text-xs text-muted-foreground">{latest.quarter_label}</span>
      </div>
      {row.getYoY && (
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {t('quarterly.vsLastYear')} <YoYChip value={yoy} />
        </p>
      )}
      {previous.length > 0 && (
        <dl className="mt-2 grid grid-cols-1 gap-y-1 border-t border-border pt-2 text-xs">
          {shown.map(q => (
            <div key={`${q.fy}-${q.quarter}`} className="flex items-baseline justify-between gap-2">
              <dt className="font-mono text-muted-foreground">{q.quarter_label}</dt>
              <dd className="font-mono">
                {row.getValue(q)}
                {mode === 'screen1' && row.getYoY && (
                  <span className="ml-2"><YoYChip value={row.getYoY(q)} /></span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {previous.length > PREVIOUS_SHOWN && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-11 w-full text-xs"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          {open ? t('common.seeLess') : t('common.seeMore')}
        </Button>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const QuarterlyDataTable = ({ quarters, mode, simple = false, onShowAll }: QuarterlyDataTableProps) => {
  const { t } = useT();

  // Ratio tab: all quarters. Balance sheet tab: only quarters that have raw figures.
  const displayQ = mode === 'screen1'
    ? quarters
    : quarters.filter(q => q.raw && Object.keys(q.raw).length > 0);

  const sector = (displayQ[0]?.sector || '').toLowerCase();
  const isBankOrMicro = sector.includes('bank') || sector.includes('microfinance') || sector.includes('laghubitta');
  const isInsurance = sector.includes('insurance');
  const isCapitalHeavy = sector.includes('hydro') || sector.includes('manufactur') || sector.includes('hotel') || sector.includes('trading') || sector.includes('telecom');

  const labelOf = (row: RowDef): string => row.label ?? t(`quarterly.row_${row.id}`);

  let rows: RowDef[] = [];

  if (simple) {
    const latest = displayQ[displayQ.length - 1];
    const ids = isBankOrMicro ? SIMPLE_BANK : isInsurance ? SIMPLE_INSURANCE : SIMPLE_OTHER;
    rows = ids
      .map(id => ALL_ROWS.find(r => r.id === id))
      .filter((r): r is RowDef => !!r && !!latest && r.getValue(latest) !== DASH)
      .slice(0, 5);
  } else if (mode === 'screen1') {
    rows = SCREEN1_ROWS.filter(row => {
      const id = row.id;
      if (id === 'nim' || id === 'l2a' || id === 'eff') return isBankOrMicro;
      if (id === 'invYield' || id === 'combined') return isInsurance;
      if (id === 'fixedAsset') return isCapitalHeavy;
      if (id === 'de') return !isBankOrMicro && !isInsurance;
      return true;
    });
  } else {
    // Rows follow the keys present in the raw data, in the order of the latest quarter.
    const rawKeysOrder = displayQ.length > 0 && displayQ[displayQ.length - 1].raw_keys_order
      ? displayQ[displayQ.length - 1].raw_keys_order!
      : [];

    const allKeys = new Set(rawKeysOrder);
    displayQ.forEach(q => {
      if (q.raw) Object.keys(q.raw).forEach(key => allKeys.add(key));
    });

    rows = Array.from(allKeys).map(key => {
      const rawId = RAW_IDS[key.toLowerCase().trim()];
      return {
        id: key,
        label: rawId ? t(`quarterly.raw_${rawId}`) : key,
        term: rawId ? RAW_TERMS[rawId] : undefined,
        getValue: (q: QuarterRecord) => smartFormat(key, q.raw?.[key]),
        getYoY: (q: QuarterRecord) => (q.yoy as unknown as Record<string, number | null> | undefined)?.[key],
      };
    });
  }

  if (displayQ.length === 0) {
    return (
      <div className="py-12 text-center leading-relaxed text-muted-foreground">
        {t('quarterly.noQuarters')}
      </div>
    );
  }

  const latestQ = displayQ[displayQ.length - 1];
  const hasDuPont = !simple && latestQ?.computed?.dupont_roe !== undefined && latestQ?.computed?.dupont_roe !== null;
  const lastIdx = displayQ.length - 1;

  return (
    <div className="space-y-6">
      {/* Phone: cards */}
      <div className="space-y-3 md:hidden">
        {rows.map(row => (
          <MetricCard key={row.id} row={row} label={labelOf(row)} displayQ={displayQ} mode={mode} />
        ))}
      </div>

      {/* Tablet and desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-48 border-b border-border px-4 py-3 text-left font-semibold text-muted-foreground">
                {mode === 'screen2' && !simple ? t('quarterly.colParticular') : t('quarterly.colMetric')}
              </th>
              {mode === 'screen2' && !simple && (
                <th className="w-20 border-b border-border px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                  {t('quarterly.colYoY')}
                </th>
              )}
              {displayQ.map((q, i) => (
                <th key={`${q.fy}-${q.quarter}`}
                  className={`border-b border-border px-4 py-3 text-right font-mono text-xs font-semibold
                    ${i === lastIdx ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {q.quarter_label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.id}
                className={`border-b border-border/50 transition-colors hover:bg-muted/50
                  ${row.highlight ? 'font-semibold' : ''}
                  ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
              >
                <td className="px-4 py-3 leading-relaxed text-foreground">
                  <div className="flex flex-col">
                    <MetricName row={row} label={labelOf(row)} />
                    {mode === 'screen1' && row.getYoY && (
                      <span className="mt-0.5 text-xs font-normal text-muted-foreground">{t('quarterly.vsLastYear')}</span>
                    )}
                  </div>
                </td>

                {mode === 'screen2' && !simple && (
                  <td className="px-3 py-3 text-center align-middle">
                    {row.getYoY
                      ? <YoYChip value={row.getYoY(latestQ)} />
                      : <span className="text-xs text-muted-foreground">{DASH}</span>}
                  </td>
                )}

                {displayQ.map((q, i) => (
                  <td key={`${q.fy}-${q.quarter}`}
                    className={`px-4 py-3 text-right font-mono
                      ${i === lastIdx ? 'font-semibold text-primary' : 'text-foreground'}`}
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

      {simple && onShowAll && (
        <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={onShowAll}>
          {t('quarterly.showAll')}
        </Button>
      )}

      {mode === 'screen1' && hasDuPont && (
        <div className="space-y-4 rounded-lg border border-border bg-card/50 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
            <h4 className="text-sm font-semibold leading-relaxed text-foreground">
              {t('quarterly.dupontTitle', { quarter: latestQ.quarter_label })}
            </h4>
            <Badge className="border-primary/20 bg-primary/10 text-xs font-bold text-primary" variant="outline">
              {t('quarterly.dupontRoe', { value: fmtPercent(latestQ.computed.dupont_roe, 2, false) })}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex justify-between gap-2 text-xs">
                <span className="font-medium text-muted-foreground">{t('quarterly.dupontMargin')}</span>
                <span className="font-mono font-semibold text-foreground">{fmtPercent(latestQ.computed.dupont_net_margin, 2, false)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, latestQ.computed.dupont_net_margin || 0))}%` }} />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{t('quarterly.dupontMarginNote')}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between gap-2 text-xs">
                <span className="font-medium text-muted-foreground">{t('quarterly.dupontTurnover')}</span>
                <span className="font-mono font-semibold text-foreground">{t('quarterly.times', { n: latestQ.computed.dupont_asset_turnover ?? DASH })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (latestQ.computed.dupont_asset_turnover || 0) * 100)}%` }} />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{t('quarterly.dupontTurnoverNote')}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between gap-2 text-xs">
                <span className="font-medium text-muted-foreground">{t('quarterly.dupontLeverage')}</span>
                <span className="font-mono font-semibold text-foreground">{t('quarterly.times', { n: latestQ.computed.dupont_equity_multiplier ?? DASH })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((latestQ.computed.dupont_equity_multiplier || 1) / 15) * 100)}%` }} />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{t('quarterly.dupontLeverageNote')}</p>
            </div>
          </div>

          <p className="border-t border-border/50 pt-3 text-center font-mono text-xs leading-relaxed text-muted-foreground">
            {t('quarterly.dupontFormula', {
              roe: fmtPercent(latestQ.computed.dupont_roe, 2, false),
              margin: fmtPercent(latestQ.computed.dupont_net_margin, 2, false),
              turnover: t('quarterly.times', { n: latestQ.computed.dupont_asset_turnover ?? DASH }),
              leverage: t('quarterly.times', { n: latestQ.computed.dupont_equity_multiplier ?? DASH }),
            })}
          </p>
        </div>
      )}
    </div>
  );
};
