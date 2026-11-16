import { useMemo, useState } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, Clock, Target, AlertTriangle } from "lucide-react";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { projectPortfolioGrowth, yearsToDouble } from "@/lib/finance";
import { CHART_COLORS } from "@/lib/constants";
import { fmtAxisCompact } from "@/components/charts";
import { useT } from "@/i18n";
import { fmtMoney, fmtMoneyCompact, fmtPercent } from "@/i18n/format";

interface CompoundingProjectorProps {
    className?: string;
}

export const CompoundingProjector = ({ className }: CompoundingProjectorProps) => {
    const { t } = useT();
    const { summary, estimatedCAGR } = usePortfolioAnalytics();
    const [projectionYears, setProjectionYears] = useState(10);
    const [assumedCAGR, setAssumedCAGR] = useState(
        Math.max(estimatedCAGR, 8) // Use at least 8% for projections
    );

    const projections = useMemo(() => {
        return projectPortfolioGrowth(summary.currentValue, assumedCAGR, projectionYears);
    }, [summary.currentValue, assumedCAGR, projectionYears]);

    const doublingTime = useMemo(() => yearsToDouble(assumedCAGR), [assumedCAGR]);

    const finalValue = projections[projections.length - 1]?.value || 0;
    const totalGrowth = finalValue - summary.currentValue;
    const growthMultiple = finalValue / summary.currentValue;
    const growthPct = (totalGrowth / summary.currentValue) * 100;

    // Create chart data with comparison lines
    const chartData = useMemo(() => {
        return projections.map((p) => ({
            year: t("dividends.projYearN", { n: p.year }),
            projected: Math.round(p.value),
            noGrowth: Math.round(summary.currentValue), // Flat line for comparison
        }));
    }, [projections, summary.currentValue, t]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const projected = payload[0]?.value as number;
            const gain = projected - summary.currentValue;
            const gainPercent = (gain / summary.currentValue) * 100;

            return (
                <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-sm text-foreground">{t("dividends.projTipValue", { amount: fmtMoney(projected) })}</p>
                    <p className="text-sm text-muted-foreground">
                        {t("dividends.projTipGrowth", { amount: fmtMoney(gain), pct: fmtPercent(gainPercent, 1, false) })}
                    </p>
                </div>
            );
        }
        return null;
    };

    const finite = (v: number) => Number.isFinite(v);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
                    {t("dividends.projTitle")}
                </CardTitle>
                <p className="text-sm leading-relaxed text-muted-foreground">{t("dividends.projSub")}</p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-muted/40 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-primary mb-1">
                            <Target className="h-4 w-4" aria-hidden="true" />
                            <span className="text-xs font-medium">{t("dividends.projInYears", { n: projectionYears })}</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">{fmtMoneyCompact(finalValue)}</p>
                        <p className="text-xs text-muted-foreground">
                            {finite(growthMultiple) ? t("dividends.projMultiple", { x: growthMultiple.toFixed(1) }) : "-"}
                        </p>
                    </div>

                    <div className="text-center p-3 bg-muted/40 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-primary mb-1">
                            <TrendingUp className="h-4 w-4" aria-hidden="true" />
                            <span className="text-xs font-medium">{t("dividends.projTotalGrowth")}</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">{fmtMoneyCompact(totalGrowth)}</p>
                        <p className="text-xs text-muted-foreground">
                            {finite(growthPct) ? t("dividends.projGrowthPct", { pct: fmtPercent(growthPct, 0, false) }) : "-"}
                        </p>
                    </div>

                    <div className="text-center p-3 bg-muted/40 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-primary mb-1">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            <span className="text-xs font-medium">{t("dividends.projDoubling")}</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {finite(doublingTime) ? t("dividends.projYears", { n: doublingTime.toFixed(1) }) : "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">{t("dividends.projRule72")}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <div className="space-y-1 w-full">
                        <div className="flex justify-between gap-2 text-sm">
                            <span id="proj-years-label" className="text-muted-foreground">{t("dividends.projPeriod")}</span>
                            <span className="font-medium">{t("dividends.projYears", { n: projectionYears })}</span>
                        </div>
                        <Slider
                            value={[projectionYears]}
                            onValueChange={([value]) => setProjectionYears(value)}
                            min={1}
                            max={30}
                            step={1}
                            className="w-full py-5 md:py-2"
                            aria-labelledby="proj-years-label"
                        />
                    </div>

                    <div className="space-y-1 w-full">
                        <div className="flex justify-between gap-2 text-sm">
                            <span id="proj-return-label" className="text-muted-foreground">{t("dividends.projReturn")}</span>
                            <span className="font-medium">{fmtPercent(assumedCAGR, 1, false)}</span>
                        </div>
                        <Slider
                            value={[assumedCAGR]}
                            onValueChange={([value]) => setAssumedCAGR(value)}
                            min={1}
                            max={25}
                            step={0.5}
                            className="w-full py-5 md:py-2"
                            aria-labelledby="proj-return-label"
                        />
                    </div>
                </div>

                <p className="flex items-start gap-2 text-sm leading-relaxed text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t("dividends.projCaveat")}</span>
                </p>

                {/* Chart */}
                <p className="text-sm leading-relaxed text-foreground">
                    {t("dividends.projSummary", {
                        pct: fmtPercent(assumedCAGR, 1, false),
                        start: fmtMoneyCompact(summary.currentValue),
                        end: fmtMoneyCompact(finalValue),
                        n: projectionYears,
                        growth: fmtMoneyCompact(totalGrowth),
                    })}
                </p>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLORS.positive} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={CHART_COLORS.positive} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="year"
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                                tickLine={false}
                                axisLine={{ stroke: "hsl(var(--border))" }}
                            />
                            <YAxis
                                width={48}
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                                tickLine={false}
                                axisLine={{ stroke: "hsl(var(--border))" }}
                                tickFormatter={fmtAxisCompact}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine
                                y={summary.currentValue}
                                stroke={CHART_COLORS.neutral}
                                strokeDasharray="5 5"
                                label={{
                                    value: t("common.today"),
                                    position: "insideTopRight",
                                    fill: "hsl(var(--muted-foreground))",
                                    fontSize: 10,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="projected"
                                name={t("dividends.projLegend")}
                                stroke={CHART_COLORS.positive}
                                strokeWidth={2}
                                fill="url(#projectedGradient)"
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
