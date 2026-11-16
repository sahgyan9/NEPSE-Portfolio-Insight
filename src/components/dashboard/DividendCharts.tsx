import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, CHART, TooltipBox, axisLine, axisTick, fmtAxisCompact, fmtFrac, fmtRs, gridProps } from "@/components/charts";
import type { CompanyDividend } from "@/services/receivedDividendsApi";
import type { StockHolding } from "@/data/portfolioData";
import { useT } from "@/i18n";
import { fmtMoney } from "@/i18n/format";

interface Props {
  companies: CompanyDividend[];
  holdings: StockHolding[];
  fiscalYear: string;
}

/** Yearly cash dividend income, and cash yield per holding for the selected year. */
export const DividendCharts = ({ companies, holdings, fiscalYear }: Props) => {
  const { t } = useT();

  const yearly = useMemo(() => {
    const byYear = new Map<string, number>();
    companies.forEach((c) => {
      (c.dividendTrend ?? []).forEach((p) => {
        byYear.set(p.fiscalYear, (byYear.get(p.fiscalYear) ?? 0) + (p.receivedCash || 0));
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

  // One plain sentence per chart, so the meaning does not depend on reading the bars.
  const yearlySummary = useMemo(() => {
    if (yearly.length === 0) return "";
    const best = yearly.reduce((m, r) => (r.cash > m.cash ? r : m), yearly[0]);
    const last = yearly[yearly.length - 1];
    if (best.cash <= 0) return t("dividends.chartYearlySummaryNone");
    if (best.fy === last.fy) return t("dividends.chartYearlySummaryLatestBest", { fy: last.fy, amount: fmtMoney(last.cash) });
    return t("dividends.chartYearlySummary", {
      bestFy: best.fy,
      bestAmount: fmtMoney(best.cash),
      lastFy: last.fy,
      lastAmount: fmtMoney(last.cash),
    });
  }, [yearly, t]);

  const yieldSummary = useMemo(() => {
    if (yields.length === 0) return "";
    const top = yields[0];
    return t("dividends.chartYieldSummary", {
      symbol: top.symbol,
      amount: fmtMoney(top.yield * 100, true),
      base: fmtMoney(100),
    });
  }, [yields, t]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title={t("dividends.chartYearlyTitle")}
        subtitle={t("dividends.chartYearlySub")}
        empty={yearly.length === 0}
        emptyMessage={t("dividends.chartEmpty")}
        height={240}
      >
        <p className="mb-2 text-sm leading-relaxed text-foreground">{yearlySummary}</p>
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
                    <TooltipBox
                      title={t("dividends.chartFyLabel", { fy: payload[0].payload.fy })}
                      rows={[{ label: t("dividends.chartCashReceived"), value: fmtRs(payload[0].value as number) }]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="cash" name={t("dividends.chartCashReceived")} fill={CHART.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title={t("dividends.chartYieldTitle")}
        subtitle={t("dividends.chartYieldSub", { fy: fiscalYear })}
        explain="dividendYield"
        empty={yields.length === 0}
        emptyMessage={t("dividends.chartYieldEmpty")}
        height={240}
      >
        <p className="mb-2 text-sm leading-relaxed text-foreground">{yieldSummary}</p>
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
                        { label: t("dividends.chartYieldOnValue"), value: fmtFrac(payload[0].payload.yield) },
                        { label: t("dividends.chartCashReceived"), value: fmtRs(payload[0].payload.cash) },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="yield" name={t("dividends.chartYieldOnValue")} fill={CHART.gain} radius={[0, 3, 3, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
};
