// src/components/QuarterlyTrendChart.tsx
// Multi-quarter Recharts line chart with toggleable metrics
// Supports: All Years view (all quarters on X) and Single Year view (Q1-Q4)

import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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
import type { QuarterRecord } from '@/types/quarterly';

interface QuarterlyTrendChartProps {
  quarters: QuarterRecord[];
  companyName?: string | null;
}

// ── Metric definitions ────────────────────────────────────────────────────────
type MetricGroup = 'profitability' | 'scale' | 'ratios';

interface MetricDef {
  key: string;
  label: string;
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

const toCr = (v: number | null) => v !== null ? +(v / 10_000_000).toFixed(2) : null;

const METRICS: MetricDef[] = [
  // Scale metrics (Cr)
  { key: 'revenue',   label: 'Revenue (Cr)',        group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Revenue', 'Interest Income', 'revenue'])), unit: 'Cr', color: '#3b82f6', defaultOn: true },
  { key: 'net_profit',label: 'Net Profit (Cr)',      group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Net Profit', 'net_profit'])),       unit: 'Cr', color: '#22c55e', defaultOn: true },
  { key: 'gross_profit',label:'Gross Profit (Cr)',   group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Gross Profit', 'gross_profit'])),     unit: 'Cr', color: '#a855f7', defaultOn: false },
  { key: 'op_profit', label: 'Oper. Profit (Cr)',    group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Operating Profit', 'operating_profit', 'op_profit'])), unit: 'Cr', color: '#f59e0b', defaultOn: false },
  { key: 'total_equity', label: 'Total Equity (Cr)', group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Total Equity', 'total_equity'])),     unit: 'Cr', color: '#06b6d4', defaultOn: false },
  { key: 'total_assets', label: 'Total Assets (Cr)', group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Total Assets', 'total_assets'])),     unit: 'Cr', color: '#64748b', defaultOn: false },
  { key: 'borrowings',label: 'Borrowings (Cr)',      group: 'scale',   getValue: q => toCr(getRawMetric(q, ['Borrowings', 'lt_loan', 'borrowings'])), unit: 'Cr', color: '#ef4444', defaultOn: false },
  // Ratio / per-share metrics
  { key: 'eps_ttm',   label: 'EPS TTM',              group: 'ratios',  getValue: q => q.computed.eps_ttm,           unit: 'Rs', color: '#14b8a6', defaultOn: true },
  { key: 'bvps',      label: 'BVPS',                 group: 'ratios',  getValue: q => q.computed.bvps,              unit: 'Rs', color: '#ec4899', defaultOn: false },
  // Profitability %
  { key: 'roe_ttm',   label: 'ROE TTM %',            group: 'profitability', getValue: q => q.computed.roe_ttm,    unit: '%',  color: '#f59e0b', defaultOn: true },
  { key: 'roa_ttm',   label: 'ROA TTM %',            group: 'profitability', getValue: q => q.computed.roa_ttm,    unit: '%',  color: '#a855f7', defaultOn: false },
  { key: 'net_margin',label: 'Net Margin %',          group: 'profitability', getValue: q => q.computed.net_margin, unit: '%',  color: '#06b6d4', defaultOn: false },
  { key: 'gross_margin',label:'Gross Margin %',       group: 'profitability', getValue: q => q.computed.gross_margin,unit: '%', color: '#64748b', defaultOn: false },
];

const GROUP_LABELS: Record<MetricGroup, string> = {
  scale: '📊 Scale (Cr)',
  ratios: '💰 Per Share (Rs)',
  profitability: '📈 Profitability (%)',
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium" style={{ color: entry.color }}>
            {entry.value !== null && entry.value !== undefined
              ? `${entry.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const QuarterlyTrendChart = ({ quarters, companyName }: QuarterlyTrendChartProps) => {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(
    new Set(METRICS.filter(m => m.defaultOn).map(m => m.key))
  );
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Get unique FYs for the year filter
  const uniqueFYs = useMemo(() => {
    const fys = [...new Set(quarters.map(q => q.fy))].sort();
    return fys;
  }, [quarters]);

  // Filter quarters for display
  const displayQuarters = useMemo(() => {
    if (yearFilter === 'all') return quarters;
    return quarters.filter(q => q.fy === yearFilter);
  }, [quarters, yearFilter]);

  // Build chart data
  const chartData = useMemo(() => {
    return displayQuarters.map(q => {
      const point: Record<string, any> = { label: q.quarter_label };
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

  const activeMetricDefs = METRICS.filter(m => activeMetrics.has(m.key));
  const hasLeftAxis = activeMetricDefs.some(m => m.group === 'scale');
  const hasRightAxis = activeMetricDefs.some(m => m.group !== 'scale');

  // Group metrics by group for the legend/toggle UI
  const metricsByGroup = useMemo(() => {
    const groups: Record<MetricGroup, MetricDef[]> = { scale: [], ratios: [], profitability: [] };
    METRICS.forEach(m => groups[m.group].push(m));
    return groups;
  }, []);

  if (quarters.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Upload quarterly PDFs to see trend charts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {uniqueFYs.map(fy => (
              <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border rounded-md">
          <Button
            variant={chartType === 'line' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => setChartType('line')}
          >
            Line
          </Button>
          <Button
            variant={chartType === 'bar' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => setChartType('bar')}
          >
            Bar
          </Button>
        </div>

        <Badge variant="outline" className="text-xs text-muted-foreground">
          {displayQuarters.length} quarters
        </Badge>
      </div>

      {/* Metric toggles by group */}
      <div className="space-y-2">
        {(Object.entries(metricsByGroup) as [MetricGroup, MetricDef[]][]).map(([group, mets]) => (
          <div key={group} className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{GROUP_LABELS[group]}</span>
            {mets.map(m => (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                  ${activeMetrics.has(m.key)
                    ? 'text-white border-transparent'
                    : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
                  }`}
                style={activeMetrics.has(m.key) ? { background: m.color, borderColor: m.color } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                hide={!hasLeftAxis}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                hide={!hasRightAxis}
                tickFormatter={(v) => String(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => METRICS.find(m => m.key === value)?.label ?? value}
                wrapperStyle={{ fontSize: 12 }}
              />
              {activeMetricDefs.map(m => (
                <Line
                  key={m.key}
                  yAxisId={m.group === 'scale' ? 'left' : 'right'}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                hide={!hasLeftAxis}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                hide={!hasRightAxis}
                tickFormatter={(v) => String(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => METRICS.find(m => m.key === value)?.label ?? value}
                wrapperStyle={{ fontSize: 12 }}
              />
              {activeMetricDefs.map(m => (
                <Bar
                  key={m.key}
                  yAxisId={m.group === 'scale' ? 'left' : 'right'}
                  dataKey={m.key}
                  name={m.label}
                  fill={m.color}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
