// src/components/QuarterlyTrendChart.tsx
// Multi-quarter Recharts chart with toggleable metrics.
// One panel per unit group (crore / Rs / %) so each panel has a single Y axis and a
// single zero baseline; panels share the X axis and a synced hover tooltip.
// Supports: All Years view (all quarters on X) and Single Year view (Q1-Q4)

import { useState, useMemo } from 'react';
import {
  ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/i18n';
import { fmtMoney, fmtMoneyCompact, fmtPercent } from '@/i18n/format';
import type { QuarterRecord } from '@/types/quarterly';

interface QuarterlyTrendChartProps {
  quarters: QuarterRecord[];
  companyName?: string | null;
}

// ── Metric definitions ────────────────────────────────────────────────────────
type MetricGroup = 'profitability' | 'scale' | 'ratios';

interface MetricDef {
  key: string;
  /** Translation key suffix: quarterly.<labelKey> */
  labelKey: string;
  group: MetricGroup;
  getValue: (q: QuarterRecord) => number | null;
  unit: string;
  color: string;
  defaultOn: boolean;
}

const getRawMetric = (q: QuarterRecord, keys: string[]): number | null => {
  if (!q.raw) return null;
  for (const k of keys) {
    if (q.raw[k] !== undefined && q.raw[k] !== null) return q.raw[k];

    // Try case-insensitive matching without spaces
    const target = k.toLowerCase().replace(/\s+/g, '');
    const foundKey = Object.keys(q.raw).find(rk => rk.toLowerCase().replace(/\s+/g, '') === target);
    if (foundKey && q.raw[foundKey] !== undefined && q.raw[foundKey] !== null) return q.raw[foundKey];
  }
  return null;
};

/** Net profit of one quarter, in rupees (null when the report has no such figure). */
export const quarterNetProfit = (q: QuarterRecord): number | null => getRawMetric(q, ['Net Profit', 'net_profit']);

const toCr = (v: number | null) => v !== null ? +(v / 10_000_000).toFixed(2) : null;

const METRICS: MetricDef[] = [
  // Money (shown in crore)
  { key: 'revenue',   labelKey: 'm_revenue',     group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Revenue', 'Revenue from Contract with Customers', 'Revenue from Operation', 'Revenue from Operations', 'Total Revenue', 'Interest Income', 'revenue'])), unit: 'Cr', color: 'hsl(var(--sector-8))', defaultOn: true },
  { key: 'net_profit',labelKey: 'm_netProfit',   group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Net Profit', 'net_profit'])),       unit: 'Cr', color: 'hsl(var(--status-1))', defaultOn: true },
  { key: 'gross_profit',labelKey: 'm_grossProfit', group: 'scale', getValue: q => toCr(getRawMetric(q, ['Gross Profit', 'gross_profit'])),     unit: 'Cr', color: 'hsl(var(--sector-4))', defaultOn: false },
  { key: 'op_profit', labelKey: 'm_opProfit',    group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Operating Profit', 'operating_profit', 'op_profit'])), unit: 'Cr', color: 'hsl(var(--sector-2))', defaultOn: false },
  { key: 'total_equity', labelKey: 'm_totalEquity', group: 'scale', getValue: q => toCr(getRawMetric(q, ['Total Equity', 'total_equity'])),     unit: 'Cr', color: 'hsl(var(--sector-3))', defaultOn: false },
  { key: 'total_assets', labelKey: 'm_totalAssets', group: 'scale', getValue: q => toCr(getRawMetric(q, ['Total Assets', 'total_assets'])),     unit: 'Cr', color: 'hsl(var(--sector-5))', defaultOn: false },
  { key: 'borrowings',labelKey: 'm_borrowings',  group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Borrowings', 'lt_loan', 'borrowings'])), unit: 'Cr', color: 'hsl(var(--status-5))', defaultOn: false },
  // Per-share metrics
  { key: 'eps_ttm',   labelKey: 'm_eps',         group: 'ratios',  getValue: q => q.computed.eps_ttm,           unit: 'Rs', color: 'hsl(var(--sector-7))', defaultOn: false },
  { key: 'bvps',      labelKey: 'm_bvps',        group: 'ratios',  getValue: q => q.computed.bvps,              unit: 'Rs', color: 'hsl(var(--sector-3))', defaultOn: false },
  // Profit rates %
  { key: 'roe_ttm',   labelKey: 'm_roe',         group: 'profitability', getValue: q => q.computed.roe_ttm,    unit: '%',  color: 'hsl(var(--chart-caution))', defaultOn: false },
  { key: 'roa_ttm',   labelKey: 'm_roa',         group: 'profitability', getValue: q => q.computed.roa_ttm,    unit: '%',  color: 'hsl(var(--sector-4))', defaultOn: false },
  { key: 'net_margin',labelKey: 'm_netMargin',   group: 'profitability', getValue: q => q.computed.net_margin, unit: '%',  color: 'hsl(var(--sector-3))', defaultOn: false },
  { key: 'gross_margin',labelKey: 'm_grossMargin', group: 'profitability', getValue: q => q.computed.gross_margin,unit: '%', color: 'hsl(var(--sector-8))', defaultOn: false },
];

const METRIC_BY_KEY = new Map(METRICS.map(m => [m.key, m]));

const GROUP_LABEL_KEYS: Record<MetricGroup, string> = {
  scale: 'quarterly.grpScale',
  ratios: 'quarterly.grpRatios',
  profitability: 'quarterly.grpProfitability',
};

const QUARTER_COUNT_OPTIONS = ['4', '8', '12', '16', '20'];

const GROUP_ORDER: MetricGroup[] = ['scale', 'ratios', 'profitability'];
const GROUP_UNIT_KEY: Record<MetricGroup, string> = { scale: 'quarterly.unitCr', ratios: 'quarterly.unitRs', profitability: '' };

const formatValue = (unit: string, v: number): string => {
  if (unit === 'Cr') return fmtMoneyCompact(v * 10_000_000);
  if (unit === 'Rs') return fmtMoney(v, true);
  return fmtPercent(v, 2, false);
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => {
        const unit = METRIC_BY_KEY.get(String(entry.dataKey))?.unit ?? '';
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-mono font-medium text-foreground">
              {entry.value !== null && entry.value !== undefined ? formatValue(unit, entry.value) : '-'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── Panel: one unit group, one Y axis, one zero baseline ──────────────────────
const formatTick = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : String(v);

type ChartPoint = Record<string, string | number | null>;

interface PanelProps {
  group: MetricGroup;
  metrics: MetricDef[];
  data: ChartPoint[];
  chartType: 'line' | 'bar';
  height: number;
  showXAxis: boolean;
}

const TrendPanel = ({ group, metrics, data, chartType, height, showXAxis }: PanelProps) => {
  const { t } = useT();
  const unitKey = GROUP_UNIT_KEY[group];
  const seriesName = (m: MetricDef) => {
    const name = t(`quarterly.${m.labelKey}`);
    return unitKey ? `${name} (${t(unitKey)})` : `${name} (%)`;
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 pl-1">
        <span className="text-xs font-medium text-foreground">{t(GROUP_LABEL_KEYS[group])}</span>
        {metrics.map(m => (
          <span key={m.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: m.color }} />
            {t(`quarterly.${m.labelKey}`)}
          </span>
        ))}
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            syncId="quarterly-trends"
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="22%"
            barGap={2}
          >
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              hide={!showXAxis}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              width={52}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatTick}
              unit={group === 'profitability' ? '%' : undefined}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.6} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
            {metrics.map(m =>
              chartType === 'bar' ? (
                <Bar
                  key={m.key}
                  dataKey={m.key}
                  name={seriesName(m)}
                  fill={m.color}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={m.key}
                  type="linear"
                  dataKey={m.key}
                  name={seriesName(m)}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: m.color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const QuarterlyTrendChart = ({ quarters }: QuarterlyTrendChartProps) => {
  const { t } = useT();
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(
    new Set(METRICS.filter(m => m.defaultOn).map(m => m.key))
  );
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [quarterCount, setQuarterCount] = useState<string>('all');
  const [chartType, setChartType] = useState<'line' | 'bar'>('bar');

  const uniqueFYs = useMemo(() => [...new Set(quarters.map(q => q.fy))].sort(), [quarters]);

  const displayQuarters = useMemo(() => {
    const byYear = yearFilter === 'all' ? quarters : quarters.filter(q => q.fy === yearFilter);
    return quarterCount === 'all' ? byYear : byYear.slice(-Number(quarterCount));
  }, [quarters, yearFilter, quarterCount]);

  const chartData = useMemo(() => {
    return displayQuarters.map(q => {
      const point: ChartPoint = { label: q.quarter_label };
      METRICS.forEach(m => {
        point[m.key] = m.getValue(q);
      });
      return point;
    });
  }, [displayQuarters]);

  const toggleMetric = (key: string) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least 1
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const metricsByGroup = useMemo(() => {
    const groups: Record<MetricGroup, MetricDef[]> = { scale: [], ratios: [], profitability: [] };
    METRICS.forEach(m => groups[m.group].push(m));
    return groups;
  }, []);

  const activePanels = GROUP_ORDER
    .map(g => ({ group: g, metrics: metricsByGroup[g].filter(m => activeMetrics.has(m.key)) }))
    .filter(p => p.metrics.length > 0);

  const panelHeight = activePanels.length === 1 ? 340 : activePanels.length === 2 ? 220 : 180;

  if (quarters.length === 0) {
    return (
      <div className="text-center py-12 leading-relaxed text-muted-foreground">
        {t('quarterly.chartEmpty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls: full-width stacked on phones, one row from sm up */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[180px]" aria-label={t('quarterly.yearAria')}>
            <SelectValue placeholder={t('quarterly.allYears')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('quarterly.allYears')}</SelectItem>
            {uniqueFYs.map(fy => (
              <SelectItem key={fy} value={fy}>{t('quarterly.fyOption', { fy })}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={quarterCount} onValueChange={setQuarterCount}>
          <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[180px]" aria-label={t('quarterly.countAria')}>
            <SelectValue placeholder={t('quarterly.allQuarters')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('quarterly.allQuarters')}</SelectItem>
            {QUARTER_COUNT_OPTIONS.map(n => (
              <SelectItem key={n} value={n}>{t('quarterly.lastN', { n })}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border" role="group" aria-label={t('quarterly.chartTypeAria')}>
          <Button
            variant={chartType === 'bar' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-11 flex-1 rounded-r-none sm:h-9 sm:flex-none"
            aria-pressed={chartType === 'bar'}
            onClick={() => setChartType('bar')}
          >
            {t('quarterly.bar')}
          </Button>
          <Button
            variant={chartType === 'line' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-11 flex-1 rounded-l-none sm:h-9 sm:flex-none"
            aria-pressed={chartType === 'line'}
            onClick={() => setChartType('line')}
          >
            {t('quarterly.line')}
          </Button>
        </div>

        <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
          {t('quarterly.quartersShown', { n: displayQuarters.length })}
        </Badge>
      </div>

      {/* Metric toggles by group */}
      <div className="space-y-3">
        {GROUP_ORDER.map(group => (
          <div key={group} className="flex flex-wrap items-center gap-1.5">
            <span className="w-full flex-shrink-0 text-xs text-muted-foreground sm:w-40">{t(GROUP_LABEL_KEYS[group])}</span>
            {metricsByGroup[group].map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleMetric(m.key)}
                aria-pressed={activeMetrics.has(m.key)}
                className={`min-h-11 rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:min-h-0 sm:px-2.5
                  ${activeMetrics.has(m.key)
                    ? 'text-card border-transparent'
                    : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
                  }`}
                style={activeMetrics.has(m.key) ? { background: m.color, borderColor: m.color } : {}}
              >
                {t(`quarterly.${m.labelKey}`)}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* One panel per unit group: shared X axis, synced hover tooltip */}
      <div className="space-y-4">
        {activePanels.map((p, i) => {
          const last = i === activePanels.length - 1;
          return (
            <TrendPanel
              key={p.group}
              group={p.group}
              metrics={p.metrics}
              data={chartData}
              chartType={chartType}
              height={last ? panelHeight + 24 : panelHeight}
              showXAxis={last}
            />
          );
        })}
      </div>
    </div>
  );
};
