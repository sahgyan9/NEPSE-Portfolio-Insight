// src/components/QuarterlyDataTable.tsx
// Metric table matching the reference screenshot layout:
// Rows = metrics, Columns = quarters (most recent right), YoY column with colour coding

import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { QuarterRecord } from '@/types/quarterly';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

interface MetricEducationInfo {
  definition: string;
  goodRange?: string;
  warningThreshold?: string;
  growthTip?: string;
}

interface RowDef {
  label: string;
  getValue: (q: QuarterRecord) => string;
  getYoY?: (q: QuarterRecord) => number | null | undefined;
  highlight?: boolean;
  education?: MetricEducationInfo;
  tooltip?: string;
}

// ── Screen 1 rows (ratio metrics) ─────────────────────────────────────────────
const SCREEN1_ROWS: RowDef[] = [
  {
    label: 'PE Ratio',
    getValue: q => fmt(q.computed.pe_ratio),
    education: {
      definition: 'Price-to-Earnings Ratio. Compares current stock price to TTM earnings per share (The "Engine" speed).',
      goodRange: '10 to 20 is standard (depends on sector). Lower PE means paying less for each rupee of profit.',
      warningThreshold: 'Above 25 indicates premium/overvaluation, or declining profits.',
      growthTip: 'Look for a declining PE trend accompanied by growing EPS, which indicates the stock is becoming cheaper while the business is earning more.'
    }
  },
  {
    label: 'PB Ratio',
    getValue: q => fmt(q.computed.pb_ratio),
    education: {
      definition: 'Price-to-Book Ratio. Compares the stock market value to its book value (net assets).',
      goodRange: '0.8 to 2.0. A low PB indicates the stock trades close to its physical asset liquidation value.',
      warningThreshold: 'Above 3.0 may suggest the stock is priced at a high premium relative to net assets.',
      growthTip: 'Increasing PB should be justified by a rising ROE, showing that the premium is backed by high capital efficiency.'
    }
  },
  {
    label: 'PS Ratio',
    getValue: q => fmt(q.computed.ps_ratio),
    education: {
      definition: 'Price-to-Sales Ratio. Compares the stock price to its revenue per share.',
      goodRange: 'Below 3.0 is conservative; reflects low pricing relative to top-line sales.',
      warningThreshold: 'Above 8.0 suggests high pricing relative to sales, common in early-stage growth.',
      growthTip: 'A declining PS ratio while revenue is growing indicates the business sales are expanding faster than the stock price, signaling undervaluation.'
    }
  },
  {
    label: 'ROE TTM',
    getValue: q => fmtPct(q.computed.roe_ttm),
    education: {
      definition: 'Return on Equity. Profit generated relative to the shareholders equity investment.',
      goodRange: 'Above 12% is healthy; above 15% is excellent.',
      warningThreshold: 'Below 8% indicates inefficient usage of shareholders capital.',
      growthTip: 'A rising ROE trend shows improving capital efficiency. Watch if it is driven by higher profit margins or just high debt (leverage).'
    }
  },
  {
    label: 'ROA TTM',
    getValue: q => fmtPct(q.computed.roa_ttm),
    education: {
      definition: 'Return on Assets. Net income generated per rupee of total assets.',
      goodRange: 'Above 6% is standard; above 10% is excellent.',
      warningThreshold: 'Below 3% signals low asset-utilization efficiency.',
      growthTip: 'A rising ROA indicates management is squeezing more profits out of their physical/financial assets. Ideal when growing along with ROE.'
    }
  },
  {
    label: 'Net Margin TTM',
    getValue: q => fmtPct(q.computed.net_margin),
    education: {
      definition: 'Net Profit Margin. Percentage of revenue converted into net profit.',
      goodRange: 'Above 15% for general sectors; above 30% for high-margin sectors (like Hydropower).',
      warningThreshold: 'Below 5% indicates thin margins and vulnerability to cost increases.',
      growthTip: 'Stable or increasing net margins are a strong competitive moat sign. If sales grow but net margins fall, expenses are rising too fast.'
    }
  },
  {
    label: 'Asset Turnover TTM',
    getValue: q => fmtPct(q.computed.asset_turnover),
    education: {
      definition: 'Asset Turnover. Revenue generated relative to total assets.',
      goodRange: '0.5 to 1.5 for industrial companies; lower for banks and capital-heavy hydropowers.',
      warningThreshold: 'Declining trend signals underutilized factory capacity or idle assets.',
      growthTip: 'Rising asset turnover is highly positive. It shows the company is generating more sales without needing to build expensive new factories.'
    }
  },
  {
    label: 'EPS TTM',
    getValue: q => fmt(q.computed.eps_ttm),
    getYoY: q => q.yoy.eps_ttm,
    highlight: true,
    education: {
      definition: 'Earnings Per Share. Net income divided by outstanding shares.',
      goodRange: 'Above Rs. 15 is comfortable; above Rs. 25 is strong.',
      warningThreshold: 'Negative or declining EPS is a primary warning.',
      growthTip: 'Consistent YoY growth in EPS is the single most important driver of long-term stock prices.'
    }
  },
  {
    label: 'BVPS',
    getValue: q => fmt(q.computed.bvps),
    getYoY: q => q.yoy.bvps,
    education: {
      definition: 'Book Value Per Share. Shareholders equity divided by outstanding shares.',
      goodRange: 'Above Rs. 120 is standard.',
      warningThreshold: 'Below Rs. 100 indicates thin net assets or accumulated losses.',
      growthTip: 'Steady YoY growth in book value proves that the company is retaining and compounding its earnings rather than burning capital.'
    }
  },
  {
    label: 'Net Profit Till Qtr',
    getValue: q => fmtCr(q.computed.net_profit_till_qtr),
    getYoY: q => q.yoy.net_profit_till_qtr,
    highlight: true,
    education: {
      definition: 'Net profit accumulated from the start of the current fiscal year.',
      goodRange: 'Positive and expanding YoY relative to the same period.',
      warningThreshold: 'Negative or lower than previous year indicates earnings slow-down.',
      growthTip: 'Allows tracking year-to-date performance. Useful to project if the company will beat full-year estimates.'
    }
  },
  {
    label: 'Revenue Till Qtr',
    getValue: q => fmtCr(q.computed.revenue_till_qtr),
    getYoY: q => q.yoy.revenue_till_qtr,
    highlight: true,
    education: {
      definition: 'Revenue accumulated from the start of the current fiscal year.',
      goodRange: 'Increasing YoY, showing active business volume growth.',
      warningThreshold: 'Declining trend suggests contracting demand or operational challenges.',
      growthTip: 'Compare with the Net Profit trend: if revenue grows but profit does not, operational margins are under pressure.'
    }
  },
  {
    label: 'Net Profit TTM',
    getValue: q => fmtCr(q.computed.net_profit_ttm),
    getYoY: q => q.yoy.net_profit_ttm,
    education: {
      definition: 'Trailing Twelve Months Net Profit. Sum of net profits over the past four quarters.',
      goodRange: 'Positive and expanding YoY.',
      warningThreshold: 'Declining TTM profits are a major concern.',
      growthTip: 'TTM filters out quarterly seasonality, giving you a smooth and realistic picture of current earnings trends.'
    }
  },
  {
    label: 'Revenue TTM',
    getValue: q => fmtCr(q.computed.revenue_ttm),
    getYoY: q => q.yoy.revenue_ttm,
    education: {
      definition: 'Trailing Twelve Months Revenue. Sum of revenues over the past four quarters.',
      goodRange: 'Increasing YoY, showing sustained top-line growth.',
      warningThreshold: 'Declining TTM revenue suggests contracting market share.',
      growthTip: 'Steady growth here is essential for backing earnings growth; cost-cutting can only boost earnings temporarily.'
    }
  },
  {
    label: 'Graham Number',
    getValue: q => q.computed.graham_number ? `Rs. ${fmt(q.computed.graham_number)}` : '—',
    education: {
      definition: 'Graham Number. Represents the theoretical upper limit of conservative fair value (sq. root of 22.5 * EPS * BVPS).',
      goodRange: 'Current stock price < Graham Number (provides a Margin of Safety).',
      warningThreshold: 'Current price > Graham Number (stock is trading at a premium).',
      growthTip: 'Compare with stock price: as Graham Number grows due to higher EPS, it creates a rising floor of value for the stock.'
    }
  },
  {
    label: 'Earnings Yield',
    getValue: q => q.computed.earnings_yield ? fmtPct(q.computed.earnings_yield) : '—',
    education: {
      definition: 'Earnings Yield (E/P). The inverse of the P/E ratio, showing the expected rate of return for a shareholder.',
      goodRange: 'Above 8% (highly competitive with Fixed Deposits and risk-free rates).',
      warningThreshold: 'Below 4% (low yield relative to cash and inflation).',
      growthTip: 'A rising earnings yield trend makes the stock increasingly attractive compared to fixed income assets.'
    }
  },
  {
    label: 'PEG Ratio',
    getValue: q => fmt(q.computed.peg_ratio),
    education: {
      definition: 'Price/Earnings-to-Growth Ratio. Compares the P/E ratio with the TTM net profit growth rate.',
      goodRange: 'Below 1.0 indicates undervalued growth (a "Hidden Gem"). PEG = 0 indicates hyper-growth anomalies (such as a sudden revenue surge from factory acquisitions).',
      warningThreshold: 'Above 1.5 indicates growth is priced at a heavy premium.',
      growthTip: 'PEG ratio near 1.0 is fairly priced. If growth accelerates, PEG drops, making the valuation more attractive.'
    }
  },
  {
    label: 'Debt-to-Equity',
    getValue: q => fmt(q.computed.debt_to_equity),
    education: {
      definition: 'Debt-to-Equity. Leverage ratio comparing total borrowings/liabilities to shareholders equity. Based on golden rule: Assets = Liabilities + Equity.',
      goodRange: 'Below 1.0 is conservative; distinguishes bank debt (interest-bearing) from supplier credit (non-interest operational trade payables).',
      warningThreshold: 'Above 2.0 is highly leveraged, creating heavy interest expense pressures.',
      growthTip: 'An increasing D/E ratio is acceptable during expansion, but it must lead to higher revenues and operating profits in subsequent quarters.'
    }
  },
  {
    label: 'Net Interest Margin',
    getValue: q => q.computed.net_interest_margin ? fmtPct(q.computed.net_interest_margin) : '—',
    education: {
      definition: 'Net Interest Margin (NIM). Measures interest spread profit relative to earning assets (Banks/Microfinance).',
      goodRange: 'Above 3.5% is healthy.',
      warningThreshold: 'Below 2.5% signals severe pressure on interest earning spreads.',
      growthTip: 'A rising NIM trend shows strong loan pricing power and cheap cost of funds management.'
    }
  },
  {
    label: 'Operating Margin',
    getValue: q => q.computed.operating_profit_margin ? fmtPct(q.computed.operating_profit_margin) : '—',
    education: {
      definition: 'Operating profit as a percentage of revenue. Exposes core operational profitability before interest/tax costs.',
      goodRange: 'Above 20% for manufacturing; above 60% for hydropowers.',
      warningThreshold: 'Below 10% indicates core operational inefficiencies or rising administrative costs.',
      growthTip: 'Look for expansion in operating margin as sales grow, which shows operating leverage (fixed costs spreading thin over larger revenue).'
    }
  },
  {
    label: 'Revenue per Share',
    getValue: q => q.computed.revenue_per_share ? `Rs. ${fmt(q.computed.revenue_per_share)}` : '—',
    education: {
      definition: 'Revenue per Share (TTM). Trailing revenue divided by outstanding shares. Tracks top-line sales strength.',
      goodRange: 'Increasing YoY, proving top-line revenue expansion on a per-share basis.',
      warningThreshold: 'Declining trend indicates sales stagnation or share dilution.',
      growthTip: 'Stable or growing revenue per share is highly positive; ensures earnings growth is backed by higher sales, not just cost-cutting.'
    }
  },
  {
    label: 'QoQ Profit Momentum',
    getValue: q => q.computed.qoq_profit_momentum ? fmtPct(q.computed.qoq_profit_momentum) : '—',
    education: {
      definition: 'Quarter-on-Quarter growth of single-quarter net profits.',
      goodRange: 'Positive QoQ growth shows short-term earnings acceleration.',
      warningThreshold: 'Consistent negative QoQ momentum signals operational slow-down.',
      growthTip: 'Useful for spotting turning points in earnings cycles before they reflect in TTM values.'
    }
  },
  {
    label: 'Loan-to-Asset Ratio',
    getValue: q => q.computed.loan_to_asset ? fmtPct(q.computed.loan_to_asset) : '—',
    education: {
      definition: 'Loans extended to customers relative to total assets.',
      goodRange: '60% to 75% for balanced risk-return profiles.',
      warningThreshold: 'Above 80% shows high credit risk and loan concentration; below 50% shows conservative capital usage.',
      growthTip: 'Increasing loan-to-asset shows the bank is deploying cash into higher-yielding loans. Ideal if NPL remains low.'
    }
  },
  {
    label: 'Efficiency Ratio',
    getValue: q => q.computed.efficiency_ratio ? fmtPct(q.computed.efficiency_ratio) : '—',
    education: {
      definition: 'Operating expenses as a percentage of total operating income.',
      goodRange: 'Below 50% is highly efficient; 50% to 60% is normal.',
      warningThreshold: 'Above 65% indicates bloated administrative overhead and low profitability.',
      growthTip: 'A declining efficiency ratio trend indicates excellent cost control during business growth. Lower is better!'
    }
  },
  {
    label: 'Interest Coverage',
    getValue: q => q.computed.interest_coverage ? fmt(q.computed.interest_coverage) : '—',
    education: {
      definition: 'Operating profit divided by interest expense. Measures ability to service annual debt interest obligations.',
      goodRange: 'Above 3.0 indicates ample safety room to cover bank interests.',
      warningThreshold: 'Below 1.5 indicates default risk and high pressure on net earnings.',
      growthTip: 'A declining coverage ratio is a warning sign of either rising bank interest rates or falling operational margins.'
    }
  },
  {
    label: 'Fixed Asset Turnover',
    getValue: q => q.computed.fixed_asset_turnover ? fmt(q.computed.fixed_asset_turnover) : '—',
    education: {
      definition: 'Revenue relative to fixed net property, plant, and equipment.',
      goodRange: 'Depends on sector; higher turnover reflects efficient plant capacity utilization.',
      warningThreshold: 'Declining ratio indicates factories running below capacity.',
      growthTip: 'A rising fixed asset turnover is excellent for capital-heavy sectors like Hydropower, proving factory expansion is successfully generating sales.'
    }
  },
  {
    label: 'Insurance: Invest Yield',
    getValue: q => q.computed.investment_yield ? fmtPct(q.computed.investment_yield) : '—',
    education: {
      definition: 'Annualized investment earnings divided by total investable assets. Reflects capital deployment efficiency.',
      goodRange: 'Above 6% is standard (depends on interest rate cycle).',
      warningThreshold: 'Below 4% indicates low returns from the investment portfolio.',
      growthTip: 'Look for rising investment yields when interest rates are high, which boosts the non-underwriting earnings of the insurer.'
    }
  },
  {
    label: 'Insurance: Combined Ratio',
    getValue: q => q.computed.combined_ratio ? fmtPct(q.computed.combined_ratio) : '—',
    education: {
      definition: 'Sum of underwriting claims + management expenses divided by premium income.',
      goodRange: 'Below 100% indicates the insurer is making an underwriting profit.',
      warningThreshold: 'Above 100% indicates underwriting losses, meaning the company relies entirely on investment returns to survive.',
      growthTip: 'A declining combined ratio shows improving claims management or lower operating overheads. Lower is better!'
    }
  },
  {
    label: 'DuPont: Net Margin',
    getValue: q => q.computed.dupont_net_margin ? fmtPct(q.computed.dupont_net_margin) : '—',
    education: {
      definition: 'Net Profit Margin element. Measures net profits generated per rupee of sales.',
      goodRange: 'Above 15% is healthy.',
      warningThreshold: 'Below 5% shows thin pricing power or excessive costs.',
      growthTip: 'Look for stable or increasing net margin as the baseline driver of return on equity.'
    }
  },
  {
    label: 'DuPont: Asset Turnover',
    getValue: q => fmt(q.computed.dupont_asset_turnover, 4),
    education: {
      definition: 'Asset Turnover element. Measures efficiency of utilizing assets to generate sales.',
      goodRange: '0.5 to 1.5 is normal for asset-reliant firms.',
      warningThreshold: 'Below 0.1 indicates capital-heavy industries or underutilized assets.',
      growthTip: 'Improving asset turnover shows better capital utilization without requiring fresh asset injections.'
    }
  },
  {
    label: 'DuPont: Equity Multiplier',
    getValue: q => fmt(q.computed.dupont_equity_multiplier),
    education: {
      definition: 'Equity Multiplier (Financial Leverage). Total assets divided by total equity.',
      goodRange: '1.2 to 2.5 is normal for asset-heavy firms; much higher (e.g. 8.0) is normal for banks.',
      warningThreshold: 'Sudden increases signal heavy borrowing that elevates financial risks.',
      growthTip: 'Watch if a company is boosting its ROE simply by borrowing more money (raising the multiplier) rather than improving profit margins.'
    }
  },
  {
    label: 'DuPont: Computed ROE',
    getValue: q => q.computed.dupont_roe ? fmtPct(q.computed.dupont_roe) : '—',
    highlight: true,
    tooltip: 'Computed ROE = Net Margin * Asset Turnover * Equity Multiplier. Shows how profit margin, asset utilization, and leverage combine to drive ROE.'
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
    const rawSector = displayQ[0]?.sector || "";
    const sector = rawSector.toLowerCase();
    const isBankOrMicro = sector.includes("bank") || sector.includes("microfinance") || sector.includes("laghubitta");
    const isInsurance = sector.includes("insurance");
    const isCapitalHeavy = sector.includes("hydro") || sector.includes("manufactur") || sector.includes("hotel") || sector.includes("trading") || sector.includes("telecom");

    rows = SCREEN1_ROWS.filter(row => {
      const label = row.label;
      if (label === 'Net Interest Margin' || label === 'Loan-to-Asset Ratio' || label === 'Efficiency Ratio') {
        return isBankOrMicro;
      }
      if (label.startsWith('Insurance:')) {
        return isInsurance;
      }
      if (label === 'Fixed Asset Turnover') {
        return isCapitalHeavy;
      }
      if (label === 'Debt-to-Equity') {
        return !isBankOrMicro && !isInsurance;
      }
      return true;
    });
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

  const latestQ = displayQ[displayQ.length - 1];
  const hasDuPont = latestQ?.computed?.dupont_roe !== undefined && latestQ?.computed?.dupont_roe !== null;

  return (
    <div className="space-y-6">
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
                    {row.education ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 text-left w-full justify-start cursor-help">
                            <span>{row.label}</span>
                            <Info className="w-3 h-3 text-muted-foreground/75 inline-block shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs p-3 text-xs text-popover-foreground bg-popover border border-border shadow-md rounded-md space-y-2">
                            <div>
                              <p className="font-semibold text-primary mb-0.5">{row.label}</p>
                              <p className="text-muted-foreground leading-relaxed font-normal">{row.education.definition}</p>
                            </div>
                            
                            {(row.education.goodRange || row.education.warningThreshold) && (
                              <div className="border-t border-border/40 pt-1.5 space-y-1 font-normal">
                                {row.education.goodRange && (
                                  <p className="text-green-500 flex items-start gap-1">
                                    <span>✓</span>
                                    <span><strong>Good:</strong> {row.education.goodRange}</span>
                                  </p>
                                )}
                                {row.education.warningThreshold && (
                                  <p className="text-yellow-500 flex items-start gap-1">
                                    <span>⚠</span>
                                    <span><strong>Warning:</strong> {row.education.warningThreshold}</span>
                                  </p>
                                )}
                              </div>
                            )}
                            
                            {row.education.growthTip && (
                              <div className="border-t border-border/40 pt-1.5 font-normal">
                                <p className="text-blue-500 font-semibold mb-0.5">Trend & Growth:</p>
                                <p className="text-muted-foreground leading-relaxed">{row.education.growthTip}</p>
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span>{row.label}</span>
                    )}
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

      {mode === 'screen1' && hasDuPont && (
        <div className="mt-6 p-5 rounded-lg border border-border bg-card/50 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>📊</span> DuPont ROE Analysis (Latest Quarter: {latestQ.quarter_label})
            </h4>
            <Badge className="font-bold text-xs bg-primary/10 text-primary border-primary/20" variant="outline">
              ROE: {latestQ.computed.dupont_roe}%
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Net Profit Margin</span>
                <span className="font-mono font-semibold text-emerald-500">{latestQ.computed.dupont_net_margin}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, latestQ.computed.dupont_net_margin || 0))}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">Operating profitability and cost efficiency</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Asset Turnover</span>
                <span className="font-mono font-semibold text-indigo-500">{latestQ.computed.dupont_asset_turnover}x</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (latestQ.computed.dupont_asset_turnover || 0) * 100)}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">Asset efficiency in generating revenue</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Equity Multiplier</span>
                <span className="font-mono font-semibold text-amber-500">{latestQ.computed.dupont_equity_multiplier}x</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, ((latestQ.computed.dupont_equity_multiplier || 1) / 15) * 100)}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">Financial leverage (Total Assets / Equity)</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground border-t border-border/50 pt-3 font-mono">
            <span>Formula: ROE ({latestQ.computed.dupont_roe}%) =</span>
            <span className="text-emerald-500">Margin ({latestQ.computed.dupont_net_margin}%)</span>
            <span>×</span>
            <span className="text-indigo-500">Asset Turnover ({latestQ.computed.dupont_asset_turnover}x)</span>
            <span>×</span>
            <span className="text-amber-500">Leverage ({latestQ.computed.dupont_equity_multiplier}x)</span>
          </div>
        </div>
      )}
    </div>
  );
};
