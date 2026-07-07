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
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, Target } from "lucide-react";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { projectPortfolioGrowth, formatCurrency, yearsToDouble } from "@/lib/finance";
import { CHART_COLORS } from "@/lib/constants";

interface CompoundingProjectorProps {
    className?: string;
}

export const CompoundingProjector = ({ className }: CompoundingProjectorProps) => {
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

    // Create chart data with comparison lines
    const chartData = useMemo(() => {
        return projections.map((p) => ({
            year: `Year ${p.year}`,
            projected: Math.round(p.value),
            noGrowth: Math.round(summary.currentValue), // Flat line for comparison
        }));
    }, [projections, summary.currentValue]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const projected = payload[0]?.value;
            const gain = projected - summary.currentValue;
            const gainPercent = ((gain / summary.currentValue) * 100).toFixed(1);

            return (
                <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-sm text-primary">
                        Projected: Rs. {projected?.toLocaleString("en-NP")}
                    </p>
                    <p className="text-sm text-green-500">
                        Growth: +Rs. {gain?.toLocaleString("en-NP")} ({gainPercent}%)
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Compounding Growth Projector
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                        The Power of Compounding
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-primary/5 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-primary mb-1">
                            <Target className="h-4 w-4" />
                            <span className="text-xs font-medium">In {projectionYears} Years</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            Rs. {Math.round(finalValue / 1000)}K
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {growthMultiple.toFixed(1)}x your money
                        </p>
                    </div>

                    <div className="text-center p-3 bg-green-500/5 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-xs font-medium">Total Growth</span>
                        </div>
                        <p className="text-lg font-bold text-green-500">
                            +Rs. {Math.round(totalGrowth / 1000)}K
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {((totalGrowth / summary.currentValue) * 100).toFixed(0)}% gain
                        </p>
                    </div>

                    <div className="text-center p-3 bg-amber-500/5 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs font-medium">Doubling Time</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">
                            {doublingTime.toFixed(1)} Years
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Rule of 72
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Projection Period</span>
                            <span className="font-medium">{projectionYears} years</span>
                        </div>
                        <Slider
                            value={[projectionYears]}
                            onValueChange={([value]) => setProjectionYears(value)}
                            min={1}
                            max={30}
                            step={1}
                            className="py-2"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Assumed Annual Return</span>
                            <span className="font-medium">{assumedCAGR.toFixed(1)}%</span>
                        </div>
                        <Slider
                            value={[assumedCAGR]}
                            onValueChange={([value]) => setAssumedCAGR(value)}
                            min={1}
                            max={25}
                            step={0.5}
                            className="py-2"
                        />
                    </div>
                </div>

                {/* Chart */}
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
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                                tickLine={false}
                                axisLine={{ stroke: "hsl(var(--border))" }}
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine
                                y={summary.currentValue}
                                stroke={CHART_COLORS.neutral}
                                strokeDasharray="5 5"
                                label={{
                                    value: "Today",
                                    position: "right",
                                    fill: "hsl(var(--muted-foreground))",
                                    fontSize: 10,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="projected"
                                stroke={CHART_COLORS.positive}
                                strokeWidth={2}
                                fill="url(#projectedGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Insight */}
                <div className="text-center p-4 border border-border rounded-lg bg-gradient-to-r from-primary/5 to-green-500/5">
                    <p className="text-sm text-muted-foreground">
                        💡 <strong className="text-foreground">Compound Interest Insight:</strong>{" "}
                        At {assumedCAGR.toFixed(1)}% annual return, your Rs.{" "}
                        {(summary.currentValue / 1000).toFixed(0)}K will grow to Rs.{" "}
                        {(finalValue / 1000).toFixed(0)}K in {projectionYears} years —{" "}
                        <span className="text-green-500 font-medium">
                            that's Rs. {(totalGrowth / 1000).toFixed(0)}K in pure growth!
                        </span>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
