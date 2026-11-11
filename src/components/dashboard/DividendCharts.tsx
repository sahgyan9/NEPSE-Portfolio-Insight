import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, CHART, TooltipBox, axisLine, axisTick, fmtAxisCompact, fmtFrac, fmtRs, gridProps } from "@/components/charts";
import type { CompanyDividend } from "@/services/receivedDividendsApi";
import type { StockHolding } from "@/data/portfolioData";

interface Props {
  companies: CompanyDividend[];
  holdings: StockHolding[];
  fiscalYear: string;
}

/** Yearly cash dividend income, and cash yield per holding for the selected year. */
export const DividendCharts = ({ companies, holdings, fiscalYear }: Props) => {
  const yearly = useMemo(() => {
    const byYear = new Map<string, number>();
    companies.forEach((c) => {
      (c.dividendTrend ?? []).forEach((t) => {
        byYear.set(t.fiscalYear, (byYear.get(t.fiscalYear) ?? 0) + (t.receivedCash || 0));
      });
    });
    return Array.from(byYear.entries())
      .map(([fy, cash]) => ({ fy, cash }))
      .sort((a, b) => a.fy.localeCompare(b.fy));
  }, [companies]);

  const yields = useMemo(() => {
    const value = new Map(holdings.map((h) => [h.scrip, h.currentValue]));
    return companies
      .map((c) => {
        const v = value.get(c.symbol) ?? 0;
        return { symbol: c.symbol, cash: c.received.cashNet, yield: v > 0 ? c.received.cashNet / v : 0 };
      })
      .filter((r) => r.cash > 0)
      .sort((a, b) => b.yield - a.yield)
      .slice(0, 10);
  }, [companies, holdings]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="How much cash dividend have I received each year?"
        subtitle="Cash received, summed across your current holdings. Bonus shares are not included."
        empty={yearly.length === 0}
        height={240}
      >
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="fy" tick={axisTick} axisLine={axisLine} tickLine={false} />
              <YAxis width={48} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={fmtAxisCompact} />
              <Tooltip
                cursor={{ fill: "hsl(var(--chart-cursor))" }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox title={`Fiscal year ${payload[0].payload.fy}`} rows={[{ label: "Cash received", value: fmtRs(payload[0].value as number) }]} />
                  ) : null
                }
              />
              <Bar dataKey="cash" fill={CHART.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Which holdings pay the most for their size?"
        subtitle={`Cash dividend received in ${fiscalYear} as a share of each holding's current value`}
        explain="dividendYield"
        empty={yields.length === 0}
        emptyMessage="No cash dividends received for this fiscal year."
        height={240}
      >
        <div style={{ height: Math.max(180, yields.length * 28 + 30) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yields} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
              <XAxis type="number" tick={axisTick} axisLine={axisLine} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <YAxis type="category" dataKey="symbol" width={62} tick={{ ...axisTick, fill: CHART.text }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--chart-cursor))" }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={payload[0].payload.symbol}
                      rows={[
                        { label: "Yield on current value", value: fmtFrac(payload[0].payload.yield) },
                        { label: "Cash received", value: fmtRs(payload[0].payload.cash) },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="yield" fill={CHART.gain} radius={[0, 3, 3, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
};
